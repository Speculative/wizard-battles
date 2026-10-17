import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenario } from '../src/scenario';

test('centered projectile dodge ignores engine-scale side noise', async () => {
  const { LateralDodgeHandler } = await import('../src/handlers/lateralDodge');
  const { Vector3 } = await import('../src/math');
  const world = createScenario({ scenario: 'duel', seed: 1 });
  const self = world.contestants[0]; self.position.set(0, 33, 0); world.contestants.splice(1);
  const handler = new LateralDodgeHandler();
  const dodge = (side: number) => handler.handle(self, { id: 'projectileIncoming', payload: {
    spell: { velocity: new Vector3(100, 0, 0), position: new Vector3(-100, 33, side) } as any,
    closestApproachSq: 0, distance: 100,
  } }, world);
  assert.deepEqual(dodge(-1e-12), dodge(1e-12));
  assert.notDeepEqual(dodge(-.1), dodge(.1));
});

test('numerically tied candidate scores preserve their sampling order', async () => {
  const { pickBest } = await import('../src/tactics/helpers');
  const first = { pos: { x: 0, z: 1 }, score: 1 };
  assert.equal(pickBest([first, { pos: { x: 0, z: -1 }, score: 1 + 1e-14 }]), first);
  assert.notEqual(pickBest([first, { pos: { x: 0, z: -1 }, score: 1.01 }]), first);
});
