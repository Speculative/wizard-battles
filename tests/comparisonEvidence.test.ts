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

import { SPELL_BRIEFS } from '../src/spellReadabilityExperiment';
test('spell readability clips retain their hit, miss and crowd evidence', () => {
  for (const brief of SPELL_BRIEFS) {
    const [current, cues] = brief.clips;
    assert.deepEqual([current.start, current.end], [cues.start, cues.end], 'matched actions isolate presentation');
    const events: { type: string; who: string | null; meta: Record<string, unknown>; t: number }[] = [];
    const world = createScenario({ scenario: brief.scenario, seed: brief.seed, variant: 'burst',
      telemetry: { event(type, who, meta = {}, t = 0) { events.push({ type, who, meta, t }); }, frame() {}, flush() {}, close() {} } });
    while (world.tick < Math.round(current.end / SIMULATION_DT) && world.contestants.filter(c => c.alive).length > 1) world.update(SIMULATION_DT);
    const during = events.filter(e => e.t >= current.start && e.t <= current.end);
    const near = (type: string, who: string, t: number) => during.find(e => e.type === type && e.who === who && Math.abs(e.t-t) < .01);
    if (brief.id === 'spell-duel-hit-miss') {
      assert.ok(near('damage','blue',9.25)); assert.ok(near('damage','blue',11.18));
      assert.ok(near('cast_release','red',9.63));
      assert.equal(during.filter(e => e.type === 'damage' && e.t > 9.6 && e.t < 10.1).length, 0);
      assert.ok(near('damage','red',11.43)); assert.ok(near('death','blue',12.22));
    } else if (brief.id === 'spell-intersection') {
      assert.ok(near('death','green',6.98)); assert.ok(near('damage','yellow',7.57)); assert.ok(near('damage','yellow',7.60));
      assert.ok(near('damage','red',8.52)); assert.ok(near('damage','red',9.30));
      assert.ok(near('spell_impact','green',7.23));
      assert.equal(during.filter(e => e.type === 'damage' && e.meta.spell === 'iceShard').length,0);
      assert.ok(world.contestants.find(c => c.id === 'blue')!.alive);
    } else {
      assert.equal(during.filter(e => e.type === 'projectile_emit' && e.who === 'green').length,5);
      assert.equal(during.filter(e => e.type === 'projectile_emit' && e.who === 'yellow').length,6);
      assert.equal(during.filter(e => e.type === 'damage' && e.who === 'green').length,3);
      assert.equal(during.filter(e => e.type === 'damage' && e.who === 'red').length,3);
      assert.ok(near('spell_impact','green',2.32));
      assert.equal(during.filter(e => e.type === 'damage' && e.meta.spell === 'iceShard').length,0);
    }
  }
});
