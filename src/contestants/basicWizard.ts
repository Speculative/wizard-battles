import { Vector3 } from "../math";
import { computeAimSolution } from "./aim";
import type { Contestant } from "./contestant";
import type { World } from "../world";
import { FireballFactory } from "../spells/fireball";
import { Projectile, isProjectileFactory, isProjectileModifier, specToMetadata } from "../spells/projectile";
import type { Spell, SpellFactory, SpellMetadata, SpellModifier } from "../spells/spell";
import { KinematicBody, type MovementStats } from "../kinematics";
import { DEFAULT_MOVEMENT_STATS, type MovementState } from "./movement";
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
import { Channeling, Charging, Dashing, Recovering } from "../components";

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


const FACING_TURN_RATE = Math.PI * 2.5;
const SPRINT_FACING_CONE = (Math.PI * 5) / 12;

const STRAFE_SIDE_SCALE = 0.6;
const STRAFE_BACK_SCALE = 0.4;

export interface BasicWizardOptions {
  id: string;
  world: World;
  color: number;
  start: Vector3;
  roster: RosterEntry[];
  spellbook?: SpellFactory[];
  modifiers?: SpellModifier[];
  movement?: Partial<Record<MovementState, Partial<MovementStats>>>;
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
  readonly color: number;
  readonly world: World;
  readonly radius = RADIUS;
  hp = 100;
  alive = true;

  private readonly body: KinematicBody;
  private readonly movement: Record<MovementState, MovementStats>;
  readonly facing = new Vector3(1, 0, 0);
  private readonly wanderDir = new Vector3();
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
  private readonly dashDir = new Vector3();
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
  private currentFacingIntent: Vec2 = { x: 0, z: 0 };
  private readonly moveScratch = new Vector3();

  getComponent<T>(key: ComponentKey<T>): T | undefined {
    return this.components.get(key.id) as T | undefined;
  }
  addComponent<T>(key: ComponentKey<T>, data: T): void {
    this.components.set(key.id, data);
  }
  removeComponent<T>(key: ComponentKey<T>): void {
    this.components.delete(key.id);
  }
  private readonly tacticSelector: TacticSelector;

  get position(): Vector3 {
    return this.body.position;
  }
  get velocity(): Vector3 {
    return this.body.velocity;
  }

  constructor(opts: BasicWizardOptions) {
    this.id = opts.id;
    this.color = opts.color;
    this.world = opts.world;
    this.spellbook = [...(opts.spellbook ?? [FireballFactory])];
    this.modifiers = [...(opts.modifiers ?? [])];
    this.movement = Object.fromEntries(Object.entries(DEFAULT_MOVEMENT_STATS).map(([state, stats]) =>
      [state, { ...stats, ...opts.movement?.[state as MovementState] }]
    )) as Record<MovementState, MovementStats>;
    this.body = new KinematicBody({ ...this.movement.running }, opts.start);
    this.body.position.y = FLOAT_HEIGHT;
    this.tacticSelector = new TacticSelector(opts.roster, opts.id);
    this.castController = new WizardCastController(this);

    const angle = this.world.random() * Math.PI * 2;
    this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
    this.facing.copy(this.wanderDir);
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
    if (!this.alive) {
      if (this.chargedSpell) {
        this.chargedSpell.dead = true;
        this.chargedSpell = null;
        this.chargedFactory = null;
      }
      return;
    }

    this.dashCooldown = Math.max(0, this.dashCooldown - dt);

    this.turnTimer -= dt;
    if (this.turnTimer <= 0) {
      const angle = this.world.random() * Math.PI * 2;
      this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
      this.turnTimer = 0.8 + this.world.random() * 1.6;
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
          this.world.emit("dash_refused", this.id, { reason: "tactic_policy", tactic: activeTactic.id });
        } else {
          this.tryEnterDash(c.direction);
        }
      } else if (c.type === "observe") {
        activeTactic.onObserve?.(c.key, c.value, world);
      }
    }

    const yieldReason = activeTactic.shouldYield?.(this, world) ?? null;
    if (yieldReason !== null) {
      this.tacticSelector.forceRescore(this, world, `yield:${yieldReason}`);
      activeTactic = this.tacticSelector.currentTactic;
    }

    const output: TacticOutput = activeTactic.update(dt, this, world);
    this.currentMoveIntent = output.moveIntent;
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

    activeTactic.maybeCast?.(dt, this, world, this.castController);
    this.updateChargedSpell();

  }

  private hasLivingEnemy(world: World): boolean {
    for (const c of world.contestants) {
      if (c !== this && c.alive) return true;
    }
    return false;
  }

  private resolveMoveVector(world: World, isDashing: boolean): Vector3 {
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

  private resolveFacingVector(): Vector3 {
    const intent = this.currentFacingIntent;
    if (isStationary(intent)) {
      return new Vector3(this.facing.x, 0, this.facing.z);
    }
    const len = Math.hypot(intent.x, intent.z);
    if (len < 1e-4) {
      return new Vector3(this.facing.x, 0, this.facing.z);
    }
    return new Vector3(intent.x / len, 0, intent.z / len);
  }

  private clampToCone(
    desired: Vector3,
    reference: Vector3,
    maxAngle: number,
    fallback: Vector3
  ): Vector3 {
    const refLen = Math.hypot(reference.x, reference.z);
    if (refLen < 1e-3) return fallback;
    const rx = reference.x / refLen;
    const rz = reference.z / refLen;
    const dLen = Math.hypot(desired.x, desired.z);
    if (dLen < 1e-3) return new Vector3(rx, 0, rz);
    const dx = desired.x / dLen;
    const dz = desired.z / dLen;
    const dot = rx * dx + rz * dz;
    const clamped = Math.max(-1, Math.min(1, dot));
    const angle = Math.acos(clamped);
    if (angle <= maxAngle) return new Vector3(dx, 0, dz);
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
    return new Vector3(rx * cos - rz * sin, 0, rx * sin + rz * cos);
  }

  private strafeScale(moveIntent: Vector3): number {
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

  private updateFacing(dt: number, intent: Vector3): void {
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
    if (this.state === "channeling") {
      this.stateTimer -= dt;
      this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN * dt);
      const c = this.getComponent(Channeling);
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
    this.world.emit("movement_state", this.id, { from: prev, to: next });
    this.body.stats = { ...this.movement[next] };
    if (stateDuration > 0) this.stateTimer = stateDuration;

    if (prev === "charging") this.removeComponent(Charging);
    if (prev === "channeling") this.removeComponent(Channeling);
    if (prev === "dashing") this.removeComponent(Dashing);
    if (prev === "recovering") this.removeComponent(Recovering);

    if (next === "charging") {
      this.addComponent(Charging, {
        target: this.chargeTarget,
        remaining: stateDuration > 0 ? stateDuration : CHARGE_DURATION,
        totalDuration: stateDuration > 0 ? stateDuration : CHARGE_DURATION,
      });
    } else if (next === "channeling") {
      this.addComponent(Channeling, {
        target: this.chargeTarget,
        remaining: stateDuration > 0 ? stateDuration : CHARGE_DURATION,
        totalDuration: stateDuration > 0 ? stateDuration : CHARGE_DURATION,
        spellId: this.chargedFactory?.metadata.id ?? "",
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
      if (this.chargedSpell.spec.aimMode === "groundTarget" && this.chargeTarget) {
        // A live preview follows the authoritative target until release locks the endpoint.
        // Zero-noise aiming is pure and consumes no gameplay random values.
        const preview = computeAimSolution(this.position, this.chargeTarget,
          this.chargedSpeed, 0, this.shotsFired, this.world.random);
        const direction = preview.direction.normalize();
        this.chargedSpell.setDetonationPoint(
          this.position.x + direction.x * preview.leadDistance,
          this.position.z + direction.z * preview.leadDistance
        );
      }
    }
    if (this.state !== "charging" && this.state !== "channeling") {
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
      this.world.emit("cast_request", this.id, {
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
      this.state === "charging" ||
      this.state === "channeling"
    ) {
      this.world.emit("cast_request", this.id, {
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
      this.world.emit("cast_request", this.id, {
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
    const aimVec = new Vector3(aim.x, 0, aim.z);
    if (aimVec.lengthSq() < 1e-6) aimVec.set(1, 0, 0);
    const spell = factory.create(this, target, aimVec, modifier) as Spell & {
      frozen: boolean;
    };
    spell.frozen = true;
    this.chargedSpell = spell;
    this.chargedFactory = factory;
    this.chargedModifier = modifier ?? null;
    this.chargedSpeed = effective.baseSpeed ?? 0;
    this.world.addSpell(spell);
    const castMode: MovementState =
      effective.castMode === "channel" ? "channeling" : "charging";
    this.setState(castMode, effective.chargeTime || CHARGE_DURATION);
    this.world.emit("cast_request", this.id, {
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
    this.world.emit("cast_cancel", this.id, { spell: this.chargedFactory?.metadata.id ?? null });
    this.chargedSpell.dead = true;
    this.chargedSpell = null;
    this.chargedFactory = null;
    this.chargedModifier = null;
    this.chargedSpeed = 0;
    this.chargeTarget = null;
    if (this.state === "charging" || this.state === "channeling") {
      this.setState("running");
    }
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
    return readyAt <= this.world.time;
  }

  private releaseCharge(): void {
    const spell = this.chargedSpell;
    const factory = this.chargedFactory;
    const modifier = this.chargedModifier;
    const target = this.chargeTarget;
    const projectileSpeed = this.chargedSpeed;
    if (!spell || !factory) return;

    if (spell instanceof Projectile && target) {
      const noiseScale = spell.spec.aimNoiseScale ?? 1;
      const solution = computeAimSolution(
        this.position, target, projectileSpeed, noiseScale, this.shotsFired, this.world.random
      );
      spell.setVelocityFromDirection(solution.direction);
      if (spell.spec.aimMode === "groundTarget") {
        spell.setDetonationPoint(
          this.body.position.x + solution.direction.clone().normalize().x * solution.leadDistance,
          this.body.position.z + solution.direction.clone().normalize().z * solution.leadDistance
        );
      }
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
    this.readyAt.set(factory, this.world.time + cooldown);
    this.world.emit("cast_release", this.id, {
      factory: factory.metadata.id,
      modifier: modifier?.id ?? null,
      effectiveSpellId: effective.id,
      targetId: target?.id ?? null,
    });
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

  private tryEnterDash(direction: Vector3): void {
    if (
      this.state === "dashing" ||
      this.state === "recovering" ||
      this.state === "charging" ||
      this.state === "channeling"
    )
      return;
    if (this.dashCooldown > 0) return;
    if (this.stamina < DASH_MIN_STAMINA) return;

    this.dashDir.copy(direction);
    this.body.velocity.x = this.dashDir.x * DASH_IMPULSE_SPEED;
    this.body.velocity.z = this.dashDir.z * DASH_IMPULSE_SPEED;
    this.world.emit("dash", this.id, { dirX: direction.x, dirZ: direction.z });
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
