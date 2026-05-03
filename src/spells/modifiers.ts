import type { ProjectileModifier, ProjectileSpec } from "./projectile";

const HEAVY_CHARGE_MUL = 4.5;
const HEAVY_COOLDOWN_MUL = 3.5;
const HEAVY_DAMAGE_MUL = 1.8;
const HEAVY_RADIUS_MUL = 1.6;
const HEAVY_SPEED_MUL = 0.85;
const HEAVY_AOE_RADIUS = 110;
const HEAVY_AIM_NOISE_SCALE = 0.2;
const HEAVY_TELEGRAPH_COLOR = 0xff7020;

const SPREAD_COUNT = 5;
const SPREAD_FAN = Math.PI / 4;
const SPREAD_DAMAGE_MUL = 0.45;
const SPREAD_RADIUS_MUL = 0.75;
const SPREAD_CHARGE_MUL = 1.6;
const SPREAD_COOLDOWN_MUL = 2.5;
const SPREAD_TELEGRAPH_LENGTH = 320;
const SPREAD_TELEGRAPH_COLOR = 0xff7020;

export const Spread: ProjectileModifier = {
  id: "spread",
  tags: ["spread", "multishot"],
  apply(base: ProjectileSpec): ProjectileSpec {
    return {
      ...base,
      id: `${base.id}+spread`,
      damage: base.damage * SPREAD_DAMAGE_MUL,
      radius: base.radius * SPREAD_RADIUS_MUL,
      chargeTime: base.chargeTime * SPREAD_CHARGE_MUL,
      cooldown: base.cooldown * SPREAD_COOLDOWN_MUL,
      tags: [...base.tags, "spread", "multishot"],
      emission: {
        count: SPREAD_COUNT,
        spreadAngle: SPREAD_FAN,
        interval: 0,
      },
      telegraph: {
        kind: "ground-fan",
        color: SPREAD_TELEGRAPH_COLOR,
        length: SPREAD_TELEGRAPH_LENGTH,
        arcRadians: SPREAD_FAN,
      },
      aimNoiseScale: 0.4,
    };
  },
};

const SWARM_COUNT = 8;
const SWARM_FAN = (Math.PI * 2) / 3;
const SWARM_DAMAGE_MUL = 0.32;
const SWARM_RADIUS_MUL = 0.65;
const SWARM_SPEED_MUL = 1.25;
const SWARM_CHARGE_MUL = 2.0;
const SWARM_COOLDOWN_MUL = 3.2;
const SWARM_HOMING_TURN_RATE = 1.6;
const SWARM_HOMING_RANGE = 500;

export const Swarm: ProjectileModifier = {
  id: "swarm",
  tags: ["swarm", "multishot", "homing"],
  apply(base: ProjectileSpec): ProjectileSpec {
    return {
      ...base,
      id: `${base.id}+swarm`,
      damage: base.damage * SWARM_DAMAGE_MUL,
      radius: base.radius * SWARM_RADIUS_MUL,
      speed: base.speed * SWARM_SPEED_MUL,
      chargeTime: base.chargeTime * SWARM_CHARGE_MUL,
      cooldown: base.cooldown * SWARM_COOLDOWN_MUL,
      tags: [...base.tags, "swarm", "multishot", "homing"],
      emission: {
        count: SWARM_COUNT,
        spreadAngle: SWARM_FAN,
        interval: 0,
        perChildAimJitter: 0.08,
      },
      homing: {
        turnRate: SWARM_HOMING_TURN_RATE,
        range: SWARM_HOMING_RANGE,
      },
      aimNoiseScale: 0.3,
    };
  },
};

const GATLING_COUNT = 6;
const GATLING_FAN = Math.PI / 16;
const GATLING_INTERVAL = 0.18;
const GATLING_DAMAGE_MUL = 0.5;
const GATLING_RADIUS_MUL = 0.7;
const GATLING_CHARGE_MUL = 1.5;
const GATLING_COOLDOWN_MUL = 3.5;

export const Gatling: ProjectileModifier = {
  id: "gatling",
  tags: ["gatling", "multishot"],
  apply(base: ProjectileSpec): ProjectileSpec {
    return {
      ...base,
      id: `${base.id}+gatling`,
      damage: base.damage * GATLING_DAMAGE_MUL,
      radius: base.radius * GATLING_RADIUS_MUL,
      chargeTime: base.chargeTime * GATLING_CHARGE_MUL,
      cooldown: base.cooldown * GATLING_COOLDOWN_MUL,
      tags: [...base.tags, "gatling", "multishot"],
      emission: {
        count: GATLING_COUNT,
        spreadAngle: GATLING_FAN,
        interval: GATLING_INTERVAL,
        followCaster: true,
        perChildAimJitter: 0.04,
      },
      aimNoiseScale: 0.35,
    };
  },
};

export const Heavy: ProjectileModifier = {
  id: "heavy",
  tags: ["heavy", "aoe"],
  apply(base: ProjectileSpec): ProjectileSpec {
    const damage = base.damage * HEAVY_DAMAGE_MUL;
    const radius = base.radius * HEAVY_RADIUS_MUL;
    const aoeRadius = HEAVY_AOE_RADIUS;
    return {
      ...base,
      id: `${base.id}+heavy`,
      speed: base.speed * HEAVY_SPEED_MUL,
      radius,
      damage,
      chargeTime: base.chargeTime * HEAVY_CHARGE_MUL,
      cooldown: base.cooldown * HEAVY_COOLDOWN_MUL,
      tags: [...base.tags, "heavy", "aoe"],
      aoe: {
        radius: aoeRadius,
        damageAtCenter: damage,
        falloff: "linear",
      },
      telegraph: {
        kind: "ground-circle",
        color: HEAVY_TELEGRAPH_COLOR,
        maxRadius: aoeRadius,
      },
      aimMode: "groundTarget",
      aimNoiseScale: HEAVY_AIM_NOISE_SCALE,
      visual: {
        ...base.visual,
        layers: base.visual.layers.map((l) => ({
          ...l,
          opacity: Math.min(1, l.opacity * 1.15),
        })),
      },
    };
  },
};
