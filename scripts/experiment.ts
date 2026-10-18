import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runMatch } from '../src/harness';
import { EXPERIMENT as MOVEMENT_EXPERIMENT, VARIANTS as MOVEMENT_VARIANTS, variantDefinition } from '../src/experiment';
import { SPELL_EXPERIMENT, SPELL_VARIANTS } from '../src/spellReadabilityExperiment';
import { REVISION_EXPERIMENT, REVISION_VARIANTS } from '../src/spellReadabilityRevision';
import { sourceIdentity } from './source-id';
import { summarizeRun, aggregate } from './experiment-report';

const args = process.argv.slice(2);
const flags = new Map<string, string>();
let publish = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--publish') { publish = true; continue; }
  if (!['--out', '--seeds', '--max', '--experiment'].includes(args[i]) || !args[i + 1]) throw new Error(`Unknown/incomplete option ${args[i]}`);
  flags.set(args[i].slice(2), args[++i]);
}
const experimentId = flags.get('experiment') ?? MOVEMENT_EXPERIMENT.id;
if (![MOVEMENT_EXPERIMENT.id, SPELL_EXPERIMENT.id, REVISION_EXPERIMENT.id].includes(experimentId)) throw new Error(`Unknown experiment: ${experimentId}`);
const isRevision = experimentId === REVISION_EXPERIMENT.id;
const isSpell = isRevision || experimentId === SPELL_EXPERIMENT.id;
const EXPERIMENT = isRevision ? REVISION_EXPERIMENT : isSpell ? SPELL_EXPERIMENT : MOVEMENT_EXPERIMENT;
// Presentation alternatives share one simulation trace per starting setup.
const VARIANTS = isSpell ? [variantDefinition('burst')] : MOVEMENT_VARIANTS;
const seeds = flags.has('seeds') ? flags.get('seeds')!.split(',').map(Number) : [...EXPERIMENT.seeds];
const maxSeconds = Number(flags.get('max') ?? EXPERIMENT.maxSeconds);
if (!seeds.length || !seeds.every(n => Number.isSafeInteger(n) && n >= 0 && n <= 0xffffffff) || new Set(seeds).size !== seeds.length) throw new Error('seeds must be distinct uint32 integers');
if (!Number.isFinite(maxSeconds) || maxSeconds <= 0 || maxSeconds > EXPERIMENT.maxSeconds) throw new Error('max must be positive and at most 120 seconds');
const output = resolve(flags.get('out') ?? `runs-experiment/${new Date().toISOString().replace(/[:.]/g, '-')}`);
// Fail instead of replacing earlier evidence.
mkdirSync(dirname(output), { recursive: true }); mkdirSync(output);
const provenance = { source: sourceIdentity(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), createdAt: new Date().toISOString(), dt: EXPERIMENT.dt, maxSeconds, seeds, scenarios: EXPERIMENT.scenarios, rotations: EXPERIMENT.rotations, node: process.version, sampleHz: 10 };
writeFileSync(join(output, 'provenance.json'), JSON.stringify(provenance, null, 2));
const sourceFiles = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'src', 'scripts', 'package.json', 'package-lock.json', 'vite.config.ts', 'index.html', 'compare.html', 'tsconfig.json'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
for (const file of new Set(sourceFiles)) { const dest = join(output, 'source', file); mkdirSync(dirname(dest), { recursive: true }); copyFileSync(file, dest); }
const runs: ReturnType<typeof summarizeRun>[] = [];
for (const scenario of EXPERIMENT.scenarios) for (const seed of seeds) for (const rotation of EXPERIMENT.rotations) for (const variant of VARIANTS) {
  const runId = `${scenario}-s${seed}-r${rotation === 0 ? 0 : 1}-${variant.id}`;
  const result = runMatch({ runId, runsDir: output, seed, scenario, variant: variant.id, rotation, dt: EXPERIMENT.dt, maxSeconds, sampleHz: provenance.sampleHz });
  const dir = join(output, runId);
  const events = readFileSync(join(dir, 'events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const frames = readFileSync(join(dir, 'frames.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const run = summarizeRun({ runId, scenario, seed, rotation, variant: variant.id, reason: result.reason, winner: result.winner, duration: result.simulatedSeconds }, events, frames);
  runs.push(run);
  console.log(`${runId}: ${result.reason}, ${result.simulatedSeconds.toFixed(1)}s, ${run.damageEvents} damage events`);
}
const report = { schema: 'wizard-battles-experiment-v1', experiment: { ...EXPERIMENT, seeds, maxSeconds }, variants: isRevision ? REVISION_VARIANTS : isSpell ? SPELL_VARIANTS : VARIANTS, simulationVariants: VARIANTS, provenance, summary: aggregate(runs), runs,
  evidenceLimits: [...(isSpell ? ['Each setup runs once with C/burst gameplay. All visual alternatives use that same trace; these are not independent combat treatments.', 'Gameplay logs locate evidence; they cannot establish visual readability or experienced pacing.'] : []), 'Screening evidence; no owner preference or balance validation yet.', 'Damage gaps are descriptive, not a score for entertainment or tension.', 'Rotations test layout sensitivity, not swapping asymmetric fighter kits.', 'Current telemetry has spell-type IDs, not unique cast/projectile causal IDs. Do not attribute a dodge to a specific incoming attack.', 'Raw rejected-cast diagnostics are retained in JSONL and omitted from the curated event excerpts.'],
};
writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2));
if (publish) { const dest = `public/experiments/${EXPERIMENT.id}`; mkdirSync(dest, { recursive: true }); writeFileSync(join(dest, 'report.json'), JSON.stringify(report, null, 2)); }
console.log(`Preserved batch/source: ${output}\nSummary: ${JSON.stringify(report.summary, null, 2)}`);
