import * as THREE from 'three';
import type { SimulationEvent } from '../world';
import type { ArtStyle } from './artDirection';
import { glow, ring } from './primitives';

export type SpellReadability = boolean | 'rings' | 'reaction';

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


/** Revised releases use warm airborne sparks; only damage gets a ground ring.
 * Billboard sparks are deliberately small and do not encode attack direction. */
export function revisedSemanticCue(event: SimulationEvent, mode: 'rings' | 'reaction', camera: THREE.Camera, style?: ArtStyle) {
  const group = new THREE.Group();
  group.name = `cue:${event.type}:${event.seq}`;
  const p = event.meta.position as { x: number; y: number; z: number } | undefined;
  const damage = event.type === 'damage';
  const lifetime = damage ? 0.32 : 0.16;
  const marks: THREE.Mesh[] = [];
  if (p) group.position.set(p.x, damage && mode === 'rings' ? 2 : p.y + 14, p.z);
  if (damage && mode === 'rings') {
    const backing = ring(38, 0x29344a, 0.8);
    backing.geometry.dispose(); backing.geometry = new THREE.RingGeometry(29, 38, 48);
    const hit = ring(35, 0xfff0bf, 1);
    hit.name = 'confirmed-hit';
    group.add(backing, hit); marks.push(backing, hit);
  } else {
    group.quaternion.copy(camera.quaternion);
    const count = damage ? 7 : 4;
    for (let i = 0; i < count; i++) {
      const spark = new THREE.Mesh(new THREE.PlaneGeometry(damage ? 5 : style?.id === 'paper' ? 7 : 3, damage ? 18 : style?.id === 'paper' ? 7 : 12), glow(damage ? 0xfff0c2 : style?.fireCore ?? 0xffba4a));
      spark.name = damage ? 'hit-spark' : 'release-spark';
      // Small sparks stay readable at the body surface instead of clipping into it.
      (spark.material as THREE.MeshBasicMaterial).depthTest = false;
      spark.renderOrder = 5;
      spark.rotation.z = -i / count * Math.PI * 2;
      marks.push(spark); group.add(spark);
    }
  }
  return { group, update(age: number) {
    group.visible = !!p && age >= 0 && age < lifetime;
    const progress = Math.max(0, Math.min(1, age / lifetime));
    if (!(damage && mode === 'rings')) group.quaternion.copy(camera.quaternion);
    for (const [i, mark] of marks.entries()) {
      (mark.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * (damage ? 0.95 : 0.8);
      if (damage && mode === 'rings') mark.scale.setScalar(0.85 + progress * 0.7);
      else {
        const angle = i / marks.length * Math.PI * 2;
        const radius = (damage ? 20 : 10) + progress * (damage ? 28 : 18);
        mark.position.set(Math.sin(angle) * radius, Math.cos(angle) * radius, 0);
        mark.scale.y = 1 - progress * 0.65;
      }
    }
  } };
}
