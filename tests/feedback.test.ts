import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { feedbackServer } from '../scripts/feedback-server';
import { mergeFeedback, type Feedback } from '../src/feedback';
import { initialExpectations } from '../src/expectations';

const empty = (): Feedback => ({ schema: 'wizard-battles-feedback-v1', expectations: initialExpectations(), notes: [] });
test('merging older browsers retains newer decisions and both histories', () => {
  const current = empty(); const old = empty();
  current.expectations[0].history.push({ at: '2099-01-02', decision: 'removed', text: 'New wording', target: 'Free text', notes: '' });
  old.expectations[0].history.push({ at: '2099-01-01', decision: 'approved', text: 'Older wording', target: '', notes: '' });
  const merged = mergeFeedback(current, old);
  assert.equal(merged.expectations[0].text, 'New wording');
  assert.equal(merged.expectations[0].decision, 'removed');
  assert.equal(merged.expectations[0].history.length, current.expectations[0].history.length + 1);
  assert.deepEqual(mergeFeedback(merged, old), merged);
});

test('workspace snapshots survive independent clients and reject invalid writes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'wizard-feedback-test-'));
  const previous = process.env.WIZARD_FEEDBACK_DIR;
  process.env.WIZARD_FEEDBACK_DIR = directory;
  const server = await createServer({ configFile: false, plugins: [feedbackServer()], server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
  try {
    await server.listen();
    const url = new URL('/api/feedback', server.resolvedUrls!.local[0]);
    const first = empty();
    first.notes.push({ at: '2026-10-18', experiment: 'movement-pacing-v1', source: 'test', scenario: 'duel', seed: 7, rotation: 0, time: 12, panelTimes: [12], variants: ['baseline'], preference: 'A', text: 'First browser' });
    const second = empty(); second.notes.push({ ...first.notes[0], text: 'Second browser' });
    const post = (value: unknown, origin?: string) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(value) });
    const replies = await Promise.all([post(first), post(second)]);
    assert.ok(replies.every(r => r.status === 201));
    const files = await readdir(directory); assert.equal(files.length, 2);
    for (const file of files) assert.ok(JSON.parse(await readFile(join(directory, file), 'utf8')).feedback.notes.length);
    const saved = await (await fetch(url)).json();
    assert.deepEqual(new Set(saved.feedback.notes.map((n: { text: string }) => n.text)), new Set(['First browser', 'Second browser']));
    assert.equal((await post({ schema: 'wrong' })).status, 400);
    assert.equal((await post(first, 'https://unrelated.example')).status, 403);
    assert.equal((await readdir(directory)).length, 2);
  } finally {
    await server.close(); await rm(directory, { recursive: true, force: true });
    if (previous === undefined) delete process.env.WIZARD_FEEDBACK_DIR; else process.env.WIZARD_FEEDBACK_DIR = previous;
  }
});
