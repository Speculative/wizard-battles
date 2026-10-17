import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRun, aggregate } from '../scripts/experiment-report';
import { createScenario, SIMULATION_DT } from '../src/scenario';
import { VARIANTS } from '../src/experiment';

test('report includes boundary gaps, final damage HP, and omits refusal noise', () => {
  const run = summarizeRun({ runId: 'test', scenario: 'duel', seed: 1, rotation: 0, variant: 'baseline', reason: 'win', winner: 'red', duration: 30 }, [
    { t: 2, type: 'cast_request', who: 'red', meta: { accepted: false } },
    { t: 3, type: 'damage', who: 'red', meta: { victim: 'blue', hpAfter: 50, amount: 50, spell: 'fireball' } },
    { t: 20, type: 'damage', who: 'red', meta: { victim: 'blue', hpAfter: -5, amount: 55, spell: 'fireball' } },
  ], [{ t: 0, who: 'blue', hp: 100, vx: 3, vz: 4, state: 'running' }]);
  assert.equal(run.hp.blue, -5); assert.equal(run.maxDamageGap, 17); assert.equal(run.meanSpeed, 5);
  assert.equal(run.evidence.length, 2); assert.equal(run.damageBySpell.fireball, 105);
  const summary = aggregate([run]); assert.deepEqual(summary[0].winners, { red: 1 }); assert.equal(summary[0].damageEvents.mean, 2);
  const empty = summarizeRun({ ...run, duration: 30 }, [], []);
  assert.equal(empty.maxDamageGap, 30); assert.equal(empty.firstDamage, null);
});

test('variant interleaving preserves repeatability and changes behavior', () => {
  const config = { scenario: 'duel', seed: 7 };
  const worlds = VARIANTS.map(v => createScenario({ ...config, variant: v.id }));
  for (let i = 0; i < 900; i++) for (const w of worlds) w.update(SIMULATION_DT);
  const state = (w: typeof worlds[number]) => w.contestants.map(c => ({ hp: c.hp, position: { ...c.position } }));
  for (const [i, variant] of VARIANTS.entries()) {
    const alone = createScenario({ ...config, variant: variant.id }); for (let tick = 0; tick < 900; tick++) alone.update(SIMULATION_DT);
    assert.deepEqual(state(worlds[i]), state(alone));
  }
  assert.notDeepEqual(state(worlds[0]), state(worlds[1])); assert.notDeepEqual(state(worlds[0]), state(worlds[2]));
});

