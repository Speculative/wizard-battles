import * as THREE from "three";
import type { Spell, SpellMetadata } from "./spell";
import type { Contestant } from "../contestants/contestant";
import type { World } from "../world";

const PARTICLE_BURST_METADATA: SpellMetadata = {
  id: "particleBurst",
  kind: "instant",
  element: "fire",
  range: { min: 0, max: 0 },
  chargeTime: 0,
  cooldown: 0,
  tags: ["fx", "internal"],
};

const PARTICLE_COUNT = 28;
const LIFETIME = 0.55;
const SPEED_MIN = 60;
const SPEED_MAX = 180;
const GRAVITY = 220;
const UPWARD_BIAS = 0.35;
const POINT_SIZE = 14;

export interface BurstPalette {
  inner: string;
  mid: string;
  outer: string;
  edge: string;
}

export const FIRE_PALETTE: BurstPalette = {
  inner: "rgba(255,140,40,1)",
  mid: "rgba(235,80,10,0.85)",
  outer: "rgba(180,30,0,0.3)",
  edge: "rgba(100,10,0,0)",
};

export const ICE_PALETTE: BurstPalette = {
  inner: "rgba(220,240,255,1)",
  mid: "rgba(120,180,240,0.85)",
  outer: "rgba(60,120,200,0.3)",
  edge: "rgba(20,40,80,0)",
};

const textureCache = new Map<string, THREE.Texture | null>();
function getPointTexture(palette: BurstPalette): THREE.Texture | null {
  const key = `${palette.inner}|${palette.mid}|${palette.outer}|${palette.edge}`;
  if (textureCache.has(key)) return textureCache.get(key) ?? null;
  if (typeof document === "undefined") {
    textureCache.set(key, null);
    return null;
  }
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  grad.addColorStop(0, palette.inner);
  grad.addColorStop(0.3, palette.mid);
  grad.addColorStop(0.7, palette.outer);
  grad.addColorStop(1, palette.edge);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

export class ParticleBurst implements Spell {
  readonly mesh: THREE.Points;
  readonly position: THREE.Vector3;
  readonly velocity = new THREE.Vector3();
  readonly caster: Contestant;
  readonly metadata = PARTICLE_BURST_METADATA;
  dead = false;
  private age = 0;
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly material: THREE.PointsMaterial;

  constructor(
    caster: Contestant,
    origin: THREE.Vector3,
    palette: BurstPalette = FIRE_PALETTE,
    options: { speedScale?: number } = {}
  ) {
    this.caster = caster;
    this.position = origin.clone();
    const speedScale = options.speedScale ?? 1;

    this.positions = new Float32Array(PARTICLE_COUNT * 3);
    this.velocities = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed =
        (SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN)) * speedScale;
      const sx = Math.sin(phi) * Math.cos(theta);
      const sy = Math.cos(phi);
      const sz = Math.sin(phi) * Math.sin(theta);
      this.velocities[i * 3] = sx * speed;
      this.velocities[i * 3 + 1] = sy * speed + UPWARD_BIAS * speed;
      this.velocities[i * 3 + 2] = sz * speed;
      this.positions[i * 3] = origin.x;
      this.positions[i * 3 + 1] = origin.y;
      this.positions[i * 3 + 2] = origin.z;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.PointsMaterial({
      size: POINT_SIZE,
      map: getPointTexture(palette),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      color: 0xffffff,
    });
    this.mesh = new THREE.Points(geo, this.material);
    this.mesh.frustumCulled = false;
  }

  update(dt: number, _world: World): void {
    this.age += dt;
    const t = this.age / LIFETIME;
    if (t >= 1) {
      this.dead = true;
      return;
    }
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const idx = i * 3;
      this.velocities[idx + 1] -= GRAVITY * dt;
      this.positions[idx] += this.velocities[idx] * dt;
      this.positions[idx + 1] += this.velocities[idx + 1] * dt;
      this.positions[idx + 2] += this.velocities[idx + 2] * dt;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    const fade = 1 - t;
    this.material.opacity = fade;
    this.material.size = POINT_SIZE * (0.6 + 0.4 * fade);
  }
}
