import type { ProjectileModifier, ProjectileSpec } from "./projectile";

const HEAVY_CHARGE_MUL = 4.5;
const HEAVY_COOLDOWN_MUL = 3.5;
const HEAVY_DAMAGE_MUL = 1.8;
const HEAVY_RADIUS_MUL = 1.6;
const HEAVY_SPEED_MUL = 0.7;
const HEAVY_AOE_RADIUS = 80;
const HEAVY_TELEGRAPH_COLOR = 0xff7020;

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
