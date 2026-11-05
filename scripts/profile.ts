import { CLASS_BY_ID } from '../src/modules/damage.data';
import { damageModule } from '../src/modules/damage';
import { starforceModule, sfSimConfig } from '../src/modules/starforce';
import { cubeModule } from '../src/modules/cube';
import { flameModule } from '../src/modules/flame';
import { sampleNightLord } from '../tests/fixtures';
import { ITEM_BY_ID } from '../src/data/items';
const s = sampleNightLord(); const cls = CLASS_BY_ID['night-lord'];
const w = damageModule.statWeights(s.equivalences, cls);
if (process.argv[2] === 'nosim') sfSimConfig.enabled = false;
for (const pass of [1, 2]) {
  let tsf = 0, tc = 0, tf = 0;
  for (const e of Object.values(s.equips)) {
    const it = ITEM_BY_ID[e!.itemId];
    let t = performance.now();
    for (const to of starforceModule.targets(it, e!.stars)) starforceModule.cost(it, e!.stars, to, s.market);
    tsf += performance.now() - t; t = performance.now();
    cubeModule.targets(it, e!, cls, false, s.market, w); tc += performance.now() - t; t = performance.now();
    flameModule.targets(it, e!, cls, s.market, w); tf += performance.now() - t;
  }
  console.log(`pass ${pass}: sf ${tsf.toFixed(0)}ms cube ${tc.toFixed(0)}ms flame ${tf.toFixed(0)}ms`);
}
