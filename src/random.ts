/** Mulberry32: owned by one world; never replaces process-global Math.random. */
export function seededRandom(seed: number): () => number {
  if (!Number.isSafeInteger(seed)) throw new Error('seed must be a safe integer');
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
