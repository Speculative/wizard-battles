import * as THREE from "three";
import type { ProjectileTelegraphSpec } from "../spells/projectile";
const TELEGRAPH_GROUND_Y = 0.4;

interface TelegraphEmissionProgress {
  fired: number;
  total: number;
}

interface Telegraph {
  readonly mesh: THREE.Object3D;
  update(
    casterPos: THREE.Vector3,
    aimDir: THREE.Vector3,
    t: number,
    emission?: TelegraphEmissionProgress
  ): void;
  dispose(): void;
}

export function createTelegraph(spec: ProjectileTelegraphSpec): Telegraph {
  if (spec.kind === "ground-fan") return new TelegraphFan(spec);
  if (spec.kind === "orbiting-orbs") return new TelegraphOrbiters(spec);
  if (spec.kind === "stacked-orbs") return new TelegraphStack(spec);
  return new TelegraphCircle(spec);
}

class TelegraphCircle implements Telegraph {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly maxRadius: number;
  private disposed = false;

  constructor(spec: { color: number; maxRadius: number }) {
    this.maxRadius = spec.maxRadius;
    const geo = new THREE.RingGeometry(0.85, 1.0, 48, 1);
    this.material = new THREE.MeshBasicMaterial({
      color: spec.color,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 5;
    this.mesh = mesh;
  }

  update(
    casterPos: THREE.Vector3,
    _aimDir: THREE.Vector3,
    t: number,
    _emission?: TelegraphEmissionProgress
  ): void {
    if (this.disposed) return;
    const radius = this.maxRadius;
    this.mesh.scale.set(radius, radius, 1);
    this.mesh.position.set(casterPos.x, TELEGRAPH_GROUND_Y, casterPos.z);
    const pulse = 0.6 + 0.4 * Math.sin(t * Math.PI * 8);
    this.material.opacity = (0.35 + 0.5 * t) * pulse;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.material.dispose();
    (this.mesh.geometry as THREE.BufferGeometry).dispose();
  }
}

class TelegraphFan implements Telegraph {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly length: number;
  private disposed = false;

  constructor(spec: { color: number; length: number; arcRadians: number }) {
    this.length = spec.length;
    // Pie-slice built as a partial ring with near-zero inner radius, then
    // baked flat into the XZ plane so we only need to spin the mesh
    // around Y to point at the aim direction.
    const segments = 24;
    const geo = new THREE.RingGeometry(
      0.001,
      1.0,
      segments,
      1,
      -spec.arcRadians / 2,
      spec.arcRadians
    );
    geo.rotateX(-Math.PI / 2);
    this.material = new THREE.MeshBasicMaterial({
      color: spec.color,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.renderOrder = 5;
    this.mesh = mesh;
  }

  update(
    casterPos: THREE.Vector3,
    aimDir: THREE.Vector3,
    t: number,
    _emission?: TelegraphEmissionProgress
  ): void {
    if (this.disposed) return;
    const radius = this.length;
    this.mesh.scale.set(radius, 1, radius);
    this.mesh.position.set(casterPos.x, TELEGRAPH_GROUND_Y, casterPos.z);
    const len = Math.hypot(aimDir.x, aimDir.z);
    if (len > 1e-4) {
      // RingGeometry was built centered on +X (in XY before rotateX). After
      // baking the X rotation, the wedge points along world +X. To align
      // its forward direction with (aimDir.x, aimDir.z), rotate around Y by
      // atan2(-aim.z, aim.x) — see derivation in commit message.
      const ax = aimDir.x / len;
      const az = aimDir.z / len;
      this.mesh.rotation.y = Math.atan2(-az, ax);
    }
    const pulse = 0.6 + 0.4 * Math.sin(t * Math.PI * 8);
    this.material.opacity = (0.25 + 0.45 * t) * pulse;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.material.dispose();
    (this.mesh.geometry as THREE.BufferGeometry).dispose();
  }
}

class TelegraphOrbiters implements Telegraph {
  readonly mesh: THREE.Group;
  private readonly orbs: THREE.Mesh[];
  private readonly material: THREE.MeshBasicMaterial;
  private readonly geometry: THREE.SphereGeometry;
  private readonly orbitRadius: number;
  private readonly count: number;
  private disposed = false;

  constructor(spec: {
    color: number;
    count: number;
    orbitRadius: number;
    orbSize: number;
  }) {
    this.orbitRadius = spec.orbitRadius;
    this.count = spec.count;
    this.geometry = new THREE.SphereGeometry(spec.orbSize, 12, 8);
    this.material = new THREE.MeshBasicMaterial({
      color: spec.color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.orbs = [];
    const group = new THREE.Group();
    for (let i = 0; i < spec.count; i++) {
      const m = new THREE.Mesh(this.geometry, this.material);
      m.renderOrder = 6;
      group.add(m);
      this.orbs.push(m);
    }
    this.mesh = group;
  }

  update(
    casterPos: THREE.Vector3,
    aimDir: THREE.Vector3,
    t: number,
    _emission?: TelegraphEmissionProgress
  ): void {
    if (this.disposed) return;
    const aimLen = Math.hypot(aimDir.x, aimDir.z);
    if (aimLen < 1e-4) return;
    const ax = aimDir.x / aimLen;
    const az = aimDir.z / aimLen;
    const aimAngle = Math.atan2(az, ax);

    // Three phases over the charge window:
    //   [0, spawnEnd]            — orbs born one-by-one from facing direction
    //   each orb takes spiralDur after birth to spiral out into its slot
    //   [spawnEnd+spiralDur, collectStart]  — all 8 in stable orbit
    //   [collectStart, 1]        — orbit shrinks and drifts forward into a
    //                              tight cluster ahead of caster
    const spawnEnd = 0.5;
    const spiralDur = 0.15;
    const collectStart = 0.78;
    const orbitRotations = 3;
    const orbitPhase = 2 * Math.PI * orbitRotations * t;

    // Orbit center & radius depend only on global phase, not per-orb.
    let cx = casterPos.x;
    let cz = casterPos.z;
    let radius = this.orbitRadius;
    if (t > collectStart) {
      const cp = Math.min(1, (t - collectStart) / (1 - collectStart));
      const eased = cp * cp;
      cx += ax * this.orbitRadius * 0.7 * eased;
      cz += az * this.orbitRadius * 0.7 * eased;
      radius = this.orbitRadius * (1 - eased * 0.85);
    }

    for (let i = 0; i < this.count; i++) {
      const orb = this.orbs[i];
      const birth =
        this.count <= 1 ? 0 : (i / (this.count - 1)) * spawnEnd;
      const slotAngle = (i / this.count) * Math.PI * 2;
      const spiralEnd = birth + spiralDur;

      if (t < birth) {
        orb.visible = false;
        continue;
      }
      orb.visible = true;

      let px: number;
      let pz: number;
      if (t < spiralEnd) {
        // Spiral out from caster along facing direction. The end angle is
        // chosen so the orb seamlessly joins its orbit slot at the moment
        // it finishes spiraling — extra +4π adds two visible rotations
        // during the spiral arc.
        const progress = (t - birth) / spiralDur;
        const eased = 1 - (1 - progress) * (1 - progress);
        const orbitAngleAtJoin =
          slotAngle + 2 * Math.PI * orbitRotations * spiralEnd;
        const endAngle = orbitAngleAtJoin + 4 * Math.PI;
        const angle = aimAngle + (endAngle - aimAngle) * eased;
        const orbR = this.orbitRadius * eased;
        px = casterPos.x + Math.cos(angle) * orbR;
        pz = casterPos.z + Math.sin(angle) * orbR;
      } else {
        const angle = slotAngle + orbitPhase;
        px = cx + Math.cos(angle) * radius;
        pz = cz + Math.sin(angle) * radius;
      }

      orb.position.set(
        px,
        casterPos.y + 2 * Math.sin(slotAngle + t * Math.PI * 2),
        pz
      );
    }

    const pulse = 0.7 + 0.3 * Math.sin(t * Math.PI * 10);
    this.material.opacity = (0.45 + 0.5 * t) * pulse;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.material.dispose();
    this.geometry.dispose();
  }
}

class TelegraphStack implements Telegraph {
  readonly mesh: THREE.Group;
  private readonly orbs: THREE.Mesh[];
  private readonly material: THREE.MeshBasicMaterial;
  private readonly geometry: THREE.SphereGeometry;
  private readonly count: number;
  private readonly baseY: number;
  private readonly spacing: number;
  private disposed = false;

  constructor(spec: {
    color: number;
    count: number;
    orbSize: number;
    baseY?: number;
    spacing?: number;
  }) {
    this.count = spec.count;
    this.baseY = spec.baseY ?? 30;
    this.spacing = spec.spacing ?? 11;
    this.geometry = new THREE.SphereGeometry(spec.orbSize, 12, 8);
    this.material = new THREE.MeshBasicMaterial({
      color: spec.color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.orbs = [];
    const group = new THREE.Group();
    for (let i = 0; i < spec.count; i++) {
      const m = new THREE.Mesh(this.geometry, this.material);
      m.renderOrder = 6;
      m.visible = false;
      group.add(m);
      this.orbs.push(m);
    }
    this.mesh = group;
  }

  update(
    casterPos: THREE.Vector3,
    _aimDir: THREE.Vector3,
    t: number,
    emission?: TelegraphEmissionProgress
  ): void {
    if (this.disposed) return;
    // All N orbs born by 90% of charge, evenly spaced. Each orb pops in
    // (scale 0 → 1) over a brief window after its birth, then floats in
    // place with a small bob. During the firing burst (emission set),
    // orbs at the top of the stack are hidden first — feeds top-to-
    // bottom into the caster like a magazine into a chamber.
    const allBornBy = 0.9;
    const popDur = 0.08;
    const fired = emission?.fired ?? 0;
    const topVisibleIdx = this.count - fired;

    for (let i = 0; i < this.count; i++) {
      const orb = this.orbs[i];

      if (i >= topVisibleIdx) {
        orb.visible = false;
        continue;
      }

      const birth =
        this.count <= 1 ? 0 : (i / (this.count - 1)) * allBornBy;
      if (t < birth) {
        orb.visible = false;
        continue;
      }
      orb.visible = true;

      const popProgress = Math.min(1, (t - birth) / popDur);
      const scale = popProgress;

      const bob = Math.sin(t * Math.PI * 4 + i * 0.6) * 1.2;
      orb.position.set(
        casterPos.x,
        casterPos.y + this.baseY + i * this.spacing + bob,
        casterPos.z
      );
      orb.scale.setScalar(scale);
    }

    const pulse = 0.7 + 0.3 * Math.sin(t * Math.PI * 12);
    this.material.opacity = (0.5 + 0.4 * t) * pulse;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.material.dispose();
    this.geometry.dispose();
  }
}
