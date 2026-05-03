import * as THREE from "three";
import type { Contestant } from "./contestant";
import type { World } from "../world";
import { FireballFactory } from "../spells/fireball";
import { Projectile, isProjectileFactory, isProjectileModifier, specToMetadata } from "../spells/projectile";
import type { Spell, SpellFactory, SpellMetadata, SpellModifier } from "../spells/spell";
import { getToonGradient, makeOutline } from "../materials";
import { KinematicBody, type MovementStats } from "../kinematics";
import { StatusDisplay } from "../statusDisplay";
import { TacticSelector } from "../tactics/selector";
import type {
  CastController,
  PaceHint,
  RosterEntry,
  TacticOutput,
} from "../tactics/tactic";
import { isStationary } from "../tactics/tactic";
import { toVector3, type Vec2 } from "../steering";
import { ProjectileIncomingDetector } from "../events/projectileIncoming";
import type { EventDetector } from "../events/event";
import type { Handler } from "../handlers/handler";
import { LateralDodgeHandler } from "../handlers/lateralDodge";
import { InterruptOnProjectileHandler } from "../handlers/interruptOnProjectile";
import { LowHPCrossedDetector } from "../events/lowHPCrossed";
import { InterruptOnLowHPHandler } from "../handlers/interruptOnLowHP";
import { runPipeline } from "../handlers/pipeline";
import type { ComponentKey } from "../components";
import { Charging, Dashing, Recovering } from "../components";
import { nowSeconds } from "../clock";
import { emit } from "../telemetry";

function gaussian(): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function computeEffectiveMetadata(
  factory: SpellFactory,
  modifier: SpellModifier | undefined
): SpellMetadata {
  if (!modifier) return factory.metadata;
  if (isProjectileFactory(factory) && isProjectileModifier(modifier)) {
    return specToMetadata(modifier.apply(factory.spec));
  }
  return factory.metadata;
}

const RADIUS = 22;
const FLOAT_HEIGHT = RADIUS * 1.5;
const CHARGE_DURATION = 0.45;

const AIM_NOISE_SIGMA_MAX = 0.2;
const AIM_NOISE_SIGMA_MIN = 0.02;
const AIM_NOISE_DECAY_SHOTS = 25;

const STAMINA_MAX = 3.0;
const STAMINA_SPRINT_DRAIN = 1.0;
const STAMINA_REGEN = 0.6;
const SPRINT_MIN_STAMINA_TO_START = 0.8;
const SPRINT_MIN_STAMINA_TO_HOLD = 0.3;
const RECOVERY_DURATION = 1.2;

const DASH_DURATION_MAX = 0.22;
const DASH_DURATION_MIN = 0.08;
const DASH_IMPULSE_SPEED = 320;
const DASH_STAMINA_COST = 1.2;
const DASH_MIN_STAMINA = 0.6;
const DASH_COOLDOWN = 1.2;
const DASH_RECOVERY_DURATION = 0.35;

const TRAIL_SAMPLE_INTERVAL = 0.03;
const TRAIL_MAX_SAMPLES = 10;

const FACING_TURN_RATE = Math.PI * 2.5;
const SPRINT_FACING_CONE = (Math.PI * 5) / 12;

const STRAFE_SIDE_SCALE = 0.6;
const STRAFE_BACK_SCALE = 0.4;

type MovementState =
  | "idle"
  | "walking"
  | "running"
  | "sprinting"
  | "dashing"
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
  dashing: {
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
  spellbook?: SpellFactory[];
  modifiers?: SpellModifier[];
}

class WizardCastController implements CastController {
  private readonly wizard: BasicWizard;
  constructor(wizard: BasicWizard) {
    this.wizard = wizard;
  }

  requestCast(
    factory: SpellFactory,
    target: Contestant | null,
    aim: Vec2,
    modifier?: SpellModifier
  ): boolean {
    return this.wizard._ccRequestCast(factory, target, aim, modifier);
  }
  cancelCharging(): void {
    this.wizard._ccCancelCharging();
  }
  updateAim(target: Contestant | null, aim: Vec2): void {
    this.wizard._ccUpdateAim(target, aim);
  }
  isCharging(): boolean {
    return this.wizard._ccIsCharging();
  }
  currentFactory(): SpellFactory | null {
    return this.wizard._ccCurrentFactory();
  }
  isReady(factory: SpellFactory): boolean {
    return this.wizard._ccIsReady(factory);
  }
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
  private readonly wanderDir = new THREE.Vector3();
  private state: MovementState = "running";
  private stateTimer = 0;
  private stamina = STAMINA_MAX;
  private readonly readyAt = new Map<SpellFactory, number>();
  private turnTimer = 0;
  private readonly spellbook: SpellFactory[];
  private readonly modifiers: SpellModifier[];
  private chargedSpell: (Spell & { frozen: boolean }) | null = null;
  private chargedFactory: SpellFactory | null = null;
  private chargedModifier: SpellModifier | null = null;
  private chargedSpeed = 0;
  private chargeTarget: Contestant | null = null;
  private shotsFired = 0;
  private dashCooldown = 0;
  private readonly dashDir = new THREE.Vector3();
  private readonly projectileDetector = new ProjectileIncomingDetector();
  private readonly lowHPDetector = new LowHPCrossedDetector(0.4);
  private readonly detectors: EventDetector[] = [
    this.projectileDetector,
    this.lowHPDetector,
  ];
  private readonly handlers: Handler[] = [
    new LateralDodgeHandler(),
    new InterruptOnLowHPHandler(),
    new InterruptOnProjectileHandler(),
  ];
  private readonly components = new Map<string, unknown>();
  private readonly castController: WizardCastController;
  private currentMoveIntent: Vec2 = { x: 0, z: 0 };
  private currentPaceHint: PaceHint = "hold";
  private currentFacingIntent: Vec2 = { x: 0, z: 0 };
  private readonly moveScratch = new THREE.Vector3();
  private _cachedWorldForCast: World | null = null;

  getComponent<T>(key: ComponentKey<T>): T | undefined {
    return this.components.get(key.id) as T | undefined;
  }
  addComponent<T>(key: ComponentKey<T>, data: T): void {
    this.components.set(key.id, data);
  }
  removeComponent<T>(key: ComponentKey<T>): void {
    this.components.delete(key.id);
  }
  private debugLogTimer = 0;
  private readonly tacticSelector: TacticSelector;
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
    this.spellbook = opts.spellbook ?? [FireballFactory];
    this.modifiers = opts.modifiers ?? [];
    this.body = new KinematicBody({ ...STATE_STATS.running }, opts.start);
    this.body.position.y = FLOAT_HEIGHT;
    this.tacticSelector = new TacticSelector(opts.roster, opts.id);
    this.castController = new WizardCastController(this);

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
    this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
    this.facing.copy(this.wanderDir);
    this.facingPivot.rotation.y = -Math.atan2(this.facing.z, this.facing.x);
  }

  stamina01(): number {
    return this.stamina / STAMINA_MAX;
  }
  hp01(): number {
    return this.hp / 100;
  }
  getShotsFired(): number {
    return this.shotsFired;
  }
  getSpellbook(): readonly SpellFactory[] {
    return this.spellbook;
  }
  getModifiers(): readonly SpellModifier[] {
    return this.modifiers;
  }
  getReadyAt(): Map<SpellFactory, number> {
    return this.readyAt;
  }
  getMovementState(): string {
    return this.state;
  }
  getCurrentTacticId(): string {
    return this.tacticSelector.currentTactic.id;
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
      if (this.chargedSpell) {
        this.chargedSpell.dead = true;
        this.chargedSpell = null;
        this.chargedFactory = null;
      }
      return;
    }

    this._cachedWorldForCast = world;
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);

    this.turnTimer -= dt;
    if (this.turnTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
      this.turnTimer = 0.8 + Math.random() * 1.6;
    }

    this.tacticSelector.updateDormantObservations(this, world);
    this.tacticSelector.update(dt, this, world);
    let activeTactic = this.tacticSelector.currentTactic;

    const mergedDetectors = activeTactic.detectors
      ? [...activeTactic.detectors, ...this.detectors]
      : this.detectors;
    const mergedHandlers = activeTactic.handlers
      ? [...activeTactic.handlers, ...this.handlers]
      : this.handlers;
    const changes = runPipeline({
      self: this,
      world,
      detectors: mergedDetectors,
      handlers: mergedHandlers,
    });

    let interruptReason: string | null = null;
    for (const c of changes) {
      if (c.type === "interrupt") interruptReason = c.reason;
    }
    if (interruptReason !== null) {
      this.tacticSelector.forceRescore(this, world, interruptReason);
      activeTactic = this.tacticSelector.currentTactic;
    }
    for (const c of changes) {
      if (c.type === "forceMovementState" && c.state === "dashing") {
        const policy = activeTactic.dodgePolicy?.(this, world) ?? "always";
        if (policy === "never") {
          console.log(
            `${this.id} ${activeTactic.id} policy blocked dodge`
          );
        } else {
          this.tryEnterDash(c.direction);
        }
      } else if (c.type === "observe") {
        activeTactic.onObserve?.(c.key, c.value);
      }
    }

    const yieldReason = activeTactic.shouldYield?.(this, world) ?? null;
    if (yieldReason !== null) {
      this.tacticSelector.forceRescore(this, world, `yield:${yieldReason}`);
      activeTactic = this.tacticSelector.currentTactic;
    }

    const output: TacticOutput = activeTactic.update(dt, this, world);
    this.currentMoveIntent = output.moveIntent;
    this.currentPaceHint = output.paceHint;
    this.currentFacingIntent = output.facingIntent;

    this.updateState(dt, output.paceHint);

    const isDashing = this.state === "dashing";
    const moveVec = this.resolveMoveVector(world, isDashing);

    let facingIntent3 = this.resolveFacingVector();
    if (this.state === "sprinting") {
      facingIntent3 = this.clampToCone(
        facingIntent3,
        this.body.velocity,
        SPRINT_FACING_CONE,
        moveVec
      );
    }
    this.updateFacing(dt, facingIntent3);

    const baseMaxSpeed = this.body.stats.maxSpeed;
    if (!isDashing && this.state !== "sprinting") {
      this.body.stats.maxSpeed = baseMaxSpeed * this.strafeScale(moveVec);
    }

    if (this.state === "idle") {
      this.body.clearIntent();
    } else {
      this.body.setIntent(moveVec);
    }
    this.body.update(dt);
    this.body.stats.maxSpeed = baseMaxSpeed;

    this.enforceArenaBounds(world);

    this.body.position.y = FLOAT_HEIGHT;
    this.mesh.position.copy(this.body.position);

    this.updateTrail(dt);

    activeTactic.maybeCast?.(dt, this, world, this.castController);
    this.updateChargedSpell();

    this.status.update(
      this.hp / 100,
      this.stamina / STAMINA_MAX,
      this.body.position,
      RADIUS * 1.8,
      world.camera.quaternion
    );

    if (this.id === "red") {
      this.debugLogTimer -= dt;
      if (this.debugLogTimer <= 0) {
        this.debugLogTimer = 0.4;
        const speed = Math.hypot(this.body.velocity.x, this.body.velocity.z);
        const nowS = nowSeconds();
        const cooldowns = this.spellbook
          .map((f) => {
            const r = this.readyAt.get(f) ?? 0;
            const left = Math.max(0, r - nowS);
            return `${f.metadata.id}=${left.toFixed(1)}`;
          })
          .join(" ");
        console.log(
          `red state=${this.state} spd=${speed.toFixed(0)} stam=${this.stamina.toFixed(1)} tactic=${activeTactic.id} pace=${this.currentPaceHint} cd[${cooldowns}]`
        );
      }
    }
  }

  private hasLivingEnemy(world: World): boolean {
    for (const c of world.contestants) {
      if (c !== this && c.alive) return true;
    }
    return false;
  }

  private resolveMoveVector(world: World, isDashing: boolean): THREE.Vector3 {
    if (isDashing) return this.dashDir;
    let intent = this.currentMoveIntent;
    if (isStationary(intent) && !this.hasLivingEnemy(world)) {
      intent = { x: this.wanderDir.x, z: this.wanderDir.z };
    }
    if (isStationary(intent)) {
      this.moveScratch.set(0, 0, 0);
      return this.moveScratch;
    }
    toVector3(intent, this.moveScratch);
    return this.moveScratch;
  }

  private resolveFacingVector(): THREE.Vector3 {
    const intent = this.currentFacingIntent;
    if (isStationary(intent)) {
      return new THREE.Vector3(this.facing.x, 0, this.facing.z);
    }
    const len = Math.hypot(intent.x, intent.z);
    if (len < 1e-4) {
      return new THREE.Vector3(this.facing.x, 0, this.facing.z);
    }
    return new THREE.Vector3(intent.x / len, 0, intent.z / len);
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
    let sign: 1 | -1;
    if (Math.abs(cross) < 0.1) {
      // Desired is near-antiparallel to reference; cross sign would flip
      // every frame from velocity wobble, snapping facing across the body.
      // Pick the hemisphere matching the current facing for stability.
      const facingCross = rx * this.facing.z - rz * this.facing.x;
      sign = facingCross >= 0 ? 1 : -1;
    } else {
      sign = cross >= 0 ? 1 : -1;
    }
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
    const sampling = this.state === "sprinting" || this.state === "dashing";
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

  private updateState(dt: number, paceHint: PaceHint): void {
    if (this.state === "charging") {
      this.stateTimer -= dt;
      this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN * dt);
      const c = this.getComponent(Charging);
      if (c) c.remaining = this.stateTimer;
      if (this.stateTimer <= 0) this.setState("running");
      return;
    }
    if (this.state === "recovering") {
      this.stateTimer -= dt;
      this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN * dt);
      const r = this.getComponent(Recovering);
      if (r) r.remaining = this.stateTimer;
      if (this.stateTimer <= 0) this.setState("running");
      return;
    }
    if (this.state === "dashing") {
      this.stateTimer -= dt;
      const d = this.getComponent(Dashing);
      if (d) d.remaining = this.stateTimer;
      if (this.stateTimer <= 0) {
        this.setState("recovering", DASH_RECOVERY_DURATION);
      }
      return;
    }

    // Hysteresis: entering sprint requires being well-rested
    // (SPRINT_MIN_STAMINA_TO_START), but once sprinting we keep going
    // until stamina drops below SPRINT_MIN_STAMINA_TO_HOLD. Without this,
    // the wizard flickers across a single threshold every frame, which
    // makes facing oscillate (the cone clamp toggles with state).
    const wantsSprintHold =
      paceHint === "sprint" &&
      this.stamina > SPRINT_MIN_STAMINA_TO_HOLD;
    const wantsSprintEntry =
      paceHint === "sprint" &&
      this.stamina > SPRINT_MIN_STAMINA_TO_START;

    if (this.state === "sprinting") {
      this.stamina -= STAMINA_SPRINT_DRAIN * dt;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.setState("recovering", RECOVERY_DURATION);
        return;
      }
      if (!wantsSprintHold) this.setState("running");
      return;
    }

    this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN * dt);

    if (wantsSprintEntry) {
      this.setState("sprinting");
      return;
    }

    const speed = Math.hypot(this.body.velocity.x, this.body.velocity.z);
    const moving = !isStationary(this.currentMoveIntent);
    if (paceHint === "walk") {
      this.setState(moving ? "walking" : "idle");
    } else if (!moving && speed < 5) {
      this.setState("idle");
    } else {
      this.setState("running");
    }
  }

  private setState(next: MovementState, stateDuration = 0): void {
    if (this.state === next) return;
    const prev = this.state;
    this.state = next;
    this.body.stats = { ...STATE_STATS[next] };
    if (stateDuration > 0) this.stateTimer = stateDuration;

    if (prev === "charging") this.removeComponent(Charging);
    if (prev === "dashing") this.removeComponent(Dashing);
    if (prev === "recovering") this.removeComponent(Recovering);

    if (next === "charging") {
      this.addComponent(Charging, {
        target: this.chargeTarget,
        remaining: stateDuration > 0 ? stateDuration : CHARGE_DURATION,
        totalDuration: stateDuration > 0 ? stateDuration : CHARGE_DURATION,
      });
    } else if (next === "dashing") {
      this.addComponent(Dashing, { remaining: stateDuration });
    } else if (next === "recovering") {
      this.addComponent(Recovering, { remaining: stateDuration });
    }
  }

  private updateChargedSpell(): void {
    if (!this.chargedSpell) return;
    const aim = this.chargeTarget
      ? this.chargeTarget.position.clone().sub(this.body.position).normalize()
      : this.facing;
    if (this.chargedSpell instanceof Projectile) {
      this.chargedSpell.setPosition(
        this.body.position.x + aim.x * (this.radius + 6),
        this.body.position.y + 8,
        this.body.position.z + aim.z * (this.radius + 6)
      );
    }
    if (this.state !== "charging") {
      this.releaseCharge();
    }
  }

  _ccRequestCast(
    factory: SpellFactory,
    target: Contestant | null,
    aim: Vec2,
    modifier?: SpellModifier
  ): boolean {
    const effective = computeEffectiveMetadata(factory, modifier);
    if (!this.alive) {
      emit("cast_request", this.id, {
        factory: factory.metadata.id,
        modifier: modifier?.id ?? null,
        effectiveSpellId: effective.id,
        targetId: target?.id ?? null,
        accepted: false,
        reason: "dead",
      });
      return false;
    }
    if (
      this.state === "sprinting" ||
      this.state === "recovering" ||
      this.state === "dashing" ||
      this.state === "charging"
    ) {
      emit("cast_request", this.id, {
        factory: factory.metadata.id,
        modifier: modifier?.id ?? null,
        effectiveSpellId: effective.id,
        targetId: target?.id ?? null,
        accepted: false,
        reason: `state:${this.state}`,
      });
      return false;
    }
    if (!this._ccIsReady(factory)) {
      emit("cast_request", this.id, {
        factory: factory.metadata.id,
        modifier: modifier?.id ?? null,
        effectiveSpellId: effective.id,
        targetId: target?.id ?? null,
        accepted: false,
        reason: "cooldown",
      });
      return false;
    }

    this.chargeTarget = target;
    const aimVec = new THREE.Vector3(aim.x, 0, aim.z);
    if (aimVec.lengthSq() < 1e-6) aimVec.set(1, 0, 0);
    const spell = factory.create(this, target, aimVec, modifier) as Spell & {
      frozen: boolean;
    };
    spell.frozen = true;
    this.chargedSpell = spell;
    this.chargedFactory = factory;
    this.chargedModifier = modifier ?? null;
    this.chargedSpeed = effective.baseSpeed ?? 0;
    this._cachedWorldForCast?.addSpell(spell);
    this.setState(
      "charging",
      effective.chargeTime || CHARGE_DURATION
    );
    emit("cast_request", this.id, {
      factory: factory.metadata.id,
      modifier: modifier?.id ?? null,
      effectiveSpellId: effective.id,
      targetId: target?.id ?? null,
      accepted: true,
      chargeTime: effective.chargeTime,
      cooldown: effective.cooldown,
      distToTarget: target
        ? Math.max(
            0,
            Math.hypot(
              target.position.x - this.body.position.x,
              target.position.z - this.body.position.z
            ) -
              this.radius -
              target.radius
          )
        : null,
    });
    return true;
  }
  _ccCancelCharging(): void {
    if (!this.chargedSpell) return;
    this.chargedSpell.dead = true;
    this.chargedSpell = null;
    this.chargedFactory = null;
    this.chargedModifier = null;
    this.chargedSpeed = 0;
    this.chargeTarget = null;
    if (this.state === "charging") this.setState("running");
  }
  _ccUpdateAim(target: Contestant | null, _aim: Vec2): void {
    this.chargeTarget = target;
  }
  _ccIsCharging(): boolean {
    return this.chargedSpell !== null;
  }
  _ccCurrentFactory(): SpellFactory | null {
    return this.chargedFactory;
  }
  _ccIsReady(factory: SpellFactory): boolean {
    const readyAt = this.readyAt.get(factory) ?? 0;
    return readyAt <= nowSeconds();
  }

  private releaseCharge(): void {
    const spell = this.chargedSpell;
    const factory = this.chargedFactory;
    const modifier = this.chargedModifier;
    const target = this.chargeTarget;
    const projectileSpeed = this.chargedSpeed;
    if (!spell || !factory) return;

    if (spell instanceof Projectile && target) {
      const aim = this.computeAimDirection(target, projectileSpeed);
      spell.setVelocityFromDirection(aim);
      this.shotsFired++;
    }
    spell.frozen = false;
    this.chargedSpell = null;
    this.chargedFactory = null;
    this.chargedModifier = null;
    this.chargedSpeed = 0;
    this.chargeTarget = null;
    const effective = computeEffectiveMetadata(factory, modifier ?? undefined);
    const cooldown = effective.cooldown || 1.0;
    this.readyAt.set(factory, nowSeconds() + cooldown);
    emit("cast_release", this.id, {
      factory: factory.metadata.id,
      modifier: modifier?.id ?? null,
      effectiveSpellId: effective.id,
      targetId: target?.id ?? null,
    });
  }

  private computeAimDirection(
    target: Contestant,
    projectileSpeed: number
  ): THREE.Vector3 {
    const dx = target.position.x - this.body.position.x;
    const dz = target.position.z - this.body.position.z;
    const vx = target.velocity.x;
    const vz = target.velocity.z;
    const s = projectileSpeed;
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
    } else if (p.x > halfW) {
      p.x = halfW;
      if (v.x > 0) v.x = 0;
    }
    if (p.z < -halfD) {
      p.z = -halfD;
      if (v.z < 0) v.z = 0;
    } else if (p.z > halfD) {
      p.z = halfD;
      if (v.z > 0) v.z = 0;
    }
  }

  private tryEnterDash(direction: THREE.Vector3): void {
    if (
      this.state === "dashing" ||
      this.state === "recovering" ||
      this.state === "charging"
    )
      return;
    if (this.dashCooldown > 0) return;
    if (this.stamina < DASH_MIN_STAMINA) return;

    this.dashDir.copy(direction);
    this.body.velocity.x = this.dashDir.x * DASH_IMPULSE_SPEED;
    this.body.velocity.z = this.dashDir.z * DASH_IMPULSE_SPEED;
    emit("dash", this.id, { dirX: direction.x, dirZ: direction.z });
    const staminaFrac = Math.min(1, this.stamina / DASH_STAMINA_COST);
    this.stamina = Math.max(
      0,
      this.stamina - DASH_STAMINA_COST * staminaFrac
    );
    this.dashCooldown = DASH_COOLDOWN;
    const dashDuration =
      DASH_DURATION_MIN +
      (DASH_DURATION_MAX - DASH_DURATION_MIN) * staminaFrac;
    this.setState("dashing", dashDuration);
  }

}
