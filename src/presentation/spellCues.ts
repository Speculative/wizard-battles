import * as THREE from 'three';
import type { SimulationEvent } from '../world';
import { glow, ring } from './primitives';

/** A short pointer, not a prediction of the shot's eventual path or range. */
export function preparationPointer(color: number) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    32, 1, -3, 68, 1, -3, 32, 1, 3,
    32, 1, 3, 68, 1, -3, 68, 1, 3,
    62, 1, -11, 82, 1, 0, 62, 1, 11,
  ], 3));
  const pointer = new THREE.Mesh(geometry, glow(color, 0.7));
  pointer.name = 'preparation-direction';
  return pointer;
}

/** Damage is distinct from an explosion. Positions come from the event tick. */
export function semanticCue(event: SimulationEvent) {
  const group = new THREE.Group();
  group.name = `cue:${event.type}:${event.seq}`;
  const position = event.meta.position as { x: number; y: number; z: number } | undefined;
  if (!position) return { group, update: (_age: number) => {} };
  group.position.set(position.x, Math.max(2, position.y), position.z);
  const damage = event.type === 'damage';
  const lifetime = damage ? 0.36 : 0.18;
  const pulse = ring(damage ? 27 : 21, damage ? 0xffffff : 0xffe8a3, 0.9);
  const backing = ring(damage ? 30 : 24, 0x172333, 0.9);
  backing.geometry.dispose();
  backing.geometry = new THREE.RingGeometry(damage ? 23 : 17, damage ? 30 : 24, 48);
  group.add(backing);
  pulse.name = damage ? 'confirmed-hit' : 'release-pulse';
  group.add(pulse);
  // Small upright cross catches the eye even at the arena's shallow angle.
  if (damage) {
    for (const angle of [-Math.PI / 4, Math.PI / 4]) {
      const slash = new THREE.Mesh(new THREE.PlaneGeometry(5, 32), glow(0xffffff));
      const outline = new THREE.Mesh(new THREE.PlaneGeometry(9, 36), glow(0x172333));
      outline.position.set(0, 24, -0.1);
      outline.rotation.z = angle;
      group.add(outline);
      slash.position.y = 24;
      slash.rotation.z = angle;
      group.add(slash);
    }
  }
  return { group, update(age: number) {
    group.visible = age >= 0 && age < lifetime;
    pulse.scale.setScalar(0.65 + age / lifetime * 0.9);
    backing.scale.copy(pulse.scale);
    group.traverse(object => {
      if (object instanceof THREE.Mesh) (object.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - age / lifetime);
    });
  } };
}
