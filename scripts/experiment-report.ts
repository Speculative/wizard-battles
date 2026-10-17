interface Event { t: number; type: string; who: string | null; meta?: Record<string, any> }
interface Frame { t: number; who: string; hp: number; vx: number; vz: number; state: string }
interface Identity { runId: string; scenario: string; seed: number; rotation: number; variant: string; reason: string; winner: string | null; duration: number }
export function summarizeRun(identity: Identity, events: Event[], frames: Frame[]) {
  const damage = events.filter(e => e.type === 'damage');
  const damageTimes = [0, ...damage.map(e => e.t), identity.duration];
  const gaps = damageTimes.slice(1).map((t, i) => t - damageTimes[i]);
  const hp: Record<string, number> = {};
  for (const f of frames) hp[f.who] = f.hp;
  for (const e of damage) hp[e.meta!.victim] = e.meta!.hpAfter;
  const damageBySpell: Record<string, number> = {};
  for (const e of damage) damageBySpell[e.meta!.spell] = (damageBySpell[e.meta!.spell] ?? 0) + e.meta!.amount;
  const movementSamples: Record<string, number> = {};
  for (const frame of frames) movementSamples[frame.state] = (movementSamples[frame.state] ?? 0) + 1;
  return { ...identity, hp, damageEvents: damage.length, damageBySpell, maxDamageGap: Math.max(...gaps), firstDamage: damage[0]?.t ?? null,
    releases: events.filter(e => e.type === 'cast_release').length,
    dashes: events.filter(e => e.type === 'dash').length,
    meanSpeed: frames.length ? frames.reduce((sum, f) => sum + Math.hypot(f.vx, f.vz), 0) / frames.length : null,
    movementSamples,
    // Opening context plus a bounded, unranked sample of consequences. Full logs are retained.
    evidence: events.filter(e => ['damage', 'death', 'dash', 'blink', 'cast_release'].includes(e.type)).slice(0, 24),
  };
}
export function aggregate(runs: ReturnType<typeof summarizeRun>[]) {
  return [...new Set(runs.map(r => `${r.scenario}/${r.variant}`))].map(group => {
    const selected = runs.filter(r => `${r.scenario}/${r.variant}` === group);
    const distribution = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return { min: sorted[0], median: sorted[Math.floor(sorted.length / 2)], max: sorted.at(-1), mean: values.reduce((a, b) => a + b, 0) / values.length };
    };
    const winners: Record<string, number> = {};
    for (const r of selected) winners[r.winner ?? r.reason] = (winners[r.winner ?? r.reason] ?? 0) + 1;
    return { group, matches: selected.length, winners, duration: distribution(selected.map(r => r.duration)), damageEvents: distribution(selected.map(r => r.damageEvents)), maxDamageGap: distribution(selected.map(r => r.maxDamageGap)), meanSpeed: distribution(selected.flatMap(r => r.meanSpeed === null ? [] : [r.meanSpeed])) };
  });
}
