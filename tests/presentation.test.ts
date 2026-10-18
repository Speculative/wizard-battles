import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createScenario, SIMULATION_DT } from '../src/scenario';
import { BattleView } from '../src/presentation/battleView';
import { World } from '../src/world';
import { semanticCue } from '../src/presentation/spellCues';

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

test('spell cues preserve complete C fights and reconstruct after seeking', () => {
  const camera = new THREE.OrthographicCamera();
  for (const scenario of ['duel', 'four-wizards']) for (const seed of [1, 19, 101]) {
    const worlds = [false, true].map(() => createScenario({ seed, scenario, variant: 'burst' }));
    const views = worlds.map((world, i) => new BattleView(world, camera, { spellReadability: !!i }));
    for (let tick = 0; tick < 7200; tick++) {
      for (let i = 0; i < 2; i++) { worlds[i].update(SIMULATION_DT); views[i].recordTick(); }
      if (tick % 13 === 0) views.forEach(view => view.render());
      if (tick % 60 === 0) assert.deepEqual(state(worlds[0]), state(worlds[1]));
      if (worlds[0].contestants.filter(c => c.alive).length <= 1) break;
    }
    assert.deepEqual(state(worlds[0]), state(worlds[1]));
    assert.equal(worlds[0].random(), worlds[1].random());
    views.forEach(view => view.render());
    const restored = new BattleView(worlds[1], camera, { spellReadability: true });
    // Trail history is supplied by per-tick sampling, unlike event-based cues.
    const cueVisuals = (view: BattleView) => view.group.children.filter(c => c.name.startsWith('cue:')).map(c => {
      c.updateMatrixWorld(true);
      return { name: c.name, visible: c.visible, matrix: c.matrixWorld.toArray() };
    });
    restored.render();
    assert.deepEqual(cueVisuals(views[1]), cueVisuals(restored));
    views.forEach(view => view.dispose()); restored.dispose();
  }
});

test('damage markers require damage and remain at the recorded hit location', () => {
  const world = new World();
  world.emit('damage', 'red', { victim: 'blue', amount: 22, position: { x: 10, y: 0, z: 30 } });
  const cue = semanticCue(world.events[0]);
  cue.update(0.1);
  assert.ok(cue.group.children.some(c => c.name === 'confirmed-hit'));
  assert.deepEqual(cue.group.position.toArray(), [10, 2, 30]);
  cue.update(0.4);
  assert.equal(cue.group.visible, false);
  const view = new BattleView(world, new THREE.OrthographicCamera(), { spellReadability: true });
  view.render();
  assert.ok(view.group.children.some(c => c.name.startsWith('cue:damage:')));
  world.events.length = 0;
  world.emit('spell_impact', 'red', { position: { x: 0, y: 0, z: 0 } });
  view.render();
  assert.ok(!view.group.children.some(c => c.name.startsWith('cue:damage:')));
  view.dispose();
});
