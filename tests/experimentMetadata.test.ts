import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { experimentGroups, type ExperimentMetadata } from '../src/experimentMetadata';

const sample: ExperimentMetadata = {
  id: 'new-experiment', title: 'New experiment', description: 'A new question', status: 'Proposed',
  group: { title: 'New topic', description: 'A topic', order: 3 }, round: 1, href: './new-viewer.html',
};
test('new topics and rounds are grouped and ordered without a registry', () => {
  const latest = { ...sample, id: 'new-experiment-v2', round: 2 };
  const earlierTopic = { ...sample, id: 'earlier-topic', group: { title: 'Earlier', description: 'Earlier topic', order: 0 } };
  assert.deepEqual(experimentGroups([sample, latest, earlierTopic]).map(group => group.rounds.map(round => round.id)), [['earlier-topic'], ['new-experiment-v2', 'new-experiment']]);
});
test('invalid metadata fails clearly', () => {
  assert.throws(() => experimentGroups([sample, sample]), /duplicate/);
  assert.throws(() => experimentGroups([{ ...sample, title: '' }]), /nonempty/);
  assert.throws(() => experimentGroups([{ ...sample, href: 'javascript:alert(1)' }]), /relative/);
  assert.throws(() => experimentGroups([{ ...sample, round: NaN }]), /ordering/);
});
test('all published rounds have valid metadata matching their filenames', async () => {
  const files = (await readdir('src/experiments')).filter(file => file.endsWith('.ts'));
  const metadata: ExperimentMetadata[] = [];
  for (const file of files) {
    const { default: entry } = await import(`../src/experiments/${file}`);
    assert.equal(entry.id, file.slice(0, -3));
    metadata.push(entry);
  }
  experimentGroups(metadata);
  for (const entry of await readdir('public/experiments', { withFileTypes: true })) {
    if (entry.isDirectory()) assert.ok(metadata.some(experiment => experiment.id === entry.name), entry.name);
  }
});
