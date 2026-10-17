import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createScenario, SIMULATION_DT } from '../src/scenario';
import { World } from '../src/world';
import type { Sink, FrameSample } from '../src/telemetry';
import type { BasicWizard } from '../src/contestants/basicWizard';

class MemorySink implements Sink {
  events: unknown[] = [];
  event(type: string, who: string | null, meta: Record<string, unknown> = {}, t = 0): void {
    this.events.push({ t, type, who, meta });
  }
  frame(_sample: FrameSample): void {}
  flush(): void {}
  close(): void {}
}

function snapshot(world: World) {
  return {
    tick: world.tick, time: world.time,
    contestants: world.contestants.map(c => {
      const wizard = c as BasicWizard;
      return { id: c.id, position: c.position.toArray(), velocity: c.velocity.toArray(),
        facing: c.facing.toArray(), hp: c.hp, alive: c.alive,
        stamina: wizard.stamina01(), state: wizard.getMovementState(),
        tactic: wizard.getCurrentTacticId(), shots: wizard.getShotsFired(),
        cooldowns: [...wizard.getReadyAt()].map(([f, time]) => [f.metadata.id, time]) };
    }),
    spells: world.spells.map(s => ({ spell: s.metadata.id, caster: s.caster.id,
      position: s.position.toArray(), velocity: s.velocity.toArray(), dead: s.dead })),
  };
}

function run(seed: number) {
  const sink = new MemorySink();
  const world = createScenario({ seed, telemetry: sink });
  for (let i = 0; i < 18000 && world.contestants.filter(c => c.alive).length > 1; i++) {
    world.update(SIMULATION_DT);
  }
  return { state: snapshot(world), events: sink.events };
}

test('seeded full matches repeat complete state and semantic event streams', () => {
  for (const seed of [0, 1, 2, 3, 42]) assert.deepEqual(run(seed), run(seed));
  assert.notDeepEqual(run(1), run(2));
});

test('interleaving worlds with different schedules matches each run alone', () => {
  const seeds = [5, 21, 99];
  const ticks = [2400, 3600, 1800];
  const sinks = seeds.map(() => new MemorySink());
  const worlds = seeds.map((seed, index) => createScenario({ seed, telemetry: sinks[index] }));
  for (let i = 0; i < Math.max(...ticks); i++) {
    for (const index of i % 2 ? [2, 0, 1] : [1, 2, 0]) {
      if (i < ticks[index]) worlds[index].update(SIMULATION_DT);
    }
  }
  seeds.forEach((seed, index) => {
    const sink = new MemorySink();
    const solo = createScenario({ seed, telemetry: sink });
    for (let i = 0; i < ticks[index]; i++) solo.update(SIMULATION_DT);
    assert.deepEqual(snapshot(worlds[index]), snapshot(solo));
    assert.deepEqual(sinks[index].events, sink.events);
  });
});

test('simulation never consumes process-global randomness and telemetry is observational', () => {
  const originalRandom = Math.random;
  try {
    Math.random = () => { throw new Error('Gameplay reached Math.random'); };
    const world = createScenario({ seed: 8 });
    const observed = createScenario({ seed: 8, telemetry: {
      event(_type, _who, meta) { if (meta) meta.position = { x: Infinity }; },
      frame(sample) { sample.hp = -Infinity; }, flush() {}, close() {},
    } });
    for (let i = 0; i < 3600; i++) {
      world.update(SIMULATION_DT);
      observed.update(SIMULATION_DT);
    }
    assert.deepEqual(snapshot(world), snapshot(observed));
    assert.ok(world.events.every(event => event.t >= world.time - 2));
  } finally { Math.random = originalRandom; }
});

test('scenario configuration and ownership are isolated', () => {
  const movement = { running: { maxSpeed: 17 } };
  const a = createScenario({ seed: 9, bounds: { width: 800, depth: 800, height: 400 }, wizards: { red: { movement } } });
  const b = createScenario({ seed: 9 });
  movement.running.maxSpeed = 999;
  for (let i = 0; i < 60; i++) { a.update(SIMULATION_DT); b.update(SIMULATION_DT); }
  assert.notDeepEqual(snapshot(a), snapshot(b));
  assert.equal(b.bounds.width, 1000);
  assert.throws(() => a.addContestant(b.contestants[0]), /another world/);
  for (const dt of [0, -1, NaN, Infinity]) assert.throws(() => a.update(dt), /positive/);
  assert.throws(() => createScenario({ scenario: 'missing' }), /Unknown scenario/);
  assert.throws(() => createScenario({ variant: 'missing' }), /Unknown variant/);
});

test('headless import graph contains only simulation and standalone math modules', () => {
  const visited = new Set<string>();
  function visit(file: string) {
    if (visited.has(file)) return;
    visited.add(file);
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /new\s+(?:THREE\.)?(?:Mesh|Scene|Group|Camera|\w+Material|\w+Geometry)\b/);
    for (const match of source.matchAll(/import\s+(?!type\b)[^;]*?from\s+['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      assert.ok(specifier !== 'three' && !specifier.includes('presentation'), `${file} imports ${specifier}`);
      if (specifier.startsWith('.')) visit(resolve(dirname(file), `${specifier}.ts`));
    }
  }
  visit(resolve('src/scenario.ts'));
});
