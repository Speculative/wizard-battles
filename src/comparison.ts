import './comparison.css';
import { GameRenderer } from './renderer';
import { buildArena } from './arena';
import { BattleView } from './presentation/battleView';
import { createScenario, SIMULATION_DT } from './scenario';
import { COMPARISON_BRIEFS as MOVEMENT_BRIEFS, type EvidenceClip } from './comparisonEvidence';
import { EXPERIMENT as MOVEMENT_EXPERIMENT, VARIANTS as MOVEMENT_VARIANTS } from './experiment';
import { SPELL_EXPERIMENT, SPELL_VARIANTS, SPELL_BRIEFS } from './spellReadabilityExperiment';
import { initialExpectations, type Decision } from './expectations';

import { evidenceReference, evidenceKey, notesForEvidence } from './evidenceFeedback';
import { validateFeedback, mergeFeedback, type Feedback, type EvidenceReference } from './feedback';

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const params = new URLSearchParams(location.search);
const spellExperiment = params.get('experiment') === SPELL_EXPERIMENT.id;
const EXPERIMENT = spellExperiment ? SPELL_EXPERIMENT : MOVEMENT_EXPERIMENT;
const VARIANTS = spellExperiment ? SPELL_VARIANTS : MOVEMENT_VARIANTS.map(v => ({ ...v, scenarioVariant: v.id, spellReadability: false }));
const COMPARISON_BRIEFS = spellExperiment ? SPELL_BRIEFS : MOVEMENT_BRIEFS;
function comparisonBrief(scene: string, matchSeed: number, layout: number) {
  return layout === 0 ? COMPARISON_BRIEFS.find(b => b.scenario === scene && b.seed === matchSeed) : undefined;
}
const source = typeof __BUILD_SOURCE__ === 'undefined' ? 'development' : __BUILD_SOURCE__;
const app = $('#app');
app.innerHTML = `
<header><div><div class="eyebrow">Wizard Battles / Experiment room</div><h1>${EXPERIMENT.title}</h1></div><div id="build" class="muted"></div></header>
<nav class="controls" role="tablist" aria-label="Experiment room"><button id="comparison-tab" role="tab" aria-selected="true" aria-controls="comparison-page">Comparison</button><button id="goals-tab" role="tab" aria-selected="false" aria-controls="goals-page" tabindex="-1">Goals</button></nav>
<div id="comparison-page" role="tabpanel" aria-labelledby="comparison-tab">
<div id="presets" class="controls" aria-label="Recommended matches"></div>
<div class="example-heading"><h2 id="example-title"></h2><p id="example-description"></p><p id="active-match" class="muted" role="status"></p></div>
<div class="controls" aria-label="Comparison mode"><button id="show-evidence" aria-pressed="true">Selected evidence</button><button id="full-fight" aria-pressed="false">Full fights / context</button></div>
<p id="evidence-help">Play one clip, then the other. Their clocks are independent; choosing a clip pauses the other.</p>
<details><summary>Custom match / display options</summary><div class="controls"><label>Scene <select id="scenario"><option value="duel">Duel · red / blue</option><option value="four-wizards">Four wizards</option></select></label>
<label>Seed <input id="seed" type="number" min="0" max="4294967295" step="1" value="1"></label>
<label>Layout <select id="rotation"><option value="0">Original</option><option value="1.5707963267948966">Quarter turn</option></select></label>
<small>Custom changes apply when you select a value or leave the seed field.</small></div></details>
<div id="full-controls" class="controls"><button id="play" class="primary">Play</button><button id="restart">Restart</button><button id="step">+1 second</button>
<label>Speed <select id="speed"><option value="0.5">½×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label>
<label>Time <input id="time" type="range" min="0" max="120" step="0.5" value="0"></label><output id="clock">0.0s / 120s</output></div>
<div id="panels" class="panels"></div>
<p class="muted">Full fights are available for context. Evidence excerpts are deliberately chosen, not a representative sample or a ranking score. Names and designer commentary stay visible so you can assess the proposal.</p>
<div class="cards"><section class="card"><h2>General comparison notes</h2><p class="muted">For an overall comparison or a full fight. Use the comment form on an evidence card to record your response to that specific piece.</p>
<div class="stack"><div class="feedback-row"><select id="preference" aria-label="Preference"><option value="unsure">Unsure</option><option>A</option><option>B</option><option>C</option><option value="no-difference">No meaningful difference</option><option value="none">None works</option></select><textarea id="note" aria-label="Viewing note" placeholder="What caught your attention, or lost it?"></textarea></div><button id="save-note">Save timestamped note</button><ol id="notes-list"></ol></div></section>
<section class="card"><h2>Evidence, after watching</h2><details><summary>Reveal approaches and experiment identity</summary><div id="variants"></div><small id="identity"></small></details><details><summary>Batch results and persona judgments</summary><div id="evidence">No saved report loaded. Run npm run experiment to generate evidence.</div><div id="reviews"></div></details><p class="muted">Descriptive evidence, no fun score. Expectation approval and build satisfaction are separate. ${spellExperiment ? 'Both panels use your preferred C movement. Whether the new spell cues help is the open question.' : 'Your recorded viewing preference favors C; the agent reviews retain their original uncertainty.'}</p></section></div>
</div><section id="goals-page" role="tabpanel" aria-labelledby="goals-tab" hidden class="card"><h2>What you want from battles</h2><p>These are goals for future experiments. Approving a goal means “I care about this,” not “the current fights achieve this.” The seven starting goals were already approved in our discussion; you do not need to approve them again.</p>
<p>Edit a goal and <strong>Save edits</strong> to refine it. For a new proposal, <strong>Approve</strong> keeps it as a goal; <strong>Decline</strong> says it is not something you want. <strong>Remove</strong> retires a goal and <strong>Reopen</strong> asks to review it again. History is kept.</p>
<p class="muted">Targets are optional and can be plain language. For example: “Separate duels should sometimes collide in four-way battles.” Use comments and viewing notes on the Comparison tab for reactions to specific fights; use this list for qualities you want us to preserve or improve across experiments. Changes use the same workspace save and browser backup as your notes.</p><p id="expectation-counts" role="status"></p>
<div class="controls"><label>Show <select id="filter"><option value="all">All goals / history</option><option value="unreviewed">Needs your review</option><option value="approved">Approved goals</option><option value="declined">Declined proposals</option><option value="removed">Removed goals</option></select></label><button id="add-expectation">Propose expectation</button></div><div id="expectations"></div></section><details id="feedback-tools"><summary>Feedback saves and backups</summary><p id="save-status" role="status">Checking workspace saves…</p><div class="controls"><button id="retry-save">Retry workspace save</button><button id="export">Export feedback JSON</button><label>Import JSON <input id="import" type="file" accept="application/json"></label></div></details><p id="notice" class="notice" role="status"></p>`;
$('#panels').classList.toggle('two-panels', VARIANTS.length === 2);
if (spellExperiment) $('#preference option:nth-child(4)').remove();
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
let saveQueue: Promise<boolean | void> = Promise.resolve();
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
    if (revision !== saveRevision) return true;
    $('#save-status').textContent = `Saved to ${saved.file} at ${new Date(saved.savedAt).toLocaleTimeString()}. Browser backup ${browserSaved ? 'saved' : 'unavailable'}.`;
    return true;
  }).catch(() => { $('#save-status').textContent = browserSaved ? 'Workspace save failed. This change is only in this browser. Retry or export JSON to keep a separate copy.' : 'Save failed in both workspace and browser. Export JSON now to keep this change.'; return false; });
  return saveQueue;
}
$('#retry-save').onclick = async () => {
  const saved = await persist();
  if (saved) for (const [key, status] of commentSaves) if (status.startsWith('Workspace save failed')) commentSaves.set(key, 'Saved to workspace.');
  renderEvidenceFeedback();
};
function renderNotes() {
  $('#notes-list').replaceChildren();
  for (const n of feedback.notes.filter(n => !n.evidence)) {
    const li = document.createElement('li');
    const context = n.viewing?.mode === 'evidence'
      ? `evidence ${n.viewing.briefId} · ${n.viewing.clips.map(c => `${c.variant} at ${(n.panelTimes[n.variants.indexOf(c.variant)] ?? 0).toFixed(1)}s`).join(' / ')} · focused ${n.viewing.focusedVariant ?? 'none'}`
      : `${n.time.toFixed(1)}s`;
    li.textContent = `${n.scenario}, seed ${n.seed}, ${context} · ${n.preference}: ${n.text}`;
    $('#notes-list').append(li);
  }
  renderEvidenceFeedback();
}
function renderExpectations() {
  const container = $('#expectations'); container.replaceChildren();
  const filter = $<HTMLSelectElement>('#filter').value;
  const visible = feedback.expectations.filter(e => filter === 'all' || e.decision === filter);
  const approved = feedback.expectations.filter(e => e.decision === 'approved').length;
  const unreviewed = feedback.expectations.filter(e => e.decision === 'unreviewed').length;
  $('#expectation-counts').textContent = `${feedback.expectations.length} total · ${approved} approved · ${unreviewed} need your review`;
  if (!visible.length) {
    const p = document.createElement('p');
    p.textContent = filter === 'unreviewed'
      ? `Nothing needs your review. Your ${approved} approved goals still guide experiments.`
      : filter === 'all' ? 'No goals yet. Propose an expectation to add one.' : 'No goals match this filter.';
    container.append(p);
    if (filter !== 'all') {
      const button = document.createElement('button'); button.textContent = 'View all goals';
      button.onclick = () => { $<HTMLSelectElement>('#filter').value = 'all'; renderExpectations(); };
      container.append(button);
    }
  }
  for (const e of visible) {
    const article = document.createElement('article'); article.className = 'expectation';
    const heading = document.createElement('strong'); heading.textContent = `${e.id} · ${{ approved: 'Approved goal', unreviewed: 'Needs your review', declined: 'Declined proposal', removed: 'Removed goal' }[e.decision]}`; article.append(heading);
    const fields: Partial<Record<'text' | 'target' | 'notes', HTMLTextAreaElement>> = {};
    for (const [key, title] of [['text', 'Expectation'], ['target', 'Target (free text)'], ['notes', 'Your notes']] as const) {
      const label = document.createElement('label'); label.textContent = title;
      const input = document.createElement('textarea'); input.value = e[key];
      if (key === 'target') input.placeholder = 'Optional: how would you recognize success? Words, numbers or ranges are all fine.'; label.append(input); article.append(label); fields[key] = input;
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
let mode: 'evidence' | 'full' = 'full';
let focusedVariant: string | null = null;
let accumulator = 0;
let last: number | null = null;
const panels = VARIANTS.map((variant, index) => {
  const element = document.createElement('section'); element.className = 'panel';
  element.innerHTML = `<div class="panel-head"><strong></strong><button aria-label="Enlarge panel ${String.fromCharCode(65 + index)}">Enlarge</button></div><div class="clip-caption"><h3></h3><p class="review-status" role="status"></p><p class="watch-for"></p><details><summary>Why this moment?</summary><p class="clip-reason"></p></details></div><div class="clip-controls"><button class="clip-play" aria-label="Play excerpt ${String.fromCharCode(65 + index)}">Play excerpt</button><button class="clip-replay" aria-label="Replay excerpt ${String.fromCharCode(65 + index)}">Replay</button><label>Clip time <input class="clip-time" aria-label="Excerpt time ${String.fromCharCode(65 + index)}" type="range" step="0.016666666666666666"></label><label><input class="clip-loop" aria-label="Loop excerpt ${String.fromCharCode(65 + index)}" type="checkbox"> Loop</label><button class="clip-full" aria-label="Full fight ${String.fromCharCode(65 + index)}">Full fight</button><output class="clip-clock"></output></div><canvas aria-label="Battle panel ${String.fromCharCode(65 + index)}"></canvas><footer></footer><section class="evidence-comment"><h3>Your comment on this evidence</h3><label>Comment<textarea class="comment-text" aria-label="Comment on evidence ${String.fromCharCode(65 + index)}" placeholder="What works here, what doesn't, or what are you unsure about?"></textarea></label><button class="save-comment" aria-label="Save evidence comment ${String.fromCharCode(65 + index)}">Save comment</button><p class="comment-save" role="status"></p><ol class="evidence-notes"></ol></section>`;
  $('#panels').append(element);
  const canvas = element.querySelector('canvas')!;
  const gfx = new GameRenderer(canvas, { pixelRatio: 1, shadowMapSize: 512 }); gfx.scene.add(buildArena());
  const world = createScenario({ seed, scenario, rotation, variant: variant.scenarioVariant });
  const view = new BattleView(world, gfx.camera, { visualSeed: seed ^ 0x5f3759df, spellReadability: variant.spellReadability }); gfx.scene.add(view.group);
  const panel = { variant, element, gfx, world, view, finished: false, clip: undefined as EvidenceClip | undefined, cursor: 0, playing: false, accumulator: 0 };
  element.querySelector<HTMLButtonElement>('.save-comment')!.onclick = () => saveEvidenceComment(panel);
  element.querySelector<HTMLTextAreaElement>('.comment-text')!.oninput = event => { const reference = panelReference(panel); if (reference) commentDrafts.set(evidenceKey(reference), (event.target as HTMLTextAreaElement).value); };
  element.querySelector<HTMLButtonElement>('.clip-play')!.onclick = () => playExcerpt(panel);
  element.querySelector<HTMLButtonElement>('.clip-replay')!.onclick = () => { if (panel.clip) seekPanel(panel, panel.clip.start); playExcerpt(panel, true); };
  element.querySelector<HTMLInputElement>('.clip-time')!.oninput = event => { for (const other of panels) other.playing = false; seekPanel(panel, Number((event.target as HTMLInputElement).value)); focusedVariant = variant.id; render(); };
  element.querySelector<HTMLButtonElement>('.clip-full')!.onclick = () => { showFullFights(); element.querySelector<HTMLButtonElement>('.panel-head button')!.click(); };
  element.querySelector('button')!.onclick = () => {
    const open = !element.classList.contains('selected'); document.querySelectorAll('.panel').forEach(e => e.classList.remove('selected'));
    element.classList.toggle('selected', open); $('#panels').classList.toggle('enlarged', open); element.querySelector('button')!.textContent = open ? 'Restore' : 'Enlarge';
    document.querySelectorAll('.panel:not(.selected) .panel-head button').forEach(e => e.textContent = 'Enlarge'); render();
  };
  return panel;
});
function render() {
  $('#full-controls').hidden = mode === 'evidence';
  $('#evidence-help').hidden = mode !== 'evidence';
  $('#panels').classList.toggle('evidence-mode', mode === 'evidence');
  $('#show-evidence').setAttribute('aria-pressed', String(mode === 'evidence'));
  $('#full-fight').setAttribute('aria-pressed', String(mode === 'full'));
  panels.forEach((p, i) => {
    p.element.hidden = mode === 'evidence' && !p.clip;
    p.view.render(); if (p.element.getBoundingClientRect().height) p.gfx.render();
    p.element.classList.toggle('playing', p.playing);
    p.element.querySelector('strong')!.textContent = `${String.fromCharCode(65 + i)} · ${p.variant.name}`;
    p.element.querySelector<HTMLElement>('.clip-caption')!.hidden = mode !== 'evidence';
    p.element.querySelector<HTMLElement>('.clip-controls')!.hidden = mode !== 'evidence';
    p.element.querySelector<HTMLElement>('.evidence-comment')!.hidden = mode !== 'evidence';
    if (p.clip) {
      p.element.querySelector('.clip-play')!.textContent = p.playing ? 'Pause excerpt' : 'Play excerpt';
      p.element.querySelector('.clip-clock')!.textContent = `${(p.cursor * SIMULATION_DT).toFixed(2)}s · excerpt ${p.clip.start}–${p.clip.end}s`;
      const scrubber = p.element.querySelector<HTMLInputElement>('.clip-time')!;
      scrubber.min = String(p.clip.start); scrubber.max = String(p.clip.end); scrubber.value = String(p.cursor * SIMULATION_DT);
    }
    const alive = p.world.contestants.filter(c => c.alive);
    const result = p.finished ? alive.length <= 1 ? `${alive[0]?.id ?? 'Nobody'} wins` : 'Time limit' : 'In progress';
    p.element.querySelector('footer')!.textContent = `${p.world.time.toFixed(1)}s · ${result}\n${p.world.contestants.map(c => `${c.id} ${Math.max(0, c.hp).toFixed(0)} HP`).join(' / ')}`;
  });
  const time = elapsedTicks * SIMULATION_DT;
  $('#clock').textContent = `${time.toFixed(1)}s / ${EXPERIMENT.maxSeconds}s`;
  $<HTMLInputElement>('#time').min = '0';
  $<HTMLInputElement>('#time').max = String(EXPERIMENT.maxSeconds);
  $<HTMLInputElement>('#time').value = String(time);
  $('#play').textContent = paused ? 'Play' : 'Pause';
}
function advance(count: number) {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid step count');
  const steps = Math.min(count, Math.round(EXPERIMENT.maxSeconds / SIMULATION_DT) - elapsedTicks);
  for (let tick = 0; tick < steps; tick++) {
    for (const p of panels) advanceWorld(p, 1);
    elapsedTicks++;
  }
  if (panels.every(p => p.finished) || elapsedTicks * SIMULATION_DT >= EXPERIMENT.maxSeconds) paused = true;
}
type Panel = typeof panels[number];
function advanceWorld(p: Panel, count: number) {
  for (let tick = 0; tick < count && !p.finished; tick++) {
    p.world.update(SIMULATION_DT); p.view.recordTick();
    p.finished = p.world.contestants.filter(c => c.alive).length <= 1 || p.world.tick >= Math.round(EXPERIMENT.maxSeconds / SIMULATION_DT);
  }
}
function resetPanel(p: Panel) {
  p.playing = false; p.accumulator = 0; p.cursor = 0;
  p.view.dispose(); p.world = createScenario({ seed, scenario, rotation, variant: p.variant.scenarioVariant });
  p.view = new BattleView(p.world, p.gfx.camera, { visualSeed: seed ^ 0x5f3759df, spellReadability: p.variant.spellReadability }); p.gfx.scene.add(p.view.group); p.finished = false;
}
function reset() {
  elapsedTicks = 0; accumulator = 0; last = null;
  for (const p of panels) resetPanel(p);
}
function seekPanel(p: Panel, seconds: number) {
  resetPanel(p); p.cursor = Math.round(seconds / SIMULATION_DT); advanceWorld(p, p.cursor);
}
function clearEnlargement() {
  $('#panels').classList.remove('enlarged');
  for (const p of panels) { p.element.classList.remove('selected'); p.element.querySelector('.panel-head button')!.textContent = 'Enlarge'; }
}
function showFullFights() {
  mode = 'full'; paused = true; focusedVariant = null; clearEnlargement(); reset(); render();
}
function showEvidence() {
  const brief = comparisonBrief(scenario, seed, rotation);
  if (!brief) return;
  mode = 'evidence'; paused = true; focusedVariant = null; clearEnlargement(); reset();
  for (const p of panels) {
    p.clip = brief.clips.find(clip => clip.variant === p.variant.id);
    if (!p.clip) continue;
    p.element.querySelector('h3')!.textContent = p.clip.title;
    p.element.querySelector('.watch-for')!.textContent = p.clip.watchFor;
    p.element.querySelector('.clip-reason')!.textContent = p.clip.why;
    seekPanel(p, p.clip.start);
  }
  renderEvidenceFeedback(); render();
}
function playExcerpt(p: Panel, replay = false) {
  if (mode !== 'evidence' || !p.clip) return;
  const play = replay || !p.playing;
  for (const other of panels) other.playing = false;
  if (p.cursor >= Math.round(p.clip.end / SIMULATION_DT)) seekPanel(p, p.clip.start);
  p.playing = play; focusedVariant = p.variant.id; last = null; render();
}
function seek(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > EXPERIMENT.maxSeconds) throw new Error('Time must be within the experiment');
  mode = 'full'; paused = true; focusedVariant = null; clearEnlargement(); reset(); advance(Math.round(seconds / SIMULATION_DT)); render(); return states();
}
function states() { return panels.map(p => ({ variant: p.variant.id, time: p.world.time, tick: p.world.tick, finished: p.finished, contestants: p.world.contestants.map(c => ({ id: c.id, hp: c.hp, alive: c.alive, position: { ...c.position }, velocity: { ...c.velocity } })) })); }
$('#play').onclick = () => { if (panels.every(p => p.finished) || elapsedTicks * SIMULATION_DT >= EXPERIMENT.maxSeconds) seek(0); paused = !paused; last = null; render(); };
$('#restart').onclick = () => { seek(0); render(); };
$('#step').onclick = () => { paused = true; advance(60); render(); };
$('#time').oninput = () => seek(Number($<HTMLInputElement>('#time').value));
const presets = COMPARISON_BRIEFS;
function updateExample() {
  const preset = comparisonBrief(scenario, seed, rotation);
  $('#example-title').textContent = preset?.title ?? 'Custom match';
  $('#example-description').textContent = preset?.description ?? 'The selected setup is active in every panel.';
  $('#active-match').textContent = `${scenario === 'duel' ? 'Red / blue duel' : 'Four wizards'} · seed ${seed} · ${rotation === 0 ? 'original layout' : 'quarter-turn layout'}`;
  $<HTMLButtonElement>('#show-evidence').disabled = !preset;
  for (const button of document.querySelectorAll<HTMLButtonElement>('#presets button')) button.setAttribute('aria-pressed', String(button.dataset.preset === preset?.id));
  $<HTMLInputElement>('#seed').value = String(seed); $<HTMLSelectElement>('#scenario').value = scenario; $<HTMLSelectElement>('#rotation').value = String(rotation);
}
function loadExample(next: { seed: number; scenario: string; rotation: number }) {
  const old = { seed, scenario, rotation };
  try {
    ({ seed, scenario, rotation } = next); validateExample();
    updateExample();
    if (comparisonBrief(scenario, seed, rotation)) showEvidence(); else showFullFights();
    const url = new URL(location.href); url.searchParams.set('seed', String(seed)); url.searchParams.set('scenario', scenario); url.searchParams.set('rotation', String(rotation)); url.searchParams.delete('time'); history.replaceState(null, '', url);
  } catch (error) { ({ seed, scenario, rotation } = old); updateExample(); notify((error as Error).message); }
}
for (const preset of presets) {
  const button = document.createElement('button'); button.textContent = preset.title; button.dataset.preset = preset.id;
  button.onclick = () => loadExample({ seed: preset.seed, scenario: preset.scenario, rotation: 0 }); $('#presets').append(button);
}
for (const id of ['seed', 'scenario', 'rotation']) $(`#${id}`).onchange = () => loadExample({ seed: Number($<HTMLInputElement>('#seed').value), scenario: $<HTMLSelectElement>('#scenario').value, rotation: Number($<HTMLSelectElement>('#rotation').value) });
const commentDrafts = new Map<string, string>();
const commentSaves = new Map<string, string>();
function panelReference(p: Panel) {
  const brief = comparisonBrief(scenario, seed, rotation);
  return brief && p.clip ? evidenceReference(brief.id, p.clip) : undefined;
}
function scope() { return { experiment: EXPERIMENT.id, scenario, seed, rotation }; }
function renderEvidenceFeedback() {
  for (const p of panels) {
    const reference = panelReference(p);
    if (!reference) continue;
    const notes = notesForEvidence(feedback.notes, scope(), reference);
    const status = p.element.querySelector<HTMLElement>('.review-status')!;
    status.textContent = notes.length ? `Commented · ${notes.length} ${notes.length === 1 ? 'comment' : 'comments'}` : 'Not reviewed';
    status.classList.toggle('commented', notes.length > 0);
    const key = evidenceKey(reference);
    p.element.querySelector<HTMLTextAreaElement>('.comment-text')!.value = commentDrafts.get(key) ?? '';
    p.element.querySelector('.comment-save')!.textContent = commentSaves.get(key) ?? '';
    const list = p.element.querySelector('.evidence-notes')!; list.replaceChildren();
    for (const note of notes) {
      const li = document.createElement('li'); li.textContent = `${new Date(note.at).toLocaleString()} · ${note.time.toFixed(2)}s: ${note.text}`; list.append(li);
    }
  }
  for (const brief of presets) {
    const reviewed = brief.clips.filter(clip => notesForEvidence(feedback.notes, { experiment: EXPERIMENT.id, scenario: brief.scenario, seed: brief.seed, rotation: 0 }, evidenceReference(brief.id, clip)).length > 0).length;
    const button = document.querySelector<HTMLButtonElement>(`#presets button[data-preset="${brief.id}"]`);
    if (!button) continue;
    let badge = button.querySelector('span');
    if (!badge) { badge = document.createElement('span'); badge.className = 'review-progress'; badge.id = `progress-${brief.id}`; button.append(badge); button.setAttribute('aria-label', brief.title); button.setAttribute('aria-describedby', badge.id); }
    badge.textContent = `${reviewed}/${brief.clips.length} commented`;
  }
}
function makeNote(text: string, preference: string, evidence?: EvidenceReference) {
  const focus = evidence?.variant ?? focusedVariant;
  return { at: new Date().toISOString(), experiment: EXPERIMENT.id, source, scenario, seed, rotation,
    time: mode === 'evidence' ? (panels.find(p => p.variant.id === focus)?.world.time ?? 0) : elapsedTicks * SIMULATION_DT,
    viewing: { mode, ...(mode === 'evidence' ? { briefId: comparisonBrief(scenario, seed, rotation)!.id } : {}), focusedVariant: focus, clips: mode === 'evidence' ? panels.filter(p => p.clip).map(p => ({ variant: p.variant.id, start: p.clip!.start, end: p.clip!.end })) : [] },
    panelTimes: panels.map(p => p.world.time), variants: VARIANTS.map(v => v.id), preference, text, ...(evidence ? { evidence } : {}) };
}
async function saveEvidenceComment(p: Panel) {
  const reference = panelReference(p); if (!reference) return;
  const key = evidenceKey(reference);
  const text = (commentDrafts.get(key) ?? '').trim();
  if (!text) { commentSaves.set(key, 'Write a comment first.'); renderEvidenceFeedback(); return; }
  focusedVariant = p.variant.id;
  feedback.notes.push(makeNote(text, 'unsure', reference));
  commentDrafts.delete(key); commentSaves.set(key, 'Comment recorded · saving to workspace…'); renderNotes();
  const saved = await persist();
  commentSaves.set(key, saved ? 'Saved to workspace.' : 'Workspace save failed. Browser backup only if available; retry under Feedback saves and backups.');
  renderEvidenceFeedback();
}
function selectTab(tab: 'comparison' | 'goals') {
  const comparisonActive = tab === 'comparison';
  $('#comparison-page').hidden = !comparisonActive; $('#goals-page').hidden = comparisonActive;
  for (const id of ['comparison', 'goals']) { const button = $<HTMLButtonElement>(`#${id}-tab`); button.setAttribute('aria-selected', String(id === tab)); button.tabIndex = id === tab ? 0 : -1; }
  if (!comparisonActive) { paused = true; for (const p of panels) p.playing = false; }
  render();
}
for (const id of ['comparison', 'goals'] as const) {
  const button = $<HTMLButtonElement>(`#${id}-tab`); button.onclick = () => selectTab(id);
  button.onkeydown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); const next = event.key === 'Home' ? 'comparison' : event.key === 'End' ? 'goals' : id === 'comparison' ? 'goals' : 'comparison';
    selectTab(next); $(`#${next}-tab`).focus();
  };
}
$('#full-fight').onclick = showFullFights;
$('#show-evidence').onclick = showEvidence;
updateExample();
if (params.get('capture') !== '1' && !params.has('time')) { if (comparisonBrief(scenario, seed, rotation)) showEvidence(); }
$('#save-note').onclick = () => {
  feedback.notes.push(makeNote($<HTMLTextAreaElement>('#note').value, $<HTMLSelectElement>('#preference').value));
  $<HTMLTextAreaElement>('#note').value = ''; persist(); renderNotes();
};
const comparison = {
  metadata: { experiment: EXPERIMENT.id, source, alternatives: VARIANTS.map(v => ({ id: v.id, scenarioVariant: v.scenarioVariant, spellReadability: v.spellReadability })), dt: SIMULATION_DT, browser: navigator.userAgent },
  seek, states, loadExample,
  viewing() { return { mode, focusedVariant, panels: panels.map(p => ({ variant: p.variant.id, playing: p.playing, cursor: p.cursor * SIMULATION_DT, clip: p.clip })) }; },
  ready: () => feedbackReady,
  step(count = 1) { if (mode === 'evidence') showFullFights(); paused = true; advance(count); render(); return states(); },
  pause() { paused = true; for (const p of panels) p.playing = false; render(); }, play() { if (mode === 'evidence') showFullFights(); paused = false; last = null; render(); },
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
  const dt = Math.max(0, Math.min(.1, (now - last) / 1000)) * Number($<HTMLSelectElement>('#speed').value);
  if (mode === 'evidence') {
    const advancing = panels.some(p => p.playing);
    for (const p of panels) if (p.playing && p.clip) {
      p.accumulator += dt;
      const count = Math.floor((p.accumulator + 1e-10) / SIMULATION_DT);
      const steps = Math.min(count, Math.round(p.clip.end / SIMULATION_DT) - p.cursor);
      if (steps) { advanceWorld(p, steps); p.cursor += steps; p.accumulator -= steps * SIMULATION_DT; }
      if (p.cursor >= Math.round(p.clip.end / SIMULATION_DT)) {
        if (p.element.querySelector<HTMLInputElement>('.clip-loop')!.checked) { seekPanel(p, p.clip.start); p.playing = true; }
        else p.playing = false;
      }
    }
    if (advancing) render();
  } else if (!paused) {
    accumulator += dt;
    const count = Math.floor((accumulator + 1e-10) / SIMULATION_DT);
    if (count) { advance(count); accumulator -= count * SIMULATION_DT; render(); }
  }
  last = now; requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Reports are optional; the live comparison works before a batch is available.
void fetch(`./experiments/${EXPERIMENT.id}/report.json`).then(async response => {
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
  const link = document.createElement('a'); link.href = `./experiments/${EXPERIMENT.id}/report.json`; link.textContent = 'Full report / run identities'; $('#evidence').append(link);
}).catch(() => {});
void fetch(`./experiments/${EXPERIMENT.id}/reviews.json`).then(async response => {
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

void fetch(`./experiments/${EXPERIMENT.id}/triage.json`).then(async response => {
  if (!response.ok) return;
  const triage = await response.json();
  const details = document.createElement('details'); const title = document.createElement('summary'); title.textContent = 'Review triage / what changed'; details.append(title);
  for (const finding of triage.findings) { const p = document.createElement('p'); p.textContent = `${finding.status}: ${finding.finding} ${finding.action}`; details.append(p); }
  $('#reviews').append(details);
}).catch(() => {});
