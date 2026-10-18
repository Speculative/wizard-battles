import type { Expectation } from './expectations';

export interface Note { at: string; experiment: string; source: string; scenario: string; seed: number; rotation: number; time: number; panelTimes: number[]; variants: string[]; preference: string; text: string }
export interface Feedback { schema: 'wizard-battles-feedback-v1'; expectations: Expectation[]; notes: Note[] }
export function validateFeedback(value: unknown): asserts value is Feedback {
  const data = value as Feedback;
  if (!data || data.schema !== 'wizard-battles-feedback-v1' || !Array.isArray(data.expectations) || !Array.isArray(data.notes)) throw new Error('Unrecognized feedback format');
  const ids = new Set<string>();
  const decisions = ['unreviewed', 'approved', 'declined', 'removed'];
  for (const e of data.expectations) {
    if (!e || !(['id', 'text', 'target', 'notes', 'provenance'] as const).every(k => typeof e[k] === 'string') || !decisions.includes(e.decision) || !Array.isArray(e.history) || ids.has(e.id)) throw new Error('Invalid or duplicate expectation');
    ids.add(e.id);
    for (const h of e.history) if (!h || !(['at', 'text', 'target', 'notes'] as const).every(k => typeof h[k] === 'string') || !decisions.includes(h.decision)) throw new Error('Invalid expectation history');
  }
  for (const n of data.notes) if (!n || !(['at', 'experiment', 'source', 'scenario', 'preference', 'text'] as const).every(k => typeof n[k] === 'string') || ![n.seed, n.rotation, n.time].every(Number.isFinite) || !Array.isArray(n.variants) || !n.variants.every(v => typeof v === 'string') || !Array.isArray(n.panelTimes) || !n.panelTimes.every(Number.isFinite)) throw new Error('Invalid viewing note');
}

// Union notes and histories so separate browsers cannot erase each other's work.
export function mergeFeedback(local: Feedback, incoming: Feedback): Feedback {
  const result = structuredClone(local);
  for (const entry of incoming.expectations) {
    const existing = result.expectations.find(e => e.id === entry.id);
    if (!existing) { result.expectations.push(structuredClone(entry)); continue; }
    const history = [...existing.history, ...entry.history]
      .filter((h, i, all) => all.findIndex(other => JSON.stringify(other) === JSON.stringify(h)) === i)
      .sort((a, b) => a.at.localeCompare(b.at));
    const latest = history.at(-1);
    if (latest) {
      const { at: _at, ...fields } = latest;
      Object.assign(existing, fields);
    }
    existing.history = history;
  }
  for (const note of incoming.notes) {
    if (!result.notes.some(n => JSON.stringify(n) === JSON.stringify(note))) result.notes.push(structuredClone(note));
  }
  return result;
}
