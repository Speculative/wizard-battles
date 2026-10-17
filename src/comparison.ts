import './comparison.css';
import { GameRenderer } from './renderer';
import { buildArena } from './arena';
import { BattleView } from './presentation/battleView';
import { createScenario, SIMULATION_DT } from './scenario';
import { EXPERIMENT, VARIANTS } from './experiment';
import { initialExpectations, type Expectation, type Decision } from './expectations';

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const params = new URLSearchParams(location.search);
const source = typeof __BUILD_SOURCE__ === 'undefined' ? 'development' : __BUILD_SOURCE__;
const app = $('#app');
app.innerHTML = `
<header><div><div class="eyebrow">Wizard Battles / Experiment room</div><h1>Pressure, commitment, escape</h1><p id="hypothesis"></p></div><div id="build" class="muted"></div></header>
<div class="controls"><label>Scene <select id="scenario"><option value="duel">Duel · red / blue</option><option value="four-wizards">Four wizards</option></select></label>
<label>Seed <input id="seed" type="number" min="0" max="4294967295" step="1" value="1"></label>
<label>Layout <select id="rotation"><option value="0">Original</option><option value="1.5707963267948966">Quarter turn</option></select></label>
<button id="load">Load example</button><label><input id="blind" type="checkbox" checked> Hide variant names</label></div>
<div class="controls"><button id="play" class="primary">Play</button><button id="restart">Restart</button><button id="step">+1 second</button>
<label>Speed <select id="speed"><option value="0.5">½×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label>
<label>Time <input id="time" type="range" min="0" max="120" step="0.5" value="0"></label><output id="clock">0.0s / 120s</output></div>
<div id="panels" class="panels"></div>
<p class="muted">Matched starts, independent outcomes. Finished fights hold while others continue. Try seeds 1, 7, 19 and 42, including both scenes and layouts. Watch the buildup and reset, not just impacts.</p>
<div class="cards"><section class="card"><h2>Your viewing notes</h2><p class="muted">What reads best? A note captures this example, all panel identities and the current time.</p>
<div class="stack"><div class="feedback-row"><select id="preference" aria-label="Preference"><option value="unsure">Unsure</option><option>A</option><option>B</option><option>C</option><option value="no-difference">No meaningful difference</option><option value="none">None works</option></select><textarea id="note" aria-label="Viewing note" placeholder="What caught your attention, or lost it?"></textarea></div><button id="save-note">Save timestamped note</button><ol id="notes-list"></ol></div></section>
<section class="card"><h2>Evidence, after watching</h2><details><summary>Reveal approaches and experiment identity</summary><div id="variants"></div><small id="identity"></small></details><details><summary>Batch results and persona judgments</summary><div id="evidence">No saved report loaded. Run npm run experiment to generate evidence.</div><div id="reviews"></div></details><p class="muted">Descriptive evidence, no fun score. Expectation approval and build satisfaction are separate. Your preferred approach is still undecided.</p></section></div>
<section class="card" style="margin-top:24px"><h2>Expectations / your editable review queue</h2><p class="muted">The seven starting expectations were approved in discussion. All build satisfaction remains untested here; persona evidence below can disagree. Changes save locally. Export to share with an agent or move browsers.</p>
<div class="controls"><label>Show <select id="filter"><option value="unreviewed">Unreviewed</option><option value="all">All / history</option><option value="approved">Approved</option><option value="removed">Removed</option></select></label><button id="add-expectation">Propose expectation</button><button id="export">Export feedback JSON</button><label>Import JSON <input id="import" type="file" accept="application/json"></label></div><div id="expectations"></div></section><p id="notice" class="notice" role="status"></p>`;
$('#hypothesis').textContent = EXPERIMENT.hypothesis;
$('#build').textContent = `${EXPERIMENT.id} · ${source.slice(0, 23)}`;
$('#build').title = source;
$('#identity').textContent = `${EXPERIMENT.id}; fixed dt ${SIMULATION_DT}; source ${source}`;
for (const v of VARIANTS) { const p = document.createElement('p'); p.textContent = `${v.name}: ${v.description}`; $('#variants').append(p); }

interface Note { at: string; experiment: string; source: string; scenario: string; seed: number; rotation: number; time: number; panelTimes: number[]; variants: string[]; preference: string; text: string }
interface Feedback { schema: 'wizard-battles-feedback-v1'; expectations: Expectation[]; notes: Note[] }
const storageKey = `wizard-battles:${EXPERIMENT.id}:feedback-v1`;
function validateFeedback(value: unknown): asserts value is Feedback {
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
let feedback: Feedback = { schema: 'wizard-battles-feedback-v1', expectations: initialExpectations(), notes: [] };
try { const saved = localStorage.getItem(storageKey); if (saved) { const data: unknown = JSON.parse(saved); validateFeedback(data); feedback = data; } } catch { notify('Saved feedback could not be read. Export any recoverable data before replacing it.'); }
function notify(message: string) { $('#notice').textContent = message; }
function persist() { try { localStorage.setItem(storageKey, JSON.stringify(feedback)); notify('Saved in this browser. Export JSON to share or back up.'); } catch { notify('Browser storage unavailable. Export JSON to keep your changes.'); } }
function renderNotes() {
  $('#notes-list').replaceChildren();
  for (const n of feedback.notes) { const li = document.createElement('li'); li.textContent = `${n.scenario}, seed ${n.seed}, ${n.time.toFixed(1)}s · ${n.preference}: ${n.text}`; $('#notes-list').append(li); }
}
function renderExpectations() {
  const container = $('#expectations'); container.replaceChildren();
  const filter = $<HTMLSelectElement>('#filter').value;
  const visible = feedback.expectations.filter(e => filter === 'all' || e.decision === filter);
  if (!visible.length) { const p = document.createElement('p'); p.textContent = 'No expectations in this queue. Choose All / history to edit the approved starting set, or propose another.'; container.append(p); }
  for (const e of visible) {
    const article = document.createElement('article'); article.className = 'expectation';
    const heading = document.createElement('strong'); heading.textContent = `${e.id} · ${e.decision}`; article.append(heading);
    const fields: Partial<Record<'text' | 'target' | 'notes', HTMLTextAreaElement>> = {};
    for (const [key, title] of [['text', 'Expectation'], ['target', 'Target (free text)'], ['notes', 'Your notes']] as const) {
      const label = document.createElement('label'); label.textContent = title;
      const input = document.createElement('textarea'); input.value = e[key]; label.append(input); article.append(label); fields[key] = input;
    }
    const actions = document.createElement('div'); actions.className = 'actions';
    function save(decision: Decision) {
      e.text = fields.text!.value; e.target = fields.target!.value; e.notes = fields.notes!.value; e.decision = decision;
      e.history.push({ at: new Date().toISOString(), decision, text: e.text, target: e.target, notes: e.notes }); persist(); renderExpectations();
    }
    for (const [title, decision] of [['Save edits', e.decision], ['Approve', 'approved'], ['Decline', 'declined'], ['Remove', 'removed'], ['Reopen', 'unreviewed']] as [string, Decision][]) {
      const button = document.createElement('button'); button.textContent = title; button.onclick = () => save(decision); actions.append(button);
    }
    article.append(actions);
    const provenance = document.createElement('small'); provenance.textContent = `${e.provenance} Build satisfaction: untested. `; article.append(provenance);
    const history = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = `History (${e.history.length})`;
    const pre = document.createElement('pre'); pre.textContent = JSON.stringify(e.history, null, 2); history.append(summary, pre); article.append(history); container.append(article);
  }
}
$('#filter').onchange = renderExpectations;
$('#add-expectation').onclick = () => { const id = `WB-P${crypto.randomUUID()}`; feedback.expectations.push({ id, text: '', target: '', notes: '', decision: 'unreviewed', provenance: 'Proposed in the comparison interface; owner decision pending.', history: [] }); $<HTMLSelectElement>('#filter').value = 'unreviewed'; persist(); renderExpectations(); };
$('#export').onclick = () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(feedback, null, 2)], { type: 'application/json' })); a.download = `${EXPERIMENT.id}-feedback.json`; a.click(); URL.revokeObjectURL(a.href);
};
$('#import').onchange = async () => {
  try { const file = $<HTMLInputElement>('#import').files?.[0]; if (!file) return;
    const data: unknown = JSON.parse(await file.text()); validateFeedback(data);
    // Merge by ID, retaining local notes and distinct history records.
    for (const incoming of data.expectations) {
      const local = feedback.expectations.find(e => e.id === incoming.id);
      if (!local) feedback.expectations.push(incoming);
      else { const history = [...local.history, ...incoming.history].filter((h, i, all) => all.findIndex(other => JSON.stringify(other) === JSON.stringify(h)) === i).sort((a, b) => a.at.localeCompare(b.at)); Object.assign(local, incoming, { history }); }
    }
    for (const n of data.notes) if (!feedback.notes.some(other => JSON.stringify(other) === JSON.stringify(n))) feedback.notes.push(n);
    persist(); renderExpectations(); renderNotes();
  } catch (error) { notify(`Import failed: ${(error as Error).message}`); }
};

let seed = Number(params.get('seed') ?? 1);
let scenario = params.get('scenario') ?? 'duel';
let rotation = Number(params.get('rotation') ?? 0);
function validateExample() {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || !EXPERIMENT.scenarios.includes(scenario as 'duel') || !EXPERIMENT.rotations.includes(rotation as 0)) throw new Error('Choose a valid seed, scene and layout.');
}
validateExample();
$<HTMLInputElement>('#seed').value = String(seed); $<HTMLSelectElement>('#scenario').value = scenario; $<HTMLSelectElement>('#rotation').value = String(rotation);
let elapsedTicks = 0;
let paused = params.get('capture') === '1';
let accumulator = 0;
let last: number | null = null;
const panels = VARIANTS.map((variant, index) => {
  const element = document.createElement('section'); element.className = 'panel';
  element.innerHTML = `<div class="panel-head"><strong></strong><button aria-label="Enlarge panel ${String.fromCharCode(65 + index)}">Enlarge</button></div><canvas aria-label="Battle panel ${String.fromCharCode(65 + index)}"></canvas><footer></footer>`;
  $('#panels').append(element);
  const canvas = element.querySelector('canvas')!;
  const gfx = new GameRenderer(canvas, { pixelRatio: 1, shadowMapSize: 512 }); gfx.scene.add(buildArena());
  const world = createScenario({ seed, scenario, rotation, variant: variant.id });
  const view = new BattleView(world, gfx.camera, { visualSeed: seed ^ 0x5f3759df }); gfx.scene.add(view.group);
  const panel = { variant, element, gfx, world, view, finished: false };
  element.querySelector('button')!.onclick = () => {
    const open = !element.classList.contains('selected'); document.querySelectorAll('.panel').forEach(e => e.classList.remove('selected'));
    element.classList.toggle('selected', open); $('#panels').classList.toggle('enlarged', open); element.querySelector('button')!.textContent = open ? 'Restore' : 'Enlarge';
    document.querySelectorAll('.panel:not(.selected) button').forEach(e => e.textContent = 'Enlarge'); window.dispatchEvent(new Event('resize')); render();
  };
  return panel;
});
function render() {
  const blind = $<HTMLInputElement>('#blind').checked;
  panels.forEach((p, i) => {
    p.view.render(); if (p.element.getBoundingClientRect().height) p.gfx.render();
    p.element.querySelector('strong')!.textContent = blind ? String.fromCharCode(65 + i) : `${String.fromCharCode(65 + i)} · ${p.variant.name}`;
    const alive = p.world.contestants.filter(c => c.alive);
    const result = p.finished ? alive.length <= 1 ? `${alive[0]?.id ?? 'Nobody'} wins` : 'Time limit' : 'In progress';
    p.element.querySelector('footer')!.textContent = `${p.world.time.toFixed(1)}s · ${result}\n${p.world.contestants.map(c => `${c.id} ${Math.max(0, c.hp).toFixed(0)} HP`).join(' / ')}`;
  });
  const time = elapsedTicks * SIMULATION_DT;
  $('#clock').textContent = `${time.toFixed(1)}s / ${EXPERIMENT.maxSeconds}s`;
  $<HTMLInputElement>('#time').value = String(time);
  $('#play').textContent = paused ? 'Play' : 'Pause';
}
function advance(count: number) {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid step count');
  const steps = Math.min(count, Math.round(EXPERIMENT.maxSeconds / SIMULATION_DT) - elapsedTicks);
  for (let tick = 0; tick < steps; tick++) {
    for (const p of panels) if (!p.finished) {
      p.world.update(SIMULATION_DT); p.view.recordTick();
      p.finished = p.world.contestants.filter(c => c.alive).length <= 1 || p.world.tick >= Math.round(EXPERIMENT.maxSeconds / SIMULATION_DT);
    }
    elapsedTicks++;
  }
  if (panels.every(p => p.finished) || elapsedTicks * SIMULATION_DT >= EXPERIMENT.maxSeconds) paused = true;
}
function reset() {
  elapsedTicks = 0; accumulator = 0; last = null;
  for (const p of panels) {
    p.view.dispose(); p.world = createScenario({ seed, scenario, rotation, variant: p.variant.id });
    p.view = new BattleView(p.world, p.gfx.camera, { visualSeed: seed ^ 0x5f3759df }); p.gfx.scene.add(p.view.group); p.finished = false;
  }
}
function seek(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > EXPERIMENT.maxSeconds) throw new Error('Time must be within the experiment');
  paused = true; reset(); advance(Math.round(seconds / SIMULATION_DT)); render(); return states();
}
function states() { return panels.map(p => ({ variant: p.variant.id, time: p.world.time, tick: p.world.tick, finished: p.finished, contestants: p.world.contestants.map(c => ({ id: c.id, hp: c.hp, alive: c.alive, position: { ...c.position }, velocity: { ...c.velocity } })) })); }
$('#blind').onchange = render;
$('#play').onclick = () => { paused = !paused; last = null; render(); };
$('#restart').onclick = () => { reset(); render(); };
$('#step').onclick = () => { paused = true; advance(60); render(); };
$('#time').oninput = () => seek(Number($<HTMLInputElement>('#time').value));
$('#load').onclick = () => {
  const old = { seed, scenario, rotation };
  try {
    seed = Number($<HTMLInputElement>('#seed').value); scenario = $<HTMLSelectElement>('#scenario').value; rotation = Number($<HTMLSelectElement>('#rotation').value); validateExample();
    paused = true; reset(); render();
    const url = new URL(location.href); url.searchParams.set('seed', String(seed)); url.searchParams.set('scenario', scenario); url.searchParams.set('rotation', String(rotation)); history.replaceState(null, '', url); notify('Loaded matched example. Press Play to watch.');
  } catch (error) { ({ seed, scenario, rotation } = old); notify((error as Error).message); }
};
$('#save-note').onclick = () => {
  feedback.notes.push({ at: new Date().toISOString(), experiment: EXPERIMENT.id, source, scenario, seed, rotation, time: elapsedTicks * SIMULATION_DT, panelTimes: panels.map(p => p.world.time), variants: VARIANTS.map(v => v.id), preference: $<HTMLSelectElement>('#preference').value, text: $<HTMLTextAreaElement>('#note').value });
  $<HTMLTextAreaElement>('#note').value = ''; persist(); renderNotes();
};
const comparison = {
  metadata: { experiment: EXPERIMENT.id, source, dt: SIMULATION_DT, browser: navigator.userAgent },
  seek, states,
  step(count = 1) { paused = true; advance(count); render(); return states(); },
  pause() { paused = true; render(); }, play() { paused = false; last = null; render(); },
  feedback() { return structuredClone(feedback); },
};
declare global { const __BUILD_SOURCE__: string; interface Window { comparison: typeof comparison } }
window.comparison = comparison;
renderExpectations(); renderNotes(); render();
if (params.has('time')) seek(Number(params.get('time')));
function tick(now: number) {
  if (last === null) last = now;
  if (!paused) {
    accumulator += Math.max(0, Math.min(.1, (now - last) / 1000)) * Number($<HTMLSelectElement>('#speed').value);
    const count = Math.floor((accumulator + 1e-10) / SIMULATION_DT);
    if (count) { advance(count); accumulator -= count * SIMULATION_DT; render(); }
  }
  last = now; requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Reports are optional; the live comparison works before a batch is available.
void fetch('./experiments/movement-pacing-v1/report.json').then(async response => {
  if (!response.ok) return;
  const report = await response.json();
  $('#evidence').replaceChildren();
  const identity = document.createElement('p'); identity.textContent = `Saved batch: ${report.provenance.source.slice(0, 23)}; ${report.runs.length} matches. ${report.provenance.source === source ? 'Source matches this viewer.' : 'Source differs from this viewer; regenerate for direct attribution.'}`; $('#evidence').append(identity);
  const table = document.createElement('table');
  const header = document.createElement('tr');
  for (const title of ['Scene / approach', 'Matches', 'Mean duration', 'Timeouts']) { const th = document.createElement('th'); th.textContent = title; header.append(th); }
  table.append(header);
  for (const row of report.summary) { const tr = document.createElement('tr'); for (const value of [row.group, row.matches, `${row.duration.mean.toFixed(1)}s`, row.winners.timeout ?? 0]) { const td = document.createElement('td'); td.textContent = String(value); tr.append(td); } table.append(tr); }
  $('#evidence').append(table);
  const link = document.createElement('a'); link.href = './experiments/movement-pacing-v1/report.json'; link.textContent = 'Full report / run identities'; $('#evidence').append(link);
}).catch(() => {});
void fetch('./experiments/movement-pacing-v1/reviews.json').then(async response => {
  if (!response.ok) return;
  const reviews = await response.json();
  for (const review of reviews.reviews) {
    const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = review.persona;
    details.append(summary);
    const verdict = document.createElement('p'); verdict.textContent = review.overallVerdict ?? review.preference?.reason ?? 'See retained report for observations and uncertainty.'; details.append(verdict);
    const limits = document.createElement('p'); limits.className = 'muted'; limits.textContent = 'Agent perspective; sampled frames and logs, not owner feedback. Original reports retain their evidence source identities.'; details.append(limits);
    const raw = document.createElement('details'); const rawTitle = document.createElement('summary'); rawTitle.textContent = 'Full traceable report';
    const pre = document.createElement('pre'); pre.textContent = JSON.stringify(review, null, 2); raw.append(rawTitle, pre); details.append(raw); $('#reviews').append(details);
  }
}).catch(() => {});

void fetch('./experiments/movement-pacing-v1/triage.json').then(async response => {
  if (!response.ok) return;
  const triage = await response.json();
  const details = document.createElement('details'); const title = document.createElement('summary'); title.textContent = 'Review triage / what changed'; details.append(title);
  for (const finding of triage.findings) { const p = document.createElement('p'); p.textContent = `${finding.status}: ${finding.finding} ${finding.action}`; details.append(p); }
  $('#reviews').append(details);
}).catch(() => {});
