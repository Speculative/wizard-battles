let mode: "real" | "virtual" = "real";
let virtualMs = 0;

export function useVirtualClock(initialMs = 0): void {
  mode = "virtual";
  virtualMs = initialMs;
}

export function useRealClock(): void {
  mode = "real";
}

export function advanceVirtualClock(seconds: number): void {
  virtualMs += seconds * 1000;
}

export function nowMs(): number {
  return mode === "virtual" ? virtualMs : performance.now();
}

export function nowSeconds(): number {
  return nowMs() / 1000;
}
