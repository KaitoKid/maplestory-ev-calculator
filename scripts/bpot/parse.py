# Parses the HTML tables returned by Nexon's GetSearchProbList endpoint into JSON (used by fetch.sh).
import re,sys,json,glob,os
src=sys.argv[1]
def parse(fn):
    h=open(fn,encoding='utf-8').read()
    t=re.sub(r'<script.*?</script>','',h,flags=re.S)
    t=re.sub(r'<[^>]+>','|',t); t=re.sub(r'\s+',' ',t)
    cells=[c.strip() for c in t.split('|') if c.strip()]
    bands=[c for c in cells if '레벨 이상' in c or '레벨 이하' in c or '레벨 ~' in c]
    band=bands[0] if bands else '?'
    out=[];cur=None
    for k,c in enumerate(cells):
        if c in('첫 번째 옵션','두 번째 옵션','세 번째 옵션'): cur=[];out.append(cur);continue
        if cur is None or c=='확률': continue
        m=re.fullmatch(r'([\d.]+)%',c)
        if m and cur is not None and cur and cur[-1][1] is None: cur[-1][1]=float(m.group(1))
        elif not m: cur.append([c,None])
    return band,out
res={}
for fn in sorted(glob.glob(os.path.join(src,'*.html'))):
    b,o=parse(fn); res[os.path.basename(fn)[:-5]]={'band':b,'lines':o}
json.dump(res,open(sys.argv[2],'w'),ensure_ascii=False)
