// Runs the ranking off the main thread so typing never stutters.
import type { Modules } from '../core/modules';
import { CLASSES, CLASS_BY_ID } from '../modules/damage.data';
import { damageModule } from '../modules/damage';
import { starforceModule } from '../modules/starforce';
import { cubeModule } from '../modules/cube';
import { flameModule } from '../modules/flame';
import { rank } from './rank';
import type { AppSetup } from '../state';

const modules: Modules = { damage: damageModule, starforce: starforceModule, cube: cubeModule, flame: flameModule };

self.onmessage = (e: MessageEvent<{ id: number; setup: AppSetup }>) => {
  const { id, setup } = e.data;
  try {
    const cls = CLASS_BY_ID[setup.equivalences.classId] ?? CLASSES[0];
    (self as unknown as Worker).postMessage({ id, result: rank(setup, cls, modules) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: (err as Error).message });
  }
};
