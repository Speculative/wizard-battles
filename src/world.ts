import * as THREE from "three";
import type { Contestant } from "./contestants/contestant";
import type { Spell } from "./spells/spell";
import { ARENA } from "./config";

export class World {
  readonly scene: THREE.Scene;
  readonly contestants: Contestant[] = [];
  readonly spells: Spell[] = [];
  readonly bounds = ARENA;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  addContestant(c: Contestant): void {
    this.contestants.push(c);
    this.scene.add(c.mesh);
  }

  addSpell(s: Spell): void {
    this.spells.push(s);
    this.scene.add(s.mesh);
  }

  removeSpell(s: Spell): void {
    const i = this.spells.indexOf(s);
    if (i >= 0) this.spells.splice(i, 1);
    this.scene.remove(s.mesh);
  }

  update(dt: number): void {
    for (const c of this.contestants) c.update(dt, this);
    this.resolveContestantCollisions();
    for (let i = this.spells.length - 1; i >= 0; i--) {
      const s = this.spells[i];
      s.update(dt, this);
      if (s.dead) this.removeSpell(s);
    }
  }

  private resolveContestantCollisions(): void {
    const list = this.contestants;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.alive) continue;
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const distSq = dx * dx + dz * dz;
        const minDist = a.radius + b.radius;
        if (distSq >= minDist * minDist || distSq === 0) continue;
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;
        const nx = dx / dist;
        const nz = dz / dist;
        const push = overlap / 2;
        a.position.x -= nx * push;
        a.position.z -= nz * push;
        b.position.x += nx * push;
        b.position.z += nz * push;
        a.mesh.position.copy(a.position);
        b.mesh.position.copy(b.position);
      }
    }
  }
}
