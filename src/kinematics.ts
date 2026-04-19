import * as THREE from "three";

export interface MovementStats {
  maxSpeed: number;
  acceleration: number;
  friction: number;
  turnRate: number;
}

export class KinematicBody {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  stats: MovementStats;
  private readonly intent = new THREE.Vector3();
  private hasIntent = false;

  constructor(stats: MovementStats, initial?: THREE.Vector3) {
    this.stats = stats;
    if (initial) this.position.copy(initial);
  }

  setIntent(dir: THREE.Vector3): void {
    const len = Math.hypot(dir.x, dir.z);
    if (len < 1e-6) {
      this.hasIntent = false;
      return;
    }
    this.intent.set(dir.x / len, 0, dir.z / len);
    this.hasIntent = true;
  }

  clearIntent(): void {
    this.hasIntent = false;
  }

  update(dt: number): void {
    const vx = this.velocity.x;
    const vz = this.velocity.z;
    const speed = Math.hypot(vx, vz);
    const { maxSpeed, acceleration, friction, turnRate } = this.stats;

    if (this.hasIntent) {
      let desiredX = this.intent.x * maxSpeed;
      let desiredZ = this.intent.z * maxSpeed;

      if (speed > 1e-3) {
        const vxn = vx / speed;
        const vzn = vz / speed;
        const dot = vxn * this.intent.x + vzn * this.intent.z;
        const clamped = Math.max(-1, Math.min(1, dot));
        const angleBetween = Math.acos(clamped);
        const maxRotate = turnRate * dt;
        if (angleBetween > maxRotate) {
          const cross = vxn * this.intent.z - vzn * this.intent.x;
          const sign = cross >= 0 ? 1 : -1;
          const rot = maxRotate * sign;
          const cos = Math.cos(rot);
          const sin = Math.sin(rot);
          const rx = vxn * cos - vzn * sin;
          const rz = vxn * sin + vzn * cos;
          desiredX = rx * maxSpeed;
          desiredZ = rz * maxSpeed;
        }
      }

      const dx = desiredX - vx;
      const dz = desiredZ - vz;
      const diffMag = Math.hypot(dx, dz);
      const step = acceleration * dt;
      if (diffMag <= step) {
        this.velocity.x = desiredX;
        this.velocity.z = desiredZ;
      } else {
        this.velocity.x += (dx / diffMag) * step;
        this.velocity.z += (dz / diffMag) * step;
      }
    } else if (speed > 0) {
      const decel = friction * dt;
      if (decel >= speed) {
        this.velocity.x = 0;
        this.velocity.z = 0;
      } else {
        const k = (speed - decel) / speed;
        this.velocity.x *= k;
        this.velocity.z *= k;
      }
    }

    const newSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (newSpeed > maxSpeed) {
      const k = maxSpeed / newSpeed;
      this.velocity.x *= k;
      this.velocity.z *= k;
    }

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
  }
}
