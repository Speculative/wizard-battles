import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPARISON_BRIEFS, comparisonBrief } from '../src/comparisonEvidence';
import { createScenario, SIMULATION_DT } from '../src/scenario';

// These assertions guard the content of the designer's argument. If gameplay
// changes, reselect and inspect evidence rather than keeping stale captions.
test('curated excerpts contain the events their captions describe', () => {
  for (const brief of COMPARISON_BRIEFS) for (const clip of brief.clips) {
    const events: { type: string; who: string | null; meta: Record<string, unknown>; time: number }[] = [];
    const world = createScenario({ scenario: brief.scenario, seed: brief.seed, variant: clip.variant,
      telemetry: { event(type, who, meta = {}, time = 0) { events.push({ type, who, meta, time }); }, frame() {}, flush() {}, close() {} },
    });
    let startHp: number[] = [];
    while (world.tick < Math.round(clip.end / SIMULATION_DT) && world.contestants.filter(c => c.alive).length > 1) {
      if (world.tick === Math.round(clip.start / SIMULATION_DT)) startHp = world.contestants.map(c => c.hp);
      world.update(SIMULATION_DT);
    }
    const during = events.filter(e => e.time >= clip.start && e.time <= clip.end);
    const damage = during.filter(e => e.type === 'damage');
    const label = `${brief.id}/${clip.variant}`;
    if (brief.id === 'stalled-duel' && clip.variant === 'measured') {
      assert.deepEqual(startHp, [30, 90]);
      assert.deepEqual(world.contestants.map(c => c.hp), [30, 90]);
      assert.equal(damage.length, 0, label);
      assert.ok(during.some(e => e.type === 'cast_release'), 'stall includes active casting, not an empty arena');
      while (world.tick < 7200) world.update(SIMULATION_DT);
      assert.deepEqual(world.contestants.map(c => c.hp), [30, 90], 'stall lasts to the time limit');
      const lastDamage = events.filter(e => e.type === 'damage').at(-1)!;
      assert.ok(Math.abs(lastDamage.time - 16.98) < .01);
    } else if (brief.scenario === 'duel') {
      assert.ok(world.contestants[0].alive && !world.contestants[1].alive, label);
      assert.ok(during.some(e => e.type === 'death' && e.who === 'blue'), label);
      assert.equal(damage.filter(e => e.who === 'red').length, clip.variant === 'baseline' ? 5 : 2, label);
      if (clip.variant === 'burst') assert.equal(damage.filter(e => e.who === 'blue').length, 2, label);
    } else if (clip.variant === 'baseline') {
      assert.equal(damage.length, 4, label);
      assert.ok(damage.every(e => e.who === 'red' && e.meta.victim === 'blue'), label);
      assert.equal(world.contestants[0].hp, 100, label);
    } else {
      const greenFalls = during.find(e => e.type === 'death' && e.who === 'green')!;
      const yellowHits = damage.filter(e => e.who === 'yellow' && e.meta.victim === 'red');
      const redHits = damage.filter(e => e.who === 'red' && e.meta.victim === 'yellow');
      assert.ok(greenFalls, label); assert.equal(yellowHits.length, 2, label); assert.equal(redHits.length, 3, label);
      assert.ok(greenFalls.time < yellowHits[0].time && yellowHits[1].time < redHits[0].time, label);
      assert.ok(world.contestants.find(c => c.id === 'blue')!.alive, label);
    }
  }
});

test('curation applies only to its documented setups', () => {
  assert.equal(comparisonBrief('duel', 1, Math.PI / 2), undefined);
  assert.equal(comparisonBrief('duel', 211, 0), undefined);
});
