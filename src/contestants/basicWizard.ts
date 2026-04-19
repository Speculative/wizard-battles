import * as THREE from "three";
import type { Contestant } from "./contestant";
import type { World } from "../world";
import { Fireball, FIREBALL_SPEED } from "../spells/fireball";
import { getToonGradient, makeOutline } from "../materials";
import { KinematicBody, type MovementStats } from "../kinematics";
import { StatusDisplay } from "../statusDisplay";
import { TacticSelector } from "../tactics/selector";
import type {
  Directives,
  RosterEntry,
  TacticContext,
} from "../tactics/tactic";
import { DEFAULT_DIRECTIVES } from "../tactics/tactic";
import {
  circle,
  sampleBestDirection,
  toVector3,
  type Vec2,
  type SampleDebug,
} from "../steering";
import { ProjectileIncomingDetector } from "../events/projectileIncoming";
import type { EventDetector } from "../events/event";
import type { Handler } from "../handlers/handler";
import { LateralDodgeHandler } from "../handlers/lateralDodge";
import { runPipeline } from "../handlers/pipeline";

function gaussian(): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const RADIUS = 22;
const FLOAT_HEIGHT = RADIUS * 1.5;
const FIRE_COOLDOWN = 1.4;
const CHARGE_DURATION = 0.45;

const AIM_NOISE_SIGMA_MAX = 0.2;
const AIM_NOISE_SIGMA_MIN = 0.02;
const AIM_NOISE_DECAY_SHOTS = 25;

const STAMINA_MAX = 3.0;
const STAMINA_SPRINT_DRAIN = 1.0;
const STAMINA_REGEN = 0.6;
const SPRINT_MIN_STAMINA_TO_START = 0.8;
const RECOVERY_DURATION = 1.2;

const DODGE_DURATION_MAX = 0.22;
const DODGE_DURATION_MIN = 0.08;
const DODGE_IMPULSE_SPEED = 320;
const DODGE_STAMINA_COST = 1.2;
const DODGE_MIN_STAMINA = 0.6;
const DODGE_COOLDOWN = 1.2;
const DODGE_RECOVERY_DURATION = 0.35;

const TRAIL_SAMPLE_INTERVAL = 0.03;
const TRAIL_MAX_SAMPLES = 10;

const FACING_TURN_RATE = Math.PI * 2.5;
const SPRINT_FACING_CONE = (Math.PI * 5) / 12;

const SAMPLE_WALL_HORIZON = 140;
const SAMPLE_INTENT_WEIGHT = 1.0;
const SAMPLE_WALL_WEIGHT = 1.8;

const STRAFE_SIDE_SCALE = 0.6;
const STRAFE_BACK_SCALE = 0.4;

type MovementState =
  | "idle"
  | "walking"
  | "running"
  | "sprinting"
  | "dodging"
  | "charging"
  | "recovering";

const STATE_STATS: Record<MovementState, MovementStats> = {
  idle: { maxSpeed: 0, acceleration: 0, friction: 500, turnRate: Math.PI * 2 },
  walking: {
    maxSpeed: 60,
    acceleration: 350,
    friction: 350,
    turnRate: Math.PI * 1.6,
  },
  running: {
    maxSpeed: 130,
    acceleration: 450,
    friction: 300,
    turnRate: Math.PI * 1.2,
  },
  sprinting: {
    maxSpeed: 220,
    acceleration: 500,
    friction: 250,
    turnRate: Math.PI * 0.7,
  },
  dodging: {
    maxSpeed: 340,
    acceleration: 2000,
    friction: 600,
    turnRate: Math.PI * 0.3,
  },
  charging: {
    maxSpeed: 45,
    acceleration: 250,
    friction: 400,
    turnRate: Math.PI * 1.8,
  },
  recovering: {
    maxSpeed: 15,
    acceleration: 50,
    friction: 800,
    turnRate: Math.PI * 0.6,
  },
};

export interface BasicWizardOptions {
  id: string;
  color: number;
  start: THREE.Vector3;
  roster: RosterEntry[];
}

export class BasicWizard implements Contestant {
  readonly id: string;
  readonly mesh: THREE.Object3D;
  readonly radius = RADIUS;
  hp = 100;
  alive = true;

  private readonly body: KinematicBody;
  readonly facing = new THREE.Vector3(1, 0, 0);
  private readonly facingPivot: THREE.Group;
  private readonly desiredDir = new THREE.Vector3();
  private state: MovementState = "running";
  private stateTimer = 0;
  private stamina = STAMINA_MAX;
  private cooldown = Math.random() * FIRE_COOLDOWN;
  private turnTimer = 0;
  private chargedFireball: Fireball | null = null;
  private chargeTarget: Contestant | null = null;
  private shotsFired = 0;
  private dodgeCooldown = 0;
  private readonly dodgeDir = new THREE.Vector3();
  private readonly defaultCircleSign: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  private readonly projectileDetector = new ProjectileIncomingDetector();
  private readonly detectors: EventDetector[] = [this.projectileDetector];
  private readonly handlers: Handler[] = [new LateralDodgeHandler()];
  private readonly sampleDebug: SampleDebug = {
    intentX: 0,
    intentZ: 0,
    pickedX: 0,
    pickedZ: 0,
    intentWallPenalty: 0,
    pickedWallPenalty: 0,
    pickedAlignment: 1,
    nearestWallDist: 0,
  };
  private readonly tacticSelector: TacticSelector;
  private directives: Directives = { ...DEFAULT_DIRECTIVES };
  private readonly trail: THREE.Line;
  private readonly trailPositions: Float32Array;
  private readonly trailColors: Float32Array;
  private readonly trailGeo: THREE.BufferGeometry;
  private trailSampleTimer = 0;
  private trailCount = 0;
  private trailSampling = false;
  private readonly trailBaseColor: THREE.Color;
  private trailAttached = false;
  private readonly status = new StatusDisplay();
  private statusAttached = false;

  get position(): THREE.Vector3 {
    return this.body.position;
  }
  get velocity(): THREE.Vector3 {
    return this.body.velocity;
  }

  constructor(opts: BasicWizardOptions) {
    this.id = opts.id;
    this.body = new KinematicBody({ ...STATE_STATS.running }, opts.start);
    this.body.position.y = FLOAT_HEIGHT;
    const initialCtx: TacticContext = {
      self: this,
      enemy: null,
      distToEnemy: Infinity,
      stamina01: 1,
      hp01: 1,
      shotsFired: 0,
    };
    this.tacticSelector = new TacticSelector(opts.roster, initialCtx, opts.id);
    this.directives = this.tacticSelector.directives;

    const sphereGeo = new THREE.SphereGeometry(RADIUS, 24, 24);
    const bodyMesh = new THREE.Mesh(
      sphereGeo,
      new THREE.MeshToonMaterial({
        color: opts.color,
        gradientMap: getToonGradient(),
      })
    );
    bodyMesh.castShadow = true;
    const group = new THREE.Group();
    group.add(makeOutline(sphereGeo, 1.05));
    group.add(bodyMesh);

    const facingMarker = new THREE.Mesh(
      new THREE.ConeGeometry(RADIUS * 0.35, RADIUS * 0.9, 10),
      new THREE.MeshToonMaterial({
        color: 0x222222,
        gradientMap: getToonGradient(),
      })
    );
    facingMarker.rotation.z = -Math.PI / 2;
    facingMarker.position.set(RADIUS * 0.9, RADIUS * 0.3, 0);
    const facingPivot = new THREE.Group();
    facingPivot.add(facingMarker);
    group.add(facingPivot);
    this.facingPivot = facingPivot;

    this.mesh = group;
    this.mesh.position.copy(this.body.position);

    this.trailBaseColor = new THREE.Color(opts.color);
    this.trailGeo = new THREE.BufferGeometry();
    this.trailPositions = new Float32Array(TRAIL_MAX_SAMPLES * 3);
    this.trailColors = new Float32Array(TRAIL_MAX_SAMPLES * 3);
    this.trailGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.trailPositions, 3)
    );
    this.trailGeo.setAttribute(
      "color",
      new THREE.BufferAttribute(this.trailColors, 3)
    );
    this.trailGeo.setDrawRange(0, 0);
    this.trail = new THREE.Line(
      this.trailGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true })
    );
    this.trail.frustumCulled = false;

    const angle = Math.random() * Math.PI * 2;
    this.desiredDir.set(Math.cos(angle), 0, Math.sin(angle));
    this.facing.copy(this.desiredDir);
    this.facingPivot.rotation.y = -Math.atan2(this.facing.z, this.facing.x);
  }

  update(dt: number, world: World): void {
    if (!this.trailAttached) {
      world.scene.add(this.trail);
      this.trailAttached = true;
    }
    if (!this.statusAttached) {
      world.scene.add(this.status.group);
      this.statusAttached = true;
    }

    if (!this.alive) {
      this.mesh.visible = false;
      this.trail.visible = false;
      this.status.setVisible(false);
      if (this.chargedFireball) {
        this.chargedFireball.dead = true;
        this.chargedFireball = null;
      }
      return;
    }

    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);

    this.turnTimer -= dt;
    if (this.turnTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      this.desiredDir.set(Math.cos(angle), 0, Math.sin(angle));
      this.turnTimer = 0.8 + Math.random() * 1.6;
    }

    const nearest = this.pickTarget(world);
    const distToTarget = nearest
      ? nearest.position.distanceTo(this.body.position)
      : Infinity;

    const ctx: TacticContext = {
      self: this,
      enemy: nearest,
      distToEnemy: distToTarget,
      stamina01: this.stamina / STAMINA_MAX,
      hp01: this.hp / 100,
      shotsFired: this.shotsFired,
    };
    this.tacticSelector.update(dt, ctx);
    this.directives = this.tacticSelector.directives;

    if (nearest) {
      this.computeEngageIntent(nearest, distToTarget, world, this.desiredDir);
    }

    this.projectileDetector.setEagerness(this.directives.dodgeEagerness);
    const changes = runPipeline({
      self: this,
      world,
      detectors: this.detectors,
      handlers: this.handlers,
    });

    for (const c of changes) {
      if (c.type === "forceMovementState" && c.state === "dodging") {
        this.tryEnterDodge(c.direction);
      }
    }

    this.updateState(dt, distToTarget);

    const isDodging = this.state === "dodging";
    const intent = isDodging ? this.dodgeDir : this.desiredDir;
    let facingIntent = this.computeFacingIntent(intent, nearest);
    if (this.state === "sprinting") {
      facingIntent = this.clampToCone(
        facingIntent,
        this.body.velocity,
        SPRINT_FACING_CONE,
        intent
      );
    }
    this.updateFacing(dt, facingIntent);

    const baseMaxSpeed = this.body.stats.maxSpeed;
    if (!isDodging && this.state !== "sprinting") {
      this.body.stats.maxSpeed = baseMaxSpeed * this.strafeScale(intent);
    }

    if (this.state === "idle") {
      this.body.clearIntent();
    } else {
      this.body.setIntent(intent);
    }
    this.body.update(dt);
    this.body.stats.maxSpeed = baseMaxSpeed;

    this.enforceArenaBounds(world);

    this.body.position.y = FLOAT_HEIGHT;
    this.mesh.position.copy(this.body.position);

    this.updateTrail(dt);
    this.updateCombat(dt, world, nearest);
    this.status.update(
      this.hp / 100,
      this.stamina / STAMINA_MAX,
      this.body.position,
      RADIUS * 1.8,
      world.camera.quaternion
    );
  }

  private computeEngageIntent(
    target: Contestant,
    _dist: number,
    world: World,
    out: THREE.Vector3
  ): void {
    const pos: Vec2 = { x: this.body.position.x, z: this.body.position.z };
    const sign =
      this.directives.circleDir !== 0
        ? this.directives.circleDir
        : this.defaultCircleSign;

    const rawIntent = circle(
      pos,
      { x: target.position.x, z: target.position.z },
      this.directives.preferredRange,
      sign,
      this.directives.rangeBand
    );

    const speed = Math.hypot(this.body.velocity.x, this.body.velocity.z);
    const refined = sampleBestDirection(
      {
        pos,
        speed,
        intent: rawIntent,
        bounds: world.bounds,
        wallHorizon: SAMPLE_WALL_HORIZON,
        intentWeight: SAMPLE_INTENT_WEIGHT,
        wallWeight: SAMPLE_WALL_WEIGHT,
      },
      16,
      this.sampleDebug
    );
    toVector3(refined, out);
  }

  private computeFacingIntent(
    moveIntent: THREE.Vector3,
    nearest: Contestant | null
  ): THREE.Vector3 {
    if (this.chargeTarget) {
      const dx = this.chargeTarget.position.x - this.body.position.x;
      const dz = this.chargeTarget.position.z - this.body.position.z;
      const len = Math.hypot(dx, dz);
      if (len > 1e-3) return new THREE.Vector3(dx / len, 0, dz / len);
    }
    if (nearest) {
      const dx = nearest.position.x - this.body.position.x;
      const dz = nearest.position.z - this.body.position.z;
      const len = Math.hypot(dx, dz);
      if (len > 1e-3) return new THREE.Vector3(dx / len, 0, dz / len);
    }
    return moveIntent;
  }

  private clampToCone(
    desired: THREE.Vector3,
    reference: THREE.Vector3,
    maxAngle: number,
    fallback: THREE.Vector3
  ): THREE.Vector3 {
    const refLen = Math.hypot(reference.x, reference.z);
    if (refLen < 1e-3) return fallback;
    const rx = reference.x / refLen;
    const rz = reference.z / refLen;
    const dLen = Math.hypot(desired.x, desired.z);
    if (dLen < 1e-3) return new THREE.Vector3(rx, 0, rz);
    const dx = desired.x / dLen;
    const dz = desired.z / dLen;
    const dot = rx * dx + rz * dz;
    const clamped = Math.max(-1, Math.min(1, dot));
    const angle = Math.acos(clamped);
    if (angle <= maxAngle) return new THREE.Vector3(dx, 0, dz);
    const cross = rx * dz - rz * dx;
    const sign = cross >= 0 ? 1 : -1;
    const rot = maxAngle * sign;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    return new THREE.Vector3(rx * cos - rz * sin, 0, rx * sin + rz * cos);
  }

  private strafeScale(moveIntent: THREE.Vector3): number {
    const iLen = Math.hypot(moveIntent.x, moveIntent.z);
    if (iLen < 1e-3) return 1;
    const ix = moveIntent.x / iLen;
    const iz = moveIntent.z / iLen;
    const dot = this.facing.x * ix + this.facing.z * iz;
    if (dot >= 0) {
      return 1 - (1 - STRAFE_SIDE_SCALE) * (1 - dot);
    }
    return STRAFE_SIDE_SCALE + (STRAFE_BACK_SCALE - STRAFE_SIDE_SCALE) * -dot;
  }

  private updateFacing(dt: number, intent: THREE.Vector3): void {
    const len = Math.hypot(intent.x, intent.z);
    if (len < 1e-3) return;
    const tx = intent.x / len;
    const tz = intent.z / len;
    const dot = this.facing.x * tx + this.facing.z * tz;
    const clamped = Math.max(-1, Math.min(1, dot));
    const angleBetween = Math.acos(clamped);
    const maxRotate = FACING_TURN_RATE * dt;
    if (angleBetween <= maxRotate) {
      this.facing.set(tx, 0, tz);
    } else {
      const cross = this.facing.x * tz - this.facing.z * tx;
      const sign = cross >= 0 ? 1 : -1;
      const rot = maxRotate * sign;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const fx = this.facing.x * cos - this.facing.z * sin;
      const fz = this.facing.x * sin + this.facing.z * cos;
      this.facing.set(fx, 0, fz);
    }
    this.facingPivot.rotation.y = -Math.atan2(this.facing.z, this.facing.x);
  }

  private updateTrail(dt: number): void {
    const sampling = this.state === "sprinting" || this.state === "dodging";
    if (sampling !== this.trailSampling) {
      this.trailCount = 0;
      this.trailSampleTimer = 0;
      this.trailSampling = sampling;
      this.rewriteTrailFromFront();
    }
    if (sampling) {
      this.trailSampleTimer -= dt;
      if (this.trailSampleTimer <= 0) {
        this.trailSampleTimer = TRAIL_SAMPLE_INTERVAL;
        this.pushTrailSample();
      }
    } else if (this.trailCount > 0) {
      this.trailSampleTimer -= dt;
      if (this.trailSampleTimer <= 0) {
        this.trailSampleTimer = TRAIL_SAMPLE_INTERVAL;
        this.shiftTrailTail();
      }
    }
    this.trail.visible = this.trailCount > 1;
  }

  private shiftTrailTail(): void {
    if (this.trailCount <= 0) return;
    for (let i = 1; i < this.trailCount; i++) {
      this.trailPositions[(i - 1) * 3] = this.trailPositions[i * 3];
      this.trailPositions[(i - 1) * 3 + 1] = this.trailPositions[i * 3 + 1];
      this.trailPositions[(i - 1) * 3 + 2] = this.trailPositions[i * 3 + 2];
    }
    this.trailCount--;
    this.rewriteTrailFromFront();
  }

  private pushTrailSample(): void {
    if (this.trailCount >= TRAIL_MAX_SAMPLES) {
      for (let i = 1; i < TRAIL_MAX_SAMPLES; i++) {
        this.trailPositions[(i - 1) * 3] = this.trailPositions[i * 3];
        this.trailPositions[(i - 1) * 3 + 1] = this.trailPositions[i * 3 + 1];
        this.trailPositions[(i - 1) * 3 + 2] = this.trailPositions[i * 3 + 2];
      }
      this.trailCount = TRAIL_MAX_SAMPLES - 1;
    }
    const idx = this.trailCount * 3;
    this.trailPositions[idx] = this.body.position.x;
    this.trailPositions[idx + 1] = this.body.position.y;
    this.trailPositions[idx + 2] = this.body.position.z;
    this.trailCount++;
    this.rewriteTrailFromFront();
  }

  private rewriteTrailFromFront(): void {
    const n = this.trailCount;
    for (let i = 0; i < n; i++) {
      const t = n <= 1 ? 1 : i / (n - 1);
      this.trailColors[i * 3] = this.trailBaseColor.r * t;
      this.trailColors[i * 3 + 1] = this.trailBaseColor.g * t;
      this.trailColors[i * 3 + 2] = this.trailBaseColor.b * t;
    }
    this.trailGeo.attributes.position.needsUpdate = true;
    this.trailGeo.attributes.color.needsUpdate = true;
    this.trailGeo.setDrawRange(0, n);
  }

  private updateState(dt: number, distToTarget: number): void {
    if (this.state === "charging") {
      this.stateTimer -= dt;
      this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN * dt);
      if (this.stateTimer <= 0) this.setState("running");
      return;
    }
    if (this.state === "recovering") {
      this.stateTimer -= dt;
      this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN * dt);
      if (this.stateTimer <= 0) this.setState("running");
      return;
    }
    if (this.state === "dodging") {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.setState("recovering");
        this.stateTimer = DODGE_RECOVERY_DURATION;
      }
      return;
    }

    const rangeGap = Math.abs(distToTarget - this.directives.preferredRange);
    const canSprint = !this.directives.ambushMode;
    const wantsSprint =
      canSprint &&
      rangeGap > 100 &&
      this.stamina > SPRINT_MIN_STAMINA_TO_START;

    if (this.state === "sprinting") {
      this.stamina -= STAMINA_SPRINT_DRAIN * dt;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.setState("recovering");
        this.stateTimer = RECOVERY_DURATION;
        return;
      }
      if (!wantsSprint) this.setState("running");
      return;
    }

    this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN * dt);

    if (wantsSprint) {
      this.setState("sprinting");
      return;
    }

    const speed = Math.hypot(this.body.velocity.x, this.body.velocity.z);
    if (distToTarget < 180) {
      this.setState("walking");
    } else if (speed < 5) {
      this.setState("idle");
    } else {
      this.setState("running");
    }
  }

  private setState(next: MovementState): void {
    if (this.state === next) return;
    this.state = next;
    this.body.stats = { ...STATE_STATS[next] };
  }

  private updateCombat(
    dt: number,
    world: World,
    nearest: Contestant | null
  ): void {
    if (this.chargedFireball) {
      const aim = this.chargeTarget
        ? this.chargeTarget.position.clone().sub(this.body.position).normalize()
        : this.desiredDir;
      this.chargedFireball.setPosition(
        this.body.position.x + aim.x * (this.radius + 6),
        this.body.position.y + 8,
        this.body.position.z + aim.z * (this.radius + 6)
      );
      if (this.state !== "charging") {
        this.releaseCharge();
      }
      return;
    }

    this.cooldown -= dt;
    if (this.cooldown > 0 || !nearest) return;
    if (this.state === "sprinting" || this.state === "recovering") return;

    this.chargeTarget = nearest;
    const fb = new Fireball(this, new THREE.Vector3(1, 0, 0), this.body.position);
    fb.frozen = true;
    this.chargedFireball = fb;
    world.addSpell(fb);
    this.setState("charging");
    this.stateTimer = CHARGE_DURATION;
  }

  private releaseCharge(): void {
    const fb = this.chargedFireball;
    const target = this.chargeTarget;
    if (!fb) return;
    if (target) {
      const aim = this.computeAimDirection(target);
      fb.setVelocityFromDirection(aim);
      this.shotsFired++;
    }
    fb.frozen = false;
    this.chargedFireball = null;
    this.chargeTarget = null;
    const eag = Math.max(0.1, this.directives.chargeEagerness);
    this.cooldown = FIRE_COOLDOWN / eag;
  }

  private computeAimDirection(target: Contestant): THREE.Vector3 {
    const dx = target.position.x - this.body.position.x;
    const dz = target.position.z - this.body.position.z;
    const vx = target.velocity.x;
    const vz = target.velocity.z;
    const s = FIREBALL_SPEED;
    const a = vx * vx + vz * vz - s * s;
    const b = 2 * (dx * vx + dz * vz);
    const c = dx * dx + dz * dz;

    let leadX = dx;
    let leadZ = dz;
    if (Math.abs(a) < 1e-6) {
      if (Math.abs(b) > 1e-6) {
        const t = -c / b;
        if (t > 0) {
          leadX = dx + vx * t;
          leadZ = dz + vz * t;
        }
      }
    } else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        const t1 = (-b - sq) / (2 * a);
        const t2 = (-b + sq) / (2 * a);
        let t = Infinity;
        if (t1 > 0) t = t1;
        if (t2 > 0 && t2 < t) t = t2;
        if (Number.isFinite(t)) {
          leadX = dx + vx * t;
          leadZ = dz + vz * t;
        }
      }
    }

    const sigma =
      AIM_NOISE_SIGMA_MIN +
      (AIM_NOISE_SIGMA_MAX - AIM_NOISE_SIGMA_MIN) *
        Math.exp(-this.shotsFired / AIM_NOISE_DECAY_SHOTS);
    const noise = gaussian() * sigma;
    const cos = Math.cos(noise);
    const sin = Math.sin(noise);
    const rx = leadX * cos - leadZ * sin;
    const rz = leadX * sin + leadZ * cos;
    return new THREE.Vector3(rx, 0, rz);
  }

  private enforceArenaBounds(world: World): void {
    const b = world.bounds;
    const halfW = b.width / 2 - this.radius;
    const halfD = b.depth / 2 - this.radius;
    const p = this.body.position;
    const v = this.body.velocity;
    if (p.x < -halfW) {
      p.x = -halfW;
      if (v.x < 0) v.x = 0;
      this.desiredDir.x = Math.abs(this.desiredDir.x);
    } else if (p.x > halfW) {
      p.x = halfW;
      if (v.x > 0) v.x = 0;
      this.desiredDir.x = -Math.abs(this.desiredDir.x);
    }
    if (p.z < -halfD) {
      p.z = -halfD;
      if (v.z < 0) v.z = 0;
      this.desiredDir.z = Math.abs(this.desiredDir.z);
    } else if (p.z > halfD) {
      p.z = halfD;
      if (v.z > 0) v.z = 0;
      this.desiredDir.z = -Math.abs(this.desiredDir.z);
    }
  }

  private tryEnterDodge(direction: THREE.Vector3): void {
    if (
      this.state === "dodging" ||
      this.state === "recovering" ||
      this.state === "charging"
    )
      return;
    if (this.dodgeCooldown > 0) return;
    if (this.stamina < DODGE_MIN_STAMINA) return;

    this.dodgeDir.copy(direction);
    this.body.velocity.x = this.dodgeDir.x * DODGE_IMPULSE_SPEED;
    this.body.velocity.z = this.dodgeDir.z * DODGE_IMPULSE_SPEED;
    const staminaFrac = Math.min(1, this.stamina / DODGE_STAMINA_COST);
    this.stamina = Math.max(
      0,
      this.stamina - DODGE_STAMINA_COST * staminaFrac
    );
    this.dodgeCooldown = DODGE_COOLDOWN;
    this.setState("dodging");
    this.stateTimer =
      DODGE_DURATION_MIN +
      (DODGE_DURATION_MAX - DODGE_DURATION_MIN) * staminaFrac;
  }

  private pickTarget(world: World): Contestant | null {
    let best: Contestant | null = null;
    let bestDist = Infinity;
    for (const c of world.contestants) {
      if (c === this || !c.alive) continue;
      const d = c.position.distanceTo(this.body.position);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }
}
