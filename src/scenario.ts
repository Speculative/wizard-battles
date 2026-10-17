import { Vector3 } from './math';
import { World, type WorldOptions } from './world';
import { BasicWizard, type BasicWizardOptions } from './contestants/basicWizard';
import { redRoster, blueRoster, greenRoster, yellowRoster } from './rosters';
import { FireballFactory } from './spells/fireball';
import { MeleeFactory } from './spells/meleeAttack';
import { ProjectileSlowFieldFactory } from './spells/projectileSlowField';
import { BlinkFactory } from './spells/blink';
import { IceShardFactory } from './spells/iceShard';
import { IceBoltFactory } from './spells/iceBolt';
import { Heavy, Spread, Swarm, Gatling } from './spells/modifiers';

export const SIMULATION_DT = 1 / 60;
export const SCENARIO_ID = 'four-wizards';
export const SCENARIO_IDS = [SCENARIO_ID, 'duel'] as const;
export interface ScenarioOptions extends WorldOptions {
  scenario?: string;
  variant?: string;
  /** Rotate initial positions/facing in radians, useful for matched starting-layout trials. */
  rotation?: number;
  /** Experiment overrides are copied into each contestant, never shared mutable state. */
  wizards?: Partial<Record<'red' | 'blue' | 'green' | 'yellow',
    Pick<BasicWizardOptions, 'movement' | 'spellbook' | 'modifiers'>>>;
}

/** Both entry points construct fresh tactic instances and world-owned configuration. */
export function createScenario(options: ScenarioOptions = {}): World {
  if (options.scenario && !SCENARIO_IDS.includes(options.scenario as typeof SCENARIO_IDS[number])) {
    throw new Error(`Unknown scenario: ${options.scenario}`);
  }
  if (options.variant && options.variant !== 'baseline') {
    throw new Error(`Unknown variant: ${options.variant}`);
  }
  if (options.rotation !== undefined && !Number.isFinite(options.rotation)) throw new Error('rotation must be finite');
  const world = new World(options);
  const random = world.random;
  world.addContestant(new BasicWizard({
    world, id: 'red', color: 0xff2244, start: new Vector3(-300, 0, -150),
    roster: redRoster(random), spellbook: [MeleeFactory, ProjectileSlowFieldFactory, FireballFactory],
    ...options.wizards?.red,
  }));
  world.addContestant(new BasicWizard({
    world, id: 'blue', color: 0x2266ff, start: new Vector3(300, 0, 150),
    roster: blueRoster(random), spellbook: [FireballFactory, BlinkFactory],
    ...options.wizards?.blue,
  }));
  if (options.scenario !== 'duel') {
  world.addContestant(new BasicWizard({
    world, id: 'green', color: 0x22cc55, start: new Vector3(-300, 0, 200),
    roster: greenRoster(random), spellbook: [IceShardFactory, IceBoltFactory], modifiers: [Spread],
    ...options.wizards?.green,
  }));
  world.addContestant(new BasicWizard({
    world, id: 'yellow', color: 0xffdd22, start: new Vector3(300, 0, -200),
    roster: yellowRoster(random), spellbook: [FireballFactory], modifiers: [Heavy, Spread, Swarm, Gatling],
    ...options.wizards?.yellow,
  }));
  }
  const rotation = options.rotation ?? 0;
  const cosine = Math.cos(rotation), sine = Math.sin(rotation);
  for (const c of world.contestants) {
    const { x, z } = c.position;
    c.position.set(x * cosine - z * sine, c.position.y, x * sine + z * cosine);
    const { x: fx, z: fz } = c.facing;
    c.facing.set(fx * cosine - fz * sine, 0, fx * sine + fz * cosine);
  }
  return world;
}
