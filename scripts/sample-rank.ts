// Prints the ranking for the sample Night Lord: npx tsx scripts/sample-rank.ts
import { rank, bestPerItem } from '../src/engine/rank';
import { CLASS_BY_ID } from '../src/modules/damage.data';
import { damageModule } from '../src/modules/damage';
import { starforceModule } from '../src/modules/starforce';
import { cubeModule } from '../src/modules/cube';
import { flameModule } from '../src/modules/flame';
import { sampleNightLord } from '../tests/fixtures';
import { describeBundle } from '../src/core/bundle';

const s = sampleNightLord();
const r = rank(s, CLASS_BY_ID['night-lord'], { damage: damageModule, starforce: starforceModule, cube: cubeModule, flame: flameModule });
console.log(`${r.candidates.length} candidates in ${r.ms.toFixed(0)} ms; warnings: ${r.warnings.join(' | ') || 'none'}; unvalued ${r.unvalued.length}`);
console.log('weights', JSON.stringify(Object.fromEntries(Object.entries(r.weights).map(([k, v]) => [k, +(v as number).toFixed(2)]))));
for (const c of bestPerItem(r.candidates).slice(0, 25)) {
  console.log(`${(c.costPerFd / 1e9).toFixed(2).padStart(8)}B/1%  +${c.fdGain.toFixed(2)}%  ${(c.expectedCost / 1e9).toFixed(2)}B  ${c.slot.padEnd(9)} ${c.kind.padEnd(9)} ${c.label} | ${c.notes?.join(' · ')} | after ${describeBundle(c.after)}`);
}
