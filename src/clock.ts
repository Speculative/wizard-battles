/** Simulation time advances only through World.update; never wall-clock time. */
export class SimulationClock {
  tick = 0;
  seconds = 0;
  advance(dt: number): void {
    this.tick++;
    this.seconds += dt;
  }
}
