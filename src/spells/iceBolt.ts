import { FIREBALL_SPEC } from "./fireball";
import {
  makeProjectileFactory,
  type ProjectileFactory,
  type ProjectileSpec,
} from "./projectile";
import { ICE_PALETTE } from "./particleBurst";

export const ICE_BOLT_SPEC: ProjectileSpec = {
  ...FIREBALL_SPEC,
  id: "iceBolt",
  element: "water",
  tags: ["ranged", "projectile", "ice"],
  visual: {
    shape: {
      kind: "ice-shard",
      bodyColor: 0xb8e4ff,
      edgeColor: 0xeaffff,
      lengthScale: 2.4,
      widthScale: 0.55,
    },
    trailColor: 0x99ccff,
    trailScale: 0.3,
    trailOpacity: 0.3,
    impact: {
      palette: ICE_PALETTE,
      explosionCoreColor: 0xc0e0ff,
      explosionHaloColor: 0x4080c0,
    },
  },
};

export const IceBoltFactory: ProjectileFactory =
  makeProjectileFactory(ICE_BOLT_SPEC);
