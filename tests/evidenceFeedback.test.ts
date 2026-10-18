import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPARISON_BRIEFS } from '../src/comparisonEvidence';
import { evidenceReference, notesForEvidence } from '../src/evidenceFeedback';
import { validateFeedback, type Note } from '../src/feedback';

const brief = COMPARISON_BRIEFS[1];
const reference = evidenceReference(brief.id, brief.clips[1]);
const scope = { experiment: 'movement-pacing-v1', scenario: brief.scenario, seed: brief.seed, rotation: 0 };
const note: Note = { ...scope, evidence: reference, at: '2026-10-18', source: 'old-ui-source', time: 10, panelTimes: [0, 40, 10], variants: ['baseline', 'measured', 'burst'], preference: 'unsure', text: 'I like the renewed contact.' };

test('evidence feedback follows exact selection, not variant or UI source alone', () => {
  assert.deepEqual(notesForEvidence([note], scope, reference), [note]);
  assert.equal(notesForEvidence([{ ...note, evidence: undefined }], scope, reference).length, 0);
  assert.equal(notesForEvidence([note], { ...scope, seed: 7 }, reference).length, 0);
  assert.equal(notesForEvidence([note], { ...scope, rotation: Math.PI / 2 }, reference).length, 0);
  for (const changed of [{ revision: 2 }, { start: 9 }, { end: 13 }, { id: 'other-clip' }, { variant: 'measured' }]) {
    assert.equal(notesForEvidence([note], scope, { ...reference, ...changed }).length, 0);
  }
  const ids = COMPARISON_BRIEFS.flatMap(b => b.clips.map(c => c.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('attached feedback survives JSON and rejects malformed evidence references', () => {
  const feedback = { schema: 'wizard-battles-feedback-v1', expectations: [], notes: [note] };
  validateFeedback(JSON.parse(JSON.stringify(feedback)));
  for (const change of [{ revision: 0 }, { start: NaN }, { end: 4 }, { variant: null }]) {
    assert.throws(() => validateFeedback({ ...feedback, notes: [{ ...note, evidence: { ...reference, ...change } }] }), /Invalid evidence reference/);
  }
});
