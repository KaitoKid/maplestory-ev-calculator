#!/usr/bin/env python3
# Builds src/modules/bpot.data.ts from parsed KMS additional-cube (5062500) legendary tables.
import json,re,sys
r=json.load(open(sys.argv[1])); out=sys.argv[2]
PARTS={1:'weapon',2:'emblem',3:'secondary',6:'hat',7:'top',8:'overall',9:'bottom',10:'shoes',11:'gloves',12:'cape',13:'belt',14:'shoulder',15:'face',16:'eye',17:'earring',18:'ring',19:'pendant',20:'heart'}
STAT={'STR':'STR','DEX':'DEX','INT':'INT','LUK':'LUK'}
def cat(t):
    m=re.fullmatch(r'(STR|DEX|INT|LUK) \+(\d+)(%?)',t)
    if m: return (m[1]+('p' if m[3] else ''),int(m[2]))
    m=re.fullmatch(r'캐릭터 기준 9레벨 당 (STR|DEX|INT|LUK) \+(\d+)',t)
    if m: return (m[1]+'lv',int(m[2]))
    m=re.fullmatch(r'올스탯 \+(\d+)%',t)
    if m: return ('ALLp',int(m[1]))
    m=re.fullmatch(r'최대 HP \+(\d+)(%?)',t)
    if m: return ('HPp' if m[2] else 'HP',int(m[1]))
    m=re.fullmatch(r'(공격력|마력) \+(\d+)(%?)',t)
    if m: return (('ATT' if m[1]=='공격력' else 'MATT')+('p' if m[3] else ''),int(m[2]))
    m=re.fullmatch(r'데미지 \+(\d+)%',t)
    if m: return ('DMGp',int(m[1]))
    m=re.fullmatch(r'보스 몬스터 데미지 \+(\d+)%',t)
    if m: return ('BOSSp',int(m[1]))
    m=re.fullmatch(r'몬스터 방어율 무시 \+(\d+)%',t)
    if m: return ('IED',int(m[1]))
    m=re.fullmatch(r'크리티컬 데미지 \+(\d+)%',t)
    if m: return ('CRITDMGp',int(m[1]))
    m=re.fullmatch(r'스킬 재사용 대기시간 -(\d+)초',t)
    if m: return ('CDR',int(m[1]))
    return ('J',0)
def pools(lines):
    res=[]
    for L in lines:
        acc={}
        for t,rate in L:
            k=cat(t); acc[k]=acc.get(k,0)+rate
        res.append([[c,v,round(p,5)] for (c,v),p in acc.items()])
    return res
# hi-band transform (KMS 120-200 -> 201+), verified below on parts with lv250 data
def bump(rows,weaponish=False):
    o=[]
    for c,v,p in rows:
        if weaponish and c in('ATT','MATT'): pass
        elif c in('STRp','DEXp','INTp','LUKp','ALLp','HPp','ATTp','MATTp','DMGp','STR','DEX','INT','LUK','ATT','MATT'): v+=1
        elif c=='HP': v+=15
        elif c in('IED','BOSSp'): v+=2
        o.append([c,v,p])
    return o
def norm(ps): return [sorted(map(tuple,x)) for x in ps]
data={}; checked=[]
for p,name in PARTS.items():
    lo=pools(r[f'L200_p{p}']['lines'])
    assert pools(r[f'L150_p{p}']['lines'])==lo
    derived=[bump(x,name in('weapon','emblem','secondary')) for x in lo]
    hi_raw=r[f'L250_p{p}']['lines']
    if hi_raw:
        hi=pools(hi_raw)
        # crit-rate / recovery lines also bump but map to J; compare only non-J rows
        strip=lambda ps:[sorted(t for t in x if t[0]!='J') for x in norm(ps)]
        assert strip(hi)==strip(derived), name
        checked.append(name)
    else: hi=derived
    data[name]={'lo':lo,'hi':hi}
for name,d in data.items():
    for b in d.values():
        for x in b: assert abs(sum(t[2] for t in x)-100)<0.01,(name,sum(t[2] for t in x))
hdr=f'''// AUTO-GENERATED from Nexon's official KMS probability page for the Additional Cube (item 5062500,
// which is GMS's Bonus Glowing Cube; the Bonus Bright Cube 5062503 shares its tier-up table):
// https://maplestory.nexon.com/Guide/OtherProbability/cube/addi (fetched 2026-11-05, Legendary rank).
// Bands follow MapleStory Wiki (Potential): GMS items lv 71-150 use the KMS lv 120-200 table ('lo'),
// GMS lv 151+ use the KMS lv 201+ table ('hi'). 'hi' is Nexon's lv 250 data where KMS has that part
// ({", ".join(checked)}); for the other parts it is derived with the same +1 / +15 HP / +2 IED,Boss
// step (weapon-type flat ATT stays 32), which was checked to reproduce every part that does have lv 250 data.
// Row = [line, value, displayed rate %]. Lines are independent (bonus potential has no capped lines).
// '*lv' = per 9 character levels. 'J' = lines with no damage value (MP, crit rate, drop, meso, recovery...).

export type BpotCat = 'STR'|'DEX'|'INT'|'LUK'|'STRp'|'DEXp'|'INTp'|'LUKp'|'STRlv'|'DEXlv'|'INTlv'|'LUKlv'|'ALLp'|'HP'|'HPp'|'ATT'|'MATT'|'ATTp'|'MATTp'|'DMGp'|'BOSSp'|'IED'|'CRITDMGp'|'CDR'|'J';
export type BpotRow = [BpotCat, number, number];
export type BpotPools = [BpotRow[], BpotRow[], BpotRow[]];
export type BpotSlot = {" | ".join(repr(n) for n in PARTS.values())};

export const BONUS_LEGENDARY_LINES: Record<BpotSlot, {{ lo: BpotPools; hi: BpotPools }}> = '''
open(out,'w').write(hdr+json.dumps(data,separators=(',',':'))+';\n')
print('ok, checked hi transform on',checked)
