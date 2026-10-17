import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createScenario, SIMULATION_DT } from '../src/scenario';
import { BattleView } from '../src/presentation/battleView';
import { World } from '../src/world';

function state(world: World) {
  return { tick: world.tick, time: world.time, events: world.events,
    contestants: world.contestants.map(c => ({ id: c.id, position: c.position.toArray(),
      velocity: c.velocity.toArray(), facing: c.facing.toArray(), hp: c.hp, alive: c.alive })),
    spells: world.spells.map(s => ({ id: s.metadata.id, caster: s.caster.id,
      position: s.position.toArray(), velocity: s.velocity.toArray() })) };
}

/** Compare rendered numeric data without GPU allocation or random Three.js UUIDs. */
function visuals(view: BattleView) {
  const result: string[] = [];
  view.group.updateMatrixWorld(true);
  view.group.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    result.push(JSON.stringify({ matrix: object.matrixWorld.toArray(),
      geometry: object.geometry.type,
      parameters: (object.geometry as THREE.SphereGeometry).parameters,
      materials: materials.map(material => ({ type: material.type, opacity: material.opacity,
        color: (material as THREE.MeshBasicMaterial).color?.getHex() })) }));
  });
  return result.sort();
}

test('render cadence, visual seed and disabled effects leave gameplay unchanged', () => {
  const worlds = Array.from({ length: 4 }, () => createScenario({ seed: 42 }));
  const camera = new THREE.OrthographicCamera();
  const views = [new BattleView(worlds[0], camera), new BattleView(worlds[1], camera),
    new BattleView(worlds[2], camera, { visualSeed: 7 }),
    new BattleView(worlds[3], camera, { effects: false, trails: false })];
  for (let tick = 0; tick < 1200; tick++) {
    worlds.forEach(world => world.update(SIMULATION_DT));
    views.forEach(view => view.recordTick());
    views[0].render();
    if (tick % 37 === 0) views[1].render();
    if (tick % 11 === 0) views[2].render();
  }
  views.forEach(view => view.render());
  worlds.slice(1).forEach(world => assert.deepEqual(state(world), state(worlds[0])));
  assert.deepEqual(visuals(views[0]), visuals(views[1]));
  const before = visuals(views[0]);
  views[0].render();
  assert.deepEqual(visuals(views[0]), before);
  assert.equal(worlds[0].random(), worlds[1].random());
  views.forEach(view => view.dispose());
});

test('particles reconstruct from event time and seed, then expire and dispose', () => {
  const world = new World({ seed: 2 });
  world.emit('spell_impact', 'test', { position: { x: 1, y: 2, z: 3 },
    radius: 50, visual: { impact: { explosionCoreColor: 0x123456 } } });
  const scene = new THREE.Scene();
  const view = new BattleView(world, new THREE.OrthographicCamera(), { visualSeed: 3 });
  scene.add(view.group);
  view.render();
  for (let tick = 0; tick < 12; tick++) { world.update(SIMULATION_DT); view.recordTick(); }
  view.render();
  const restored = new BattleView(world, new THREE.OrthographicCamera(), { visualSeed: 3 });
  restored.render();
  assert.deepEqual(visuals(view), visuals(restored));
  const particle = view.group.children[0].children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  assert.equal(particle.material.color.getHex(), 0x123456);
  let disposed = false;
  particle.geometry.addEventListener('dispose', () => { disposed = true; });
  for (let tick = 0; tick < 60; tick++) world.update(SIMULATION_DT);
  view.render();
  assert.equal(view.group.children.length, 0);
  assert.equal(disposed, true);
  view.dispose(); restored.dispose();
  assert.equal(scene.children.length, 0);
});
