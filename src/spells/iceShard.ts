import * as THREE from "three";
import type {
  Spell,
  SpellFactory,
  SpellMetadata,
  SpellRange,
} from "./spell";
import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";
import { Explosion } from "./explosion";
import { ICE_PALETTE, ParticleBurst } from "./particleBurst";
import { emit } from "../telemetry";

interface IceShardAOE {
  radius: number;
  damageAtCenter: number;
  falloff: "linear" | "quadratic";
}

interface IceShardSpec {
  id: string;
  range: SpellRange;
  chargeTime: number;
  cooldown: number;
  tags: string[];
  aoe: IceShardAOE;
  portalHeight: number;
  descentSpeed: number;
  visual: {
    shardColor: number;
    shardEdgeColor: number;
    portalColor: number;
    telegraphColor: number;
    impactCoreColor: number;
    impactHaloColor: number;
  };
}

const ICE_SHARD_SPEC: IceShardSpec = {
  id: "iceShard",
  range: { min: 60, max: 350 },
  chargeTime: 1.0,
  cooldown: 4.0,
  tags: ["aoe", "ranged", "ice", "ground-targeted"],
  aoe: {
    radius: 90,
    damageAtCenter: 25,
    falloff: "linear",
  },
  portalHeight: 200,
  descentSpeed: 360,
  visual: {
    shardColor: 0xb8e4ff,
    shardEdgeColor: 0xeaffff,
    portalColor: 0x88ccff,
    telegraphColor: 0x99ddff,
    impactCoreColor: 0xc0e0ff,
    impactHaloColor: 0x4080c0,
  },
};

const TELEGRAPH_GROUND_Y = 0.4;
const FADE_DURATION = 0.6;
const SHATTER_FRAGMENT_COUNT = 7;
const SHATTER_GRAVITY = 240;

const ICE_SHARD_METADATA: SpellMetadata = {
  id: ICE_SHARD_SPEC.id,
  kind: "zone",
  element: "water",
  range: ICE_SHARD_SPEC.range,
  chargeTime: ICE_SHARD_SPEC.chargeTime,
  cooldown: ICE_SHARD_SPEC.cooldown,
  tags: ICE_SHARD_SPEC.tags,
  castMode: "channel",
};

export const IceShardFactory: SpellFactory = {
  metadata: ICE_SHARD_METADATA,
  create(caster, target, aim) {
    const impact = computeImpactPos(caster, target, aim);
    return new IceShard(caster, impact, ICE_SHARD_SPEC);
  },
};

function computeImpactPos(
  caster: Contestant,
  target: Contestant | null,
  aim: THREE.Vector3
): THREE.Vector3 {
  if (target) {
    return new THREE.Vector3(target.position.x, 0, target.position.z);
  }
  const len = Math.hypot(aim.x, aim.z);
  if (len < 1e-3) {
    return new THREE.Vector3(caster.position.x, 0, caster.position.z);
  }
  const dist = 200;
  return new THREE.Vector3(
    caster.position.x + (aim.x / len) * dist,
    0,
    caster.position.z + (aim.z / len) * dist
  );
}

type IceShardState = "channeling" | "descending" | "impacted";

interface ShardFragment {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  edges: THREE.LineSegments;
  edgesMat: THREE.LineBasicMaterial;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinY: number;
  spinZ: number;
}

export class IceShard implements Spell {
  readonly mesh: THREE.Group;
  readonly position: THREE.Vector3;
  readonly velocity = new THREE.Vector3();
  readonly caster: Contestant;
  readonly metadata = ICE_SHARD_METADATA;
  readonly spec: IceShardSpec;
  frozen = false;
  dead = false;

  private readonly impactPos: THREE.Vector3;
  private state: IceShardState = "channeling";
  private chargeAge = 0;
  private descentAge = 0;
  private fadeAge = 0;

  private readonly groundRing: THREE.Mesh;
  private readonly groundRingMat: THREE.MeshBasicMaterial;
  private readonly portal: THREE.Mesh;
  private readonly portalMat: THREE.MeshBasicMaterial;
  private readonly portalGlow: THREE.Mesh;
  private readonly portalGlowMat: THREE.MeshBasicMaterial;
  private readonly shardGroup: THREE.Group;
  private readonly shardBody: THREE.Mesh;
  private readonly shardBodyMat: THREE.MeshBasicMaterial;
  private readonly shardEdges: THREE.LineSegments;
  private readonly shardEdgesMat: THREE.LineBasicMaterial;
  private readonly fragments: ShardFragment[] = [];

  constructor(
    caster: Contestant,
    impactPos: THREE.Vector3,
    spec: IceShardSpec
  ) {
    this.caster = caster;
    this.spec = spec;
    this.impactPos = impactPos.clone();
    this.position = this.impactPos.clone();

    const group = new THREE.Group();

    // Ground telegraph: thin ring on the floor that scales out to aoe.radius
    // during channel. Fixed at impact location — defender vacates if they can.
    const ringGeo = new THREE.RingGeometry(0.92, 1.0, 48, 1);
    this.groundRingMat = new THREE.MeshBasicMaterial({
      color: spec.visual.telegraphColor,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.groundRing = new THREE.Mesh(ringGeo, this.groundRingMat);
    this.groundRing.rotation.x = -Math.PI / 2;
    this.groundRing.position.set(
      this.impactPos.x,
      TELEGRAPH_GROUND_Y,
      this.impactPos.z
    );
    this.groundRing.renderOrder = 5;
    group.add(this.groundRing);

    // Portal: a thin ring at portalHeight (the "opening") with a faint
    // inner glow disc. Visible from cast start through impact.
    const portalRingGeo = new THREE.RingGeometry(
      spec.aoe.radius * 0.32,
      spec.aoe.radius * 0.4,
      48
    );
    this.portalMat = new THREE.MeshBasicMaterial({
      color: spec.visual.portalColor,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.portal = new THREE.Mesh(portalRingGeo, this.portalMat);
    this.portal.rotation.x = -Math.PI / 2;
    this.portal.position.set(
      this.impactPos.x,
      spec.portalHeight,
      this.impactPos.z
    );
    this.portal.renderOrder = 5;
    this.portal.scale.set(0, 0, 1);
    group.add(this.portal);

    const portalGlowGeo = new THREE.CircleGeometry(spec.aoe.radius * 0.32, 32);
    this.portalGlowMat = new THREE.MeshBasicMaterial({
      color: spec.visual.portalColor,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.portalGlow = new THREE.Mesh(portalGlowGeo, this.portalGlowMat);
    this.portalGlow.rotation.x = -Math.PI / 2;
    this.portalGlow.position.set(
      this.impactPos.x,
      spec.portalHeight - 0.5,
      this.impactPos.z
    );
    this.portalGlow.renderOrder = 4;
    this.portalGlow.scale.set(0, 0, 1);
    group.add(this.portalGlow);

    // Shard: tall vertical octahedron (point down). Two layers — translucent
    // body + bright wireframe edges — for a glassy look.
    this.shardGroup = new THREE.Group();
    const shardGeo = new THREE.OctahedronGeometry(22, 0);
    shardGeo.scale(0.7, 3.0, 0.7);
    this.shardBodyMat = new THREE.MeshBasicMaterial({
      color: spec.visual.shardColor,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.shardBody = new THREE.Mesh(shardGeo, this.shardBodyMat);
    this.shardGroup.add(this.shardBody);

    const edgesGeo = new THREE.EdgesGeometry(shardGeo);
    this.shardEdgesMat = new THREE.LineBasicMaterial({
      color: spec.visual.shardEdgeColor,
      transparent: true,
      opacity: 0.85,
    });
    this.shardEdges = new THREE.LineSegments(edgesGeo, this.shardEdgesMat);
    this.shardGroup.add(this.shardEdges);

    this.shardGroup.position.set(
      this.impactPos.x,
      spec.portalHeight,
      this.impactPos.z
    );
    this.shardGroup.visible = false;
    group.add(this.shardGroup);

    this.mesh = group;

    emit("iceShard_cast", caster.id, {
      impactX: this.impactPos.x,
      impactZ: this.impactPos.z,
      chargeTime: spec.chargeTime,
    });
  }

  update(dt: number, world: World): void {
    if (this.frozen) {
      this.chargeAge += dt;
      const t = Math.min(1, this.chargeAge / this.spec.chargeTime);
      // Ground ring grows out
      const radius = this.spec.aoe.radius * t;
      this.groundRing.scale.set(radius, radius, 1);
      const ringPulse = 0.7 + 0.3 * Math.sin(t * Math.PI * 14);
      this.groundRingMat.opacity = (0.18 + 0.27 * t) * ringPulse;
      // Portal grows from 0 to full size in lockstep with the ground
      // circle, slowly spins, and fades in.
      this.portal.scale.set(t, t, 1);
      this.portalGlow.scale.set(t, t, 1);
      this.portal.rotation.z += dt * 0.6;
      const portalPulse = 0.85 + 0.15 * Math.sin(t * Math.PI * 7);
      this.portalMat.opacity = (0.12 + 0.28 * t) * portalPulse;
      this.portalGlowMat.opacity = (0.08 + 0.16 * t) * portalPulse;
      return;
    }

    if (this.state === "channeling") {
      this.startDescent();
    }

    if (this.state === "descending") {
      this.descentAge += dt;
      const traveled = this.spec.descentSpeed * this.descentAge;
      const progress = Math.min(1, traveled / this.spec.portalHeight);
      this.shardGroup.position.y = this.spec.portalHeight - traveled;
      // Slow rotation around vertical axis only — keeps the point aimed
      // straight down so it reads as "stabbing", not "tumbling".
      this.shardGroup.rotation.y += dt * 1.4;
      // Shimmer: opacity oscillates as the shard descends.
      const shimmer = 0.85 + 0.15 * Math.sin(this.descentAge * Math.PI * 18);
      this.shardBodyMat.opacity = 0.5 * shimmer;
      this.shardEdgesMat.opacity = 0.95 * shimmer;
      // Portal stays visible the whole descent, slow spin
      this.portal.rotation.z += dt * 0.6;
      const portalPulse = 0.85 + 0.15 * Math.sin(this.descentAge * Math.PI * 5);
      this.portalMat.opacity = 0.4 * portalPulse;
      this.portalGlowMat.opacity = 0.24 * portalPulse;
      // Ring intensifies as impact nears
      const ringPulse = 0.7 + 0.3 * Math.sin(this.descentAge * Math.PI * 14);
      this.groundRingMat.opacity = (0.35 + 0.3 * progress) * ringPulse;
      if (progress >= 1) {
        this.impact(world);
      }
      return;
    }

    if (this.state === "impacted") {
      this.fadeAge += dt;
      const fade = Math.max(0, 1 - this.fadeAge / FADE_DURATION);
      this.groundRingMat.opacity = 0.4 * fade;
      this.updateFragments(dt, fade);
      if (this.fadeAge >= FADE_DURATION) {
        this.dead = true;
      }
    }
  }

  private startDescent(): void {
    this.state = "descending";
    this.shardGroup.visible = true;
  }

  private impact(world: World): void {
    this.state = "impacted";
    this.shardGroup.visible = false;
    this.portal.visible = false;
    this.portalGlow.visible = false;
    this.spawnFragments();

    const aoe = this.spec.aoe;
    let hits = 0;
    for (const c of world.contestants) {
      if (!c.alive) continue;
      const dx = c.position.x - this.impactPos.x;
      const dz = c.position.z - this.impactPos.z;
      const surfaceDist = Math.max(0, Math.hypot(dx, dz) - c.radius);
      if (surfaceDist > aoe.radius) continue;
      const tt = surfaceDist / aoe.radius;
      const factor =
        aoe.falloff === "quadratic" ? (1 - tt) * (1 - tt) : 1 - tt;
      const dmg = aoe.damageAtCenter * factor;
      if (dmg <= 0) continue;
      c.hp -= dmg;
      hits++;
      emit("damage", this.caster.id, {
        victim: c.id,
        amount: dmg,
        spell: this.spec.id,
        hpAfter: c.hp,
        aoe: true,
        surfaceDist,
      });
      if (c.hp <= 0) {
        c.alive = false;
        emit("death", c.id, {
          killer: this.caster.id,
          spell: this.spec.id,
        });
      }
    }
    emit("aoe_impact", this.caster.id, {
      spell: this.spec.id,
      radius: aoe.radius,
      hits,
    });

    const burstOrigin = new THREE.Vector3(
      this.impactPos.x,
      8,
      this.impactPos.z
    );
    world.addSpell(
      new Explosion(this.caster, burstOrigin, {
        startRadius: 12,
        peakRadius: aoe.radius * 0.7,
        coreColor: this.spec.visual.impactCoreColor,
        haloColor: this.spec.visual.impactHaloColor,
        duration: 0.4,
      })
    );
    world.addSpell(
      new ParticleBurst(this.caster, burstOrigin, ICE_PALETTE, {
        speedScale: 1.4,
      })
    );
  }

  private spawnFragments(): void {
    for (let i = 0; i < SHATTER_FRAGMENT_COUNT; i++) {
      const fragGeo = new THREE.TetrahedronGeometry(6 + Math.random() * 4);
      const fragMat = new THREE.MeshBasicMaterial({
        color: this.spec.visual.shardColor,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const fragMesh = new THREE.Mesh(fragGeo, fragMat);
      fragMesh.position.set(this.impactPos.x, 6, this.impactPos.z);

      const edgesGeo = new THREE.EdgesGeometry(fragGeo);
      const edgesMat = new THREE.LineBasicMaterial({
        color: this.spec.visual.shardEdgeColor,
        transparent: true,
        opacity: 0.9,
      });
      const edges = new THREE.LineSegments(edgesGeo, edgesMat);
      fragMesh.add(edges);

      const ang = Math.random() * Math.PI * 2;
      const radial = 60 + Math.random() * 80;
      const vx = Math.cos(ang) * radial;
      const vz = Math.sin(ang) * radial;
      const vy = 60 + Math.random() * 90;

      this.fragments.push({
        mesh: fragMesh,
        material: fragMat,
        edges,
        edgesMat,
        vx,
        vy,
        vz,
        spinX: (Math.random() - 0.5) * 12,
        spinY: (Math.random() - 0.5) * 12,
        spinZ: (Math.random() - 0.5) * 12,
      });
      this.mesh.add(fragMesh);
    }
  }

  private updateFragments(dt: number, fade: number): void {
    for (const f of this.fragments) {
      f.vy -= SHATTER_GRAVITY * dt;
      f.mesh.position.x += f.vx * dt;
      f.mesh.position.y += f.vy * dt;
      f.mesh.position.z += f.vz * dt;
      // Bounce/clamp if a fragment dips below ground.
      if (f.mesh.position.y < 0) {
        f.mesh.position.y = 0;
        f.vy = -f.vy * 0.3;
        f.vx *= 0.6;
        f.vz *= 0.6;
      }
      f.mesh.rotation.x += f.spinX * dt;
      f.mesh.rotation.y += f.spinY * dt;
      f.mesh.rotation.z += f.spinZ * dt;
      f.material.opacity = 0.55 * fade;
      f.edgesMat.opacity = 0.9 * fade;
    }
  }
}
