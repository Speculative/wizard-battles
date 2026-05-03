import {
  makeProjectileFactory,
  Projectile,
  type ProjectileFactory,
  type ProjectileSpec,
} from "./projectile";

export const FIREBALL_SPEED = 260;

export const FIREBALL_SPEC: ProjectileSpec = {
  id: "fireball",
  element: "fire",
  speed: FIREBALL_SPEED,
  radius: 10,
  damage: 10,
  lifetime: 6,
  range: { min: 60, max: 600 },
  chargeTime: 0.45,
  cooldown: 1.4,
  tags: ["ranged", "projectile"],
  visual: {
    shape: {
      kind: "fire-spheres",
      layers: [
        { scale: 0.55, color: 0xffb040, opacity: 1.0 },
        { scale: 0.85, color: 0xff5008, opacity: 0.55 },
        { scale: 1.1, color: 0xc02000, opacity: 0.35 },
        { scale: 1.35, color: 0x600400, opacity: 0.18 },
      ],
    },
    trailColor: 0xff6622,
  },
};

export const FireballFactory: ProjectileFactory =
  makeProjectileFactory(FIREBALL_SPEC);

export const FIREBALL_METADATA = FireballFactory.metadata;

export { Projectile as Fireball };
