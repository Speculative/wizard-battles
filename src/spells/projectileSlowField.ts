import * as THREE from "three";
import type { Spell, SpellFactory, SpellMetadata } from "./spell";
import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";

const FIELD_RADIUS = 130;
const FIELD_HEIGHT = 110;
const DURATION = 4.0;
const SLOW_SCALE = 0.25;

export const PROJECTILE_SLOW_FIELD_METADATA: SpellMetadata = {
  id: "projectileSlowField",
  kind: "zone",
  element: "water",
  range: { min: 0, max: 180 },
  chargeTime: 0.4,
  cooldown: 6.0,
  tags: ["zone", "slow", "antiprojectile", "defensive"],
};

interface SlowedEntry {
  originalSpeed: number;
}

export class ProjectileSlowField implements Spell {
  readonly mesh: THREE.Object3D;
  readonly position: THREE.Vector3;
  readonly velocity = new THREE.Vector3();
  readonly caster: Contestant;
  readonly metadata = PROJECTILE_SLOW_FIELD_METADATA;
  frozen = false;
  dead = false;
  private age = 0;
  private readonly slowed = new Map<Spell, SlowedEntry>();
  private readonly domeMat: THREE.MeshBasicMaterial;
  private readonly ringMat: THREE.LineBasicMaterial;

  constructor(caster: Contestant, origin: THREE.Vector3) {
    this.caster = caster;
    this.position = origin.clone();
    this.position.y = 0;

    const group = new THREE.Group();
    const domeGeo = new THREE.SphereGeometry(
      FIELD_RADIUS,
      32,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2
    );
    domeGeo.scale(1, FIELD_HEIGHT / FIELD_RADIUS, 1);
    this.domeMat = new THREE.MeshBasicMaterial({
      color: 0x66aaff,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const dome = new THREE.Mesh(domeGeo, this.domeMat);
    dome.renderOrder = 3;
    group.add(dome);

    const ringPositions: number[] = [];
    const ringSegments = 48;
    for (let i = 0; i <= ringSegments; i++) {
      const a = (i / ringSegments) * Math.PI * 2;
      ringPositions.push(
        Math.cos(a) * FIELD_RADIUS,
        1,
        Math.sin(a) * FIELD_RADIUS
      );
    }
    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(ringPositions, 3)
    );
    this.ringMat = new THREE.LineBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.7,
    });
    const ring = new THREE.LineLoop(ringGeo, this.ringMat);
    ring.renderOrder = 4;
    group.add(ring);

    group.position.copy(this.position);
    this.mesh = group;
  }

  update(dt: number, world: World): void {
    if (this.frozen) return;
    this.age += dt;
    if (this.age >= DURATION) {
      this.restoreAll();
      this.dead = true;
      return;
    }

    const t = this.age / DURATION;
    const fade = t < 0.1 ? t / 0.1 : t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1;
    this.domeMat.opacity = 0.22 * fade;
    this.ringMat.opacity = 0.7 * fade;

    const currentInside = new Set<Spell>();
    for (const s of world.spells) {
      if (s === this) continue;
      if (s.metadata.kind !== "projectile") continue;
      if (s.metadata.baseSpeed === undefined) continue;
      const dx = s.position.x - this.position.x;
      const dz = s.position.z - this.position.z;
      if (dx * dx + dz * dz <= FIELD_RADIUS * FIELD_RADIUS) {
        currentInside.add(s);
      }
    }

    for (const s of currentInside) {
      if (!this.slowed.has(s)) {
        const speed = Math.hypot(s.velocity.x, s.velocity.z);
        if (speed < 1e-3) continue;
        this.slowed.set(s, { originalSpeed: s.metadata.baseSpeed! });
        const k = (speed * SLOW_SCALE) / speed;
        s.velocity.x *= k;
        s.velocity.z *= k;
      }
    }

    for (const [s, entry] of this.slowed) {
      if (!currentInside.has(s)) {
        if (!s.dead) this.restoreSpeed(s, entry);
        this.slowed.delete(s);
      }
    }
  }

  private restoreSpeed(s: Spell, entry: SlowedEntry): void {
    const speed = Math.hypot(s.velocity.x, s.velocity.z);
    if (speed < 1e-3) return;
    const k = entry.originalSpeed / speed;
    s.velocity.x *= k;
    s.velocity.z *= k;
  }

  private restoreAll(): void {
    for (const [s, entry] of this.slowed) {
      if (!s.dead) this.restoreSpeed(s, entry);
    }
    this.slowed.clear();
  }
}

export const ProjectileSlowFieldFactory: SpellFactory = {
  metadata: PROJECTILE_SLOW_FIELD_METADATA,
  create(caster) {
    return new ProjectileSlowField(caster, caster.position);
  },
};
