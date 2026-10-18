import './comparison.css';
import { GameRenderer } from './renderer';
import { buildArena } from './arena';
import { BattleView } from './presentation/battleView';
import { createScenario, SIMULATION_DT } from './scenario';
import { EXPERIMENT, VARIANTS } from './experiment';
import { initialExpectations, type Decision } from './expectations';

import { validateFeedback, mergeFeedback, type Feedback } from './feedback';

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const params = new URLSearchParams(location.search);
const source = typeof __BUILD_SOURCE__ === 'undefined' ? 'development' : __BUILD_SOURCE__;
const app = $('#app');
app.innerHTML = `
<header><div><div class="eyebrow">Wizard Battles / Experiment room</div><h1>Pressure, commitment, escape</h1><p id="hypothesis"></p></div><div id="build" class="muted"></div></header>
<p>Compare three movement styles in the same starting match. A is the original; B slows travel and stops to charge; C adds faster escapes and stops to recover.</p>
<div id="presets" class="controls" aria-label="Recommended matches"></div>
<div class="example-heading"><h2 id="example-title"></h2><p id="example-description"></p><p id="active-match" class="muted" role="status"></p></div>
<div class="controls" aria-label="Viewing range"><button id="full-fight" aria-pressed="true">Full fight</button><button id="exchange" aria-pressed="false">Short interaction · 8–14s</button><button id="late" aria-pressed="false" hidden>Late comparison · 84–90s</button><label><input id="loop" type="checkbox" checked> Loop short interactions</label></div>
<details><summary>Custom match / display options</summary><div class="controls"><label>Scene <select id="scenario"><option value="duel">Duel · red / blue</option><option value="four-wizards">Four wizards</option></select></label>
<label>Seed <input id="seed" type="number" min="0" max="4294967295" step="1" value="1"></label>
<label>Layout <select id="rotation"><option value="0">Original</option><option value="1.5707963267948966">Quarter turn</option></select></label>
<label><input id="blind" type="checkbox"> Hide variant names</label><small>Custom changes apply when you select a value or leave the seed field.</small></div></details>
<div class="controls"><button id="play" class="primary">Play</button><button id="restart">Restart</button><button id="step">+1 second</button>
<label>Speed <select id="speed"><option value="0.5">½×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label>
<label>Time <input id="time" type="range" min="0" max="120" step="0.5" value="0"></label><output id="clock">0.0s / 120s</output></div>
<div id="panels" class="panels"></div>
<p class="muted">Each panel starts with the same fighters and seed. Only movement settings differ. Outcomes can diverge. Enlarge a panel to follow its spells; finished fights hold their final state.</p>
<div class="cards"><section class="card"><h2>Your viewing notes</h2><p class="muted">What reads best? A note captures this match, all panel identities and the current time.</p>
<div class="stack"><div class="feedback-row"><select id="preference" aria-label="Preference"><option value="unsure">Unsure</option><option>A</option><option>B</option><option>C</option><option value="no-difference">No meaningful difference</option><option value="none">None works</option></select><textarea id="note" aria-label="Viewing note" placeholder="What caught your attention, or lost it?"></textarea></div><button id="save-note">Save timestamped note</button><p id="save-status" role="status">Checking workspace saves…</p><button id="retry-save">Retry workspace save</button><ol id="notes-list"></ol></div></section>
<section class="card"><h2>Evidence, after watching</h2><details><summary>Reveal approaches and experiment identity</summary><div id="variants"></div><small id="identity"></small></details><details><summary>Batch results and persona judgments</summary><div id="evidence">No saved report loaded. Run npm run experiment to generate evidence.</div><div id="reviews"></div></details><p class="muted">Descriptive evidence, no fun score. Expectation approval and build satisfaction are separate. Your preferred approach is still undecided.</p></section></div>
<section class="card" style="margin-top:24px"><h2>Expectations / your editable review queue</h2><p class="muted">The seven starting expectations were approved in discussion. All build satisfaction remains untested here; persona evidence below can disagree. Changes save to the workspace when this server supports it, with a browser backup. Export is also available.</p>
<div class="controls"><label>Show <select id="filter"><option value="unreviewed">Unreviewed</option><option value="all">All / history</option><option value="approved">Approved</option><option value="removed">Removed</option></select></label><button id="add-expectation">Propose expectation</button><button id="export">Export feedback JSON</button><label>Import JSON <input id="import" type="file" accept="application/json"></label></div><div id="expectations"></div></section><p id="notice" class="notice" role="status"></p>`;
$('#hypothesis').textContent = EXPERIMENT.hypothesis;
$('#build').textContent = `${EXPERIMENT.id} · ${source.slice(0, 23)}`;
$('#build').title = source;
$('#identity').textContent = `${EXPERIMENT.id}; fixed dt ${SIMULATION_DT}; source ${source}`;
for (const v of VARIANTS) { const p = document.createElement('p'); p.textContent = `${v.name}: ${v.description}`; $('#variants').append(p); }

const storageKey = `wizard-battles:${EXPERIMENT.id}:feedback-v1`;
let feedback: Feedback = { schema: 'wizard-battles-feedback-v1', expectations: initialExpectations(), notes: [] };
try { const saved = localStorage.getItem(storageKey); if (saved) { const data: unknown = JSON.parse(saved); validateFeedback(data); feedback = data; } } catch { notify('Saved feedback could not be read. Export any recoverable data before replacing it.'); }
function notify(message: string) { $('#notice').textContent = message; }
function saveBrowser() {
  try { localStorage.setItem(storageKey, JSON.stringify(feedback)); return true; } catch { return false; }
}
let saveQueue = Promise.resolve();
let saveRevision = 0;
function persist() {
  const revision = ++saveRevision;
  const browserSaved = saveBrowser();
  $('#save-status').textContent = 'Saving to workspace…';
  saveQueue = saveQueue.then(async () => {
    await feedbackReady;
    const response = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(feedback) });
    if (!response.ok) throw new Error('Workspace save unavailable');
    const saved = await response.json();
    if (revision !== saveRevision) return;
    $('#save-status').textContent = `Saved to ${saved.file} at ${new Date(saved.savedAt).toLocaleTimeString()}. Browser backup ${browserSaved ? 'saved' : 'unavailable'}.`;
  }).catch(() => { $('#save-status').textContent = browserSaved ? 'Workspace save failed. This change is only in this browser. Retry or export JSON to keep a separate copy.' : 'Save failed in both workspace and browser. Export JSON now to keep this change.'; });
}
$('#retry-save').onclick = persist;
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
    feedback = mergeFeedback(feedback, data);
    persist(); renderExpectations(); renderNotes();
  } catch (error) { notify(`Import failed: ${(error as Error).message}`); }
};

let seed = Number(params.get('seed') ?? 7);
let scenario = params.get('scenario') ?? 'duel';
let rotation = Number(params.get('rotation') ?? 0);
function validateExample() {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || !EXPERIMENT.scenarios.includes(scenario as 'duel') || !EXPERIMENT.rotations.includes(rotation as 0)) throw new Error('Choose a valid seed, scene and layout.');
}
validateExample();
$<HTMLInputElement>('#seed').value = String(seed); $<HTMLSelectElement>('#scenario').value = scenario; $<HTMLSelectElement>('#rotation').value = String(rotation);
let elapsedTicks = 0;
let paused = true;
let rangeStart = 0;
let rangeEnd: number = EXPERIMENT.maxSeconds;
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
  $('#clock').textContent = `${time.toFixed(1)}s · ${rangeStart}–${rangeEnd}s`;
  $<HTMLInputElement>('#time').min = String(rangeStart);
  $<HTMLInputElement>('#time').max = String(rangeEnd);
  $<HTMLInputElement>('#time').value = String(time);
  $('#play').textContent = paused ? 'Play' : 'Pause';
}
function advance(count: number) {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid step count');
  const steps = Math.min(count, Math.round(rangeEnd / SIMULATION_DT) - elapsedTicks);
  for (let tick = 0; tick < steps; tick++) {
    for (const p of panels) if (!p.finished) {
      p.world.update(SIMULATION_DT); p.view.recordTick();
      p.finished = p.world.contestants.filter(c => c.alive).length <= 1 || p.world.tick >= Math.round(EXPERIMENT.maxSeconds / SIMULATION_DT);
    }
    elapsedTicks++;
  }
  if (panels.every(p => p.finished) || elapsedTicks * SIMULATION_DT >= rangeEnd) paused = true;
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
$('#play').onclick = () => { if (elapsedTicks * SIMULATION_DT >= rangeEnd) seek(rangeStart); paused = !paused; last = null; render(); };
$('#restart').onclick = () => { seek(rangeStart); render(); };
$('#step').onclick = () => { paused = true; advance(60); render(); };
$('#time').oninput = () => seek(Number($<HTMLInputElement>('#time').value));
const presets = [
  { id: 'ordinary-duel', title: '1 · Start here: duel', scenario: 'duel', seed: 7, description: 'Follow red and blue. Compare when each fighter closes in, stops, or escapes. Which is easiest to follow?' },
  { id: 'stalled-duel', title: '2 · When movement stalls', scenario: 'duel', seed: 1, description: 'Does more movement make a better fight? Compare the short interaction with the late window, then watch the full fight for context.' },
  { id: 'four-way', title: '3 · Four-way battle', scenario: 'four-wizards', seed: 19, description: 'With four fighters, can you tell who is attacking whom? Compare how easy each panel is to follow.' },
];
function updateExample() {
  const preset = presets.find(p => p.seed === seed && p.scenario === scenario && rotation === 0);
  $('#example-title').textContent = preset?.title ?? 'Custom match';
  $('#example-description').textContent = preset?.description ?? 'The selected setup is active in all three panels.';
  $('#active-match').textContent = `${scenario === 'duel' ? 'Red / blue duel' : 'Four wizards'} · seed ${seed} · ${rotation === 0 ? 'original layout' : 'quarter-turn layout'}`;
  $('#exchange').textContent = seed === 7 && scenario === 'duel' ? 'Short interaction · 2–6s' : 'Short interaction · 8–14s';
  $('#late').hidden = preset?.id !== 'stalled-duel';
  for (const button of document.querySelectorAll<HTMLButtonElement>('#presets button')) button.setAttribute('aria-pressed', String(button.dataset.preset === preset?.id));
  $<HTMLInputElement>('#seed').value = String(seed); $<HTMLSelectElement>('#scenario').value = scenario; $<HTMLSelectElement>('#rotation').value = String(rotation);
}
function setRange(start: number, end: number, play = true) {
  rangeStart = start; rangeEnd = end; seek(start); paused = !play; last = null;
  for (const [id, active] of [['full-fight', start === 0], ['exchange', start > 0 && start !== 84], ['late', start === 84]] as const) $(`#${id}`).setAttribute('aria-pressed', String(active));
  render();
}
function loadExample(next: { seed: number; scenario: string; rotation: number }) {
  const old = { seed, scenario, rotation };
  try {
    ({ seed, scenario, rotation } = next); validateExample();
    setRange(0, EXPERIMENT.maxSeconds, false); updateExample();
    const url = new URL(location.href); url.searchParams.set('seed', String(seed)); url.searchParams.set('scenario', scenario); url.searchParams.set('rotation', String(rotation)); url.searchParams.delete('time'); history.replaceState(null, '', url);
  } catch (error) { ({ seed, scenario, rotation } = old); updateExample(); notify((error as Error).message); }
}
for (const preset of presets) {
  const button = document.createElement('button'); button.textContent = preset.title; button.dataset.preset = preset.id;
  button.onclick = () => loadExample({ seed: preset.seed, scenario: preset.scenario, rotation: 0 }); $('#presets').append(button);
}
for (const id of ['seed', 'scenario', 'rotation']) $(`#${id}`).onchange = () => loadExample({ seed: Number($<HTMLInputElement>('#seed').value), scenario: $<HTMLSelectElement>('#scenario').value, rotation: Number($<HTMLSelectElement>('#rotation').value) });
$('#full-fight').onclick = () => setRange(0, EXPERIMENT.maxSeconds);
$('#exchange').onclick = () => seed === 7 && scenario === 'duel' ? setRange(2, 6) : setRange(8, 14);
$('#late').onclick = () => setRange(84, 90);
updateExample();
$('#save-note').onclick = () => {
  feedback.notes.push({ at: new Date().toISOString(), experiment: EXPERIMENT.id, source, scenario, seed, rotation, time: elapsedTicks * SIMULATION_DT, panelTimes: panels.map(p => p.world.time), variants: VARIANTS.map(v => v.id), preference: $<HTMLSelectElement>('#preference').value, text: $<HTMLTextAreaElement>('#note').value });
  $<HTMLTextAreaElement>('#note').value = ''; persist(); renderNotes();
};
const comparison = {
  metadata: { experiment: EXPERIMENT.id, source, dt: SIMULATION_DT, browser: navigator.userAgent },
  seek, states, loadExample,
  ready: () => feedbackReady,
  step(count = 1) { paused = true; advance(count); render(); return states(); },
  pause() { paused = true; render(); }, play() { paused = false; last = null; render(); },
  feedback() { return structuredClone(feedback); },
};
declare global { const __BUILD_SOURCE__: string; interface Window { comparison: typeof comparison } }
window.comparison = comparison;
renderExpectations(); renderNotes(); render();
let migrateBrowser = false;
const feedbackReady = (async () => {
  try {
    const response = await fetch('/api/feedback');
    if (!response.ok) throw new Error('Workspace unavailable');
    const saved = await response.json(); validateFeedback(saved.feedback);
    feedback = mergeFeedback(feedback, saved.feedback);
    migrateBrowser = JSON.stringify(feedback) !== JSON.stringify(saved.feedback) && (feedback.notes.length > 0 || feedback.expectations.some(e => e.history.length > (initialExpectations().find(i => i.id === e.id)?.history.length ?? 0)));
    saveBrowser(); renderNotes(); renderExpectations();
    $('#save-status').textContent = `Workspace connected · ${saved.location}. Existing browser notes will also be saved here.`;
  } catch { $('#save-status').textContent = 'Workspace storage unavailable. Notes remain in this browser; export JSON for a separate copy.'; }
})();
void feedbackReady.then(() => { if (migrateBrowser) persist(); });
if (params.has('time')) seek(Number(params.get('time')));
function tick(now: number) {
  if (last === null) last = now;
  if (!paused) {
    accumulator += Math.max(0, Math.min(.1, (now - last) / 1000)) * Number($<HTMLSelectElement>('#speed').value);
    const count = Math.floor((accumulator + 1e-10) / SIMULATION_DT);
    if (count) { advance(count); accumulator -= count * SIMULATION_DT; render(); }
    if (paused && rangeStart > 0 && $<HTMLInputElement>('#loop').checked) { seek(rangeStart); paused = false; last = now; }
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
    const plain = review.displaySummary;
    const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = plain?.title ?? review.persona;
    details.append(summary);
    const verdict = document.createElement('p'); verdict.textContent = plain?.text ?? review.overallVerdict; details.append(verdict);
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
