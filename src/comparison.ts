import './comparison.css';
import { Color, PCFSoftShadowMap, SpotLight } from 'three';
import { GameRenderer } from './renderer';
import { buildArena } from './arena';
import { BattleView } from './presentation/battleView';
import { createScenario, SIMULATION_DT } from './scenario';
import { COMPARISON_BRIEFS as MOVEMENT_BRIEFS, type EvidenceClip } from './comparisonEvidence';
import { EXPERIMENT as MOVEMENT_EXPERIMENT, VARIANTS as MOVEMENT_VARIANTS } from './experiment';
import { SPELL_EXPERIMENT, SPELL_VARIANTS, SPELL_BRIEFS } from './spellReadabilityExperiment';
import { REVISION_EXPERIMENT, REVISION_VARIANTS, REVISION_BRIEFS } from './spellReadabilityRevision';
import { ART_REVISION_EXPERIMENT, revisionStyles, revisionVariants, revisionBriefs } from './artDirectionRevision';
import { ART_EXPLORATION_EXPERIMENT, explorationFamily, explorationStyles, explorationVariants, explorationBriefs } from './artExplorationExperiment';
import { explorationLighting } from './presentation/artExplorations';
import { revisedLighting } from './presentation/artDirectionRevision';
import { ART_EXPERIMENT, ART_VARIANTS, ART_BRIEFS } from './artDirectionExperiment';
import { artStyle, buildArtArena, ART_STYLES, type ArtDirection } from './presentation/artDirection';
import { initialExpectations, type Decision } from './expectations';

import { evidenceReference, evidenceKey, notesForEvidence } from './evidenceFeedback';
import { validateFeedback, mergeFeedback, type Feedback, type EvidenceReference } from './feedback';

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const params = new URLSearchParams(location.search);
const artExploration = params.get('experiment') === ART_EXPLORATION_EXPERIMENT.id;
const artRevision = params.get('experiment') === ART_REVISION_EXPERIMENT.id;
const artFamilySelection = params.get('family');
const artExperiment = artExploration || artRevision || params.get('experiment') === ART_EXPERIMENT.id;
const artStyles = artExploration ? explorationStyles(artFamilySelection) : artRevision ? revisionStyles(artFamilySelection) : ART_STYLES;
const revisionExperiment = params.get('experiment') === REVISION_EXPERIMENT.id;
const spellExperiment = artExperiment || revisionExperiment || params.get('experiment') === SPELL_EXPERIMENT.id;
const EXPERIMENT = artExploration ? ART_EXPLORATION_EXPERIMENT : artRevision ? ART_REVISION_EXPERIMENT : artExperiment ? ART_EXPERIMENT : revisionExperiment ? REVISION_EXPERIMENT : spellExperiment ? SPELL_EXPERIMENT : MOVEMENT_EXPERIMENT;
const VARIANTS = (artExploration ? explorationVariants(artFamilySelection) : artRevision ? revisionVariants(artFamilySelection) : artExperiment ? ART_VARIANTS : revisionExperiment ? REVISION_VARIANTS : spellExperiment ? SPELL_VARIANTS : MOVEMENT_VARIANTS.map(v => ({ ...v, scenarioVariant: v.id, spellReadability: false }))).map(v => ({ ...v, artDirection: 'artDirection' in v ? v.artDirection as ArtDirection : undefined }));
const COMPARISON_BRIEFS = artExploration ? explorationBriefs(artFamilySelection) : artRevision ? revisionBriefs(artFamilySelection) : artExperiment ? ART_BRIEFS : revisionExperiment ? REVISION_BRIEFS : spellExperiment ? SPELL_BRIEFS : MOVEMENT_BRIEFS;
function comparisonBrief(scene: string, matchSeed: number, layout: number) {
  return layout === 0 ? COMPARISON_BRIEFS.find(b => b.scenario === scene && b.seed === matchSeed) : undefined;
}
const source = typeof __BUILD_SOURCE__ === 'undefined' ? 'development' : __BUILD_SOURCE__;
const app = $('#app');
app.innerHTML = `
<header><div><div class="eyebrow"><a href="./">Wizard Battles / All experiments</a></div><h1>${EXPERIMENT.title}</h1></div><div id="build" class="muted"></div></header>
<nav class="controls" role="tablist" aria-label="Experiment room"><button id="comparison-tab" role="tab" aria-selected="true" aria-controls="comparison-page">Comparison</button><button id="goals-tab" role="tab" aria-selected="false" aria-controls="goals-page" tabindex="-1">Goals</button></nav>
<div id="comparison-page" role="tabpanel" aria-labelledby="comparison-tab">
${artExploration ? `<p><strong>Round three: choose a promising branch within each family.</strong> Porcelain Lab and Paper Theater are cut; earlier rooms and comments remain intact. Photon is the benchmark, Observatory retains its colors and theme, and Atelier protects the improved dungeon setting.</p><nav class="controls" aria-label="Art families">${[['photon','Photon Chamber'],['observatory','Arcane Observatory'],['foundry','Obsidian Atelier']].map(([id,name]) => `<a aria-current="${explorationFamily(artFamilySelection) === id ? 'page' : 'false'}" href="?experiment=art-direction-v3&family=${id}">${name} · 3 branches</a>`).join(' · ')}</nav><p>Retained baselines appear alongside the branches. · <a href="?experiment=art-direction-v2&family=photon">Photon v1 / v2 regression comparison</a> · <a href="?experiment=art-direction-v2">Round two and your comments</a> · <a href="/experiments/art-direction-v3/README.md">Design packet</a></p><p>Start with scenario 2, then check the duel and crowded opening. All excerpts start looping; pause any card to inspect it. Comments save to workspace; a pending save locks the room. Saving retains feedback; it does not start an agent dispatch. No branch is adopted.</p><div id="art-directions" class="art-directions"></div>` : artRevision ? '<p><strong>Round two: preserve what works, then judge the revisions.</strong> Photon remains the benchmark; Observatory has the strongest thematic appeal. All five stay in consideration. <a href="?experiment=art-direction-v2">All revisions and retained baselines</a> · <a href="?experiment=art-direction-v2&family=photon">Photon: unchanged / revised</a> · <a href="?experiment=art-direction-v2&family=observatory">Observatory: unchanged / revised</a> · <a href="?experiment=art-direction-v1">Round one and your original comments</a></p><p>Start with scenario 2, where you left feedback. Comments save to workspace; a pending save locks the room. Saving retains feedback, not a new agent dispatch.</p><div id="art-directions" class="art-directions"></div>' : artExperiment ? '<p><strong>My starting proposal: A / Porcelain Lab</strong> for a welcoming, physical training room. B / Photon Chamber is the strongest literal simulator. You can reject all five.</p><p>Five directions · Select a match below, then play each direction independently. <a href="?experiment=spell-readability-v2">Earlier hit-feedback comparison and comments</a>. Save per-clip reactions below each card; general notes can nominate a direction or say none works. Saving retains feedback; it does not start another agent run.</p><div id="art-directions" class="art-directions"></div>' : ''}
${revisionExperiment ? '<p>Round 2 · A is the previous B; B and C are new alternatives. Each excerpt loops independently until paused. <a href="?experiment=spell-readability-v1">Previous round and comments</a>. After your feedback, the next decision is to adopt one approach, keep the previous cues, or park this direction.</p>' : ''}
<div id="presets" class="controls" aria-label="Recommended matches"></div>
<div class="example-heading"><h2 id="example-title"></h2><p id="example-description"></p><p id="active-match" class="muted" role="status"></p></div>
<div class="controls" aria-label="Comparison mode"><button id="show-evidence" aria-pressed="true">Selected evidence</button><button id="full-fight" aria-pressed="false">Full fights / context</button></div>
<p id="evidence-help">Clips start looping independently. Pause any card to inspect it; playing another leaves it alone.</p>
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
<section class="card"><h2>Evidence, after watching</h2><details><summary>Reveal approaches and experiment identity</summary><div id="variants"></div><small id="identity"></small></details><details><summary>Batch results and persona judgments</summary><div id="evidence">No saved report loaded. Run npm run experiment to generate evidence.</div><div id="reviews"></div></details><p class="muted">Descriptive evidence, no fun score. Expectation approval and build satisfaction are separate. ${artExperiment ? 'All art directions use identical burst gameplay and the chosen fighter flash / impact sparks. Choose a visual world, or reject the candidates.' : spellExperiment ? 'All alternatives use your preferred C movement. Whether the new spell cues help is the open question.' : 'Your recorded viewing preference favors C; the agent reviews retain their original uncertainty.'}</p></section></div>
</div><section id="goals-page" role="tabpanel" aria-labelledby="goals-tab" hidden class="card"><h2>What you want from battles</h2><p>These are goals for future experiments. Approving a goal means “I care about this,” not “the current fights achieve this.” The seven starting goals were already approved in our discussion; you do not need to approve them again.</p>
<p>Edit a goal and <strong>Save edits</strong> to refine it. For a new proposal, <strong>Approve</strong> keeps it as a goal; <strong>Decline</strong> says it is not something you want. <strong>Remove</strong> retires a goal and <strong>Reopen</strong> asks to review it again. History is kept.</p>
<p class="muted">Targets are optional and can be plain language. For example: “Separate duels should sometimes collide in four-way battles.” Use comments and viewing notes on the Comparison tab for reactions to specific fights; use this list for qualities you want us to preserve or improve across experiments. Changes use the same workspace save and browser backup as your notes.</p><p id="expectation-counts" role="status"></p>
<div class="controls"><label>Show <select id="filter"><option value="all">All goals / history</option><option value="unreviewed">Needs your review</option><option value="approved">Approved goals</option><option value="declined">Declined proposals</option><option value="removed">Removed goals</option></select></label><button id="add-expectation">Propose expectation</button></div><div id="expectations"></div></section><details id="feedback-tools"><summary>Feedback saves and backups</summary><p id="save-status" role="status">Checking workspace saves…</p><div class="controls"><button id="retry-save">Retry workspace save</button><button id="export">Export feedback JSON</button><label>Import JSON <input id="import" type="file" accept="application/json"></label></div></details><p id="notice" class="notice" role="status"></p>`;
const storageGate = document.createElement('section');
storageGate.id = 'storage-gate';
storageGate.setAttribute('role', 'dialog');
storageGate.setAttribute('aria-modal', 'true');
storageGate.setAttribute('aria-labelledby', 'storage-gate-title');
storageGate.innerHTML = `<div><h2 id="storage-gate-title">Experiment room paused</h2><p id="storage-gate-message" role="alert">Connecting to workspace storage…</p><p>Comments are complete only after the workspace confirms the save.</p><button id="storage-reconnect">Reconnect and save pending feedback</button> <button id="storage-export">Export feedback backup</button></div>`;
document.body.append(storageGate);
app.inert = true;
function blockWorkspace(message: string | null) {
  app.inert = message !== null;
  storageGate.hidden = message === null;
  if (message !== null) {
    $('#storage-gate-message').textContent = message;
    suspendForStorage();
    if (app.contains(document.activeElement)) $('#storage-reconnect').focus();
  } else {
    resumeAfterStorage();
  }
}
$('#panels').classList.toggle('two-panels', VARIANTS.length === 2);
const preference = $<HTMLSelectElement>('#preference');
for (const option of Array.from(preference.options)) if (['A', 'B', 'C'].includes(option.value)) option.remove();
for (const [i, variant] of VARIANTS.entries()) {
  const option = new Option(`${String.fromCharCode(65+i)} · ${variant.name}`, String.fromCharCode(65+i));
  preference.add(option, preference.options[preference.options.length-2]);
}
if (artExperiment) {
  $('#panels').classList.add('art-panels');
  $('#evidence').textContent = `Presentation experiment: combat is held identical. No balance or pacing score is inferred. Captures and validation are retained in the ${EXPERIMENT.id} packet.`;
  $('#evidence-help').textContent = 'Directions start looping independently. Use Enlarge for a closer look and Previous / Next to compare; every clip has its own clock, replay and comment form.';
  for (const [i, style] of artStyles.entries()) {
    const article = document.createElement('article');
    const title = document.createElement('h3'); title.textContent = `${String.fromCharCode(65+i)} · ${artRevision || artExploration ? VARIANTS[i].name : style.name}`;
    const vision = document.createElement('p'); vision.textContent = style.vision;
    const fit = document.createElement('p'); fit.className = 'muted'; fit.textContent = style.fit;
    const button = document.createElement('button'); button.textContent = `View ${artRevision || artExploration ? VARIANTS[i].name : style.name}`;
    button.onclick = () => {
      const panel = panels[i];
      if ($('#panels').classList.contains('enlarged') && !panel.element.classList.contains('selected')) panel.element.querySelector<HTMLButtonElement>('.panel-head button')!.click();
      panel.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    article.append(title, vision, fit, button); $('#art-directions').append(article);
  }
}
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
let savedRevision = 0;
let saving = false;
let checkingConnection = false;
let initialLoadComplete = false;
const confirmedNotes = new Set<string>();
const pendingComments = new Map<string, string>();
function confirmedFeedbackNotes() { return feedback.notes.filter(n => confirmedNotes.has(JSON.stringify(n))); }
async function workspaceRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(path, { ...options, cache: 'no-store', signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(`Workspace returned HTTP ${response.status}`);
  return response.json();
}
function persist() {
  const revision = ++saveRevision;
  const snapshot = structuredClone(feedback);
  const browserSaved = saveBrowser();
  saving = true;
  blockWorkspace('Saving feedback to the workspace. Please wait for confirmation…');
  $('#save-status').textContent = 'Saving to workspace…';
  saveQueue = saveQueue.then(async () => {
    await feedbackReady;
    const saved = await workspaceRequest('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot) });
    if (saved.persisted !== true || typeof saved.file !== 'string' || typeof saved.savedAt !== 'string') throw new Error('Workspace did not confirm persistence');
    savedRevision = revision;
    for (const n of snapshot.notes) confirmedNotes.add(JSON.stringify(n));
    if (revision !== saveRevision) return true;
    for (const [key, text] of pendingComments) {
      if (commentDrafts.get(key)?.trim() === text) commentDrafts.delete(key);
      commentSaves.set(key, 'Saved to workspace.');
    }
    pendingComments.clear();
    saving = false;
    $('#save-status').textContent = `Saved to ${saved.file} at ${new Date(saved.savedAt).toLocaleTimeString()}. Browser backup ${browserSaved ? 'saved' : 'unavailable'}.`;
    renderNotes();
    blockWorkspace(null);
    return true;
  }).catch(error => {
    if (revision === saveRevision) {
      saving = false;
      const message = `Workspace save failed (${(error as Error).message}). Feedback is pending; this page is locked until it can be saved. ${browserSaved ? 'A browser backup was saved.' : 'Browser backup is unavailable; export a backup before closing.'}`;
      $('#save-status').textContent = message;
      for (const key of pendingComments.keys()) commentSaves.set(key, 'Workspace save failed. Pending confirmation.');
      renderEvidenceFeedback();
      blockWorkspace(message);
    }
    return false;
  });
  return saveQueue;
}
async function checkConnection() {
  if (!initialLoadComplete || checkingConnection || saving) return;
  checkingConnection = true;
  const recovering = !storageGate.hidden;
  const revision = saveRevision;
  try {
    const health = await workspaceRequest('/api/feedback/health');
    if (saving || revision !== saveRevision) return;
    if (health.service !== 'wizard-battles-feedback' || health.storage !== 'workspace') throw new Error('Workspace storage is unavailable');
    let needsSave = savedRevision < saveRevision;
    if (recovering) {
      const saved = await workspaceRequest('/api/feedback');
      validateFeedback(saved.feedback);
      if (saving || revision !== saveRevision) return;
      for (const n of saved.feedback.notes) confirmedNotes.add(JSON.stringify(n));
      const merged = mergeFeedback(feedback, saved.feedback);
      if (JSON.stringify(merged) !== JSON.stringify(feedback)) {
        feedback = merged; renderNotes(); renderExpectations();
      }
      needsSave ||= JSON.stringify(feedback) !== JSON.stringify(saved.feedback);
      saveBrowser();
    }
    if (needsSave) await persist();
    else blockWorkspace(null);
  } catch {
    if (saving || revision !== saveRevision) return;
    blockWorkspace('Workspace storage is disconnected. The experiment room is locked; reconnect to continue. Any unconfirmed feedback is still pending.');
  } finally { checkingConnection = false; }
}
$('#retry-save').onclick = () => { void persist(); };
$('#storage-reconnect').onclick = () => { void checkConnection(); };
$('#storage-export').onclick = () => { $('#export').click(); };
function renderNotes() {
  $('#notes-list').replaceChildren();
  for (const n of confirmedFeedbackNotes().filter(n => !n.evidence && n.experiment === EXPERIMENT.id)) {
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

let seed = Number(params.get('seed') ?? (artRevision || artExploration ? 19 : 7));
let scenario = params.get('scenario') ?? (artRevision || artExploration ? 'four-wizards' : 'duel');
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
const allowAutoplay = params.get('capture') !== '1' && !params.has('time');
let storagePlayback: { playing: boolean[]; paused: boolean } | null = null;
const panels = VARIANTS.map((variant, index) => {
  const element = document.createElement('section'); element.className = 'panel';
  element.innerHTML = `<div class="panel-head"><strong></strong><button aria-label="Enlarge panel ${String.fromCharCode(65 + index)}">Enlarge</button></div><div class="enlarged-controls"><div><button class="previous-variant">← Previous variant</button> <button class="next-variant">Next variant →</button></div><p class="muted">← / → seek 0.5s · Space play/pause · , / . one tick · Ctrl+← / → previous/next · Tab comment · Ctrl+Enter submit</p></div><div class="clip-caption"><h3></h3><p class="review-status" role="status"></p><p class="watch-for"></p><details><summary>Why this moment?</summary><p class="clip-reason"></p></details></div><div class="clip-controls"><button class="clip-play" aria-label="Play excerpt ${String.fromCharCode(65 + index)}">Play excerpt</button><button class="clip-replay" aria-label="Replay excerpt ${String.fromCharCode(65 + index)}">Replay</button><label>Clip time <input class="clip-time" aria-label="Excerpt time ${String.fromCharCode(65 + index)}" type="range" step="0.016666666666666666"></label><label><input class="clip-loop" aria-label="Loop excerpt ${String.fromCharCode(65 + index)}" type="checkbox" checked> Loop</label><button class="clip-full" aria-label="Full fight ${String.fromCharCode(65 + index)}">Full fight</button><output class="clip-clock"></output></div><canvas aria-label="Battle panel ${String.fromCharCode(65 + index)}"></canvas><footer></footer><section class="evidence-comment"><h3>Your comment on this evidence</h3><label>Comment<textarea class="comment-text" aria-label="Comment on evidence ${String.fromCharCode(65 + index)}" placeholder="What works here, what doesn't, or what are you unsure about?"></textarea></label><button class="save-comment" aria-label="Save evidence comment ${String.fromCharCode(65 + index)}">Save comment</button><p class="comment-save" role="status"></p><ol class="evidence-notes"></ol></section>`;
  $('#panels').append(element);
  const canvas = element.querySelector('canvas')!;
  const gfx = new GameRenderer(canvas, { pixelRatio: 1, shadowMapSize: artExperiment ? 1024 : 512 }); const style = artStyle(variant.artDirection);
  gfx.scene.add(style ? buildArtArena(style) : buildArena());
  if (style) {
    gfx.scene.background = new Color(style.background);
    gfx.renderer.shadowMap.type = PCFSoftShadowMap;
    gfx.scene.traverse(node => { if (node instanceof SpotLight) { node.shadow.normalBias = 1.5; node.shadow.bias = -0.0001; } });
  }
  if (style?.revision === 3) explorationLighting(gfx.scene, style);
  if (style?.revision === 2) revisedLighting(gfx.scene, style);
  const world = createScenario({ seed, scenario, rotation, variant: variant.scenarioVariant });
  const view = new BattleView(world, gfx.camera, { visualSeed: seed ^ 0x5f3759df, spellReadability: variant.spellReadability, artDirection: variant.artDirection }); gfx.scene.add(view.group);
  const panel = { variant, element, gfx, world, view, finished: false, clip: undefined as EvidenceClip | undefined, cursor: 0, playing: false, autoplay: allowAutoplay, accumulator: 0 };
  element.querySelector<HTMLButtonElement>('.save-comment')!.onclick = () => saveEvidenceComment(panel);
  element.querySelector<HTMLTextAreaElement>('.comment-text')!.oninput = event => { const reference = panelReference(panel); if (reference) commentDrafts.set(evidenceKey(reference), (event.target as HTMLTextAreaElement).value); };
  element.querySelector<HTMLButtonElement>('.clip-play')!.onclick = () => playExcerpt(panel);
  element.querySelector<HTMLButtonElement>('.clip-replay')!.onclick = () => { if (panel.clip) seekPanel(panel, panel.clip.start); playExcerpt(panel, true); };
  element.querySelector<HTMLInputElement>('.clip-time')!.oninput = event => inspectPanel(panel, Number((event.target as HTMLInputElement).value));
  element.querySelector<HTMLButtonElement>('.previous-variant')!.onclick = () => moveVariant(panel, -1);
  element.querySelector<HTMLButtonElement>('.next-variant')!.onclick = () => moveVariant(panel, 1);
  element.querySelector<HTMLButtonElement>('.clip-full')!.onclick = () => { showFullFights(); element.querySelector<HTMLButtonElement>('.panel-head button')!.click(); };
  element.querySelector('button')!.onclick = () => {
    const open = !element.classList.contains('selected'); document.querySelectorAll('.panel').forEach(e => e.classList.remove('selected'));
    if (open) focusedVariant = variant.id;
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
function suspendForStorage() {
  if (storagePlayback) return;
  storagePlayback = { playing: panels.map(p => p.playing), paused };
  paused = true;
  for (const p of panels) p.playing = false;
  render();
}
function resumeAfterStorage() {
  if (!storagePlayback) return;
  paused = storagePlayback.paused;
  panels.forEach((p, i) => { p.playing = storagePlayback!.playing[i]; });
  storagePlayback = null; last = null; render();
}
function inspectPanel(p: Panel, seconds: number) {
  if (!p.clip || mode !== 'evidence') return;
  p.autoplay = false;
  seekPanel(p, Math.max(p.clip.start, Math.min(p.clip.end, seconds)));
  focusedVariant = p.variant.id; render();
}
function moveVariant(p: Panel, direction: number) {
  const visible = panels.filter(other => mode === 'full' || other.clip);
  const next = visible[(visible.indexOf(p) + direction + visible.length) % visible.length];
  if (next !== p) next.element.querySelector<HTMLButtonElement>('.panel-head button')!.click();
  focusedVariant = next.variant.id;
  next.element.querySelector<HTMLButtonElement>(direction > 0 ? '.next-variant' : '.previous-variant')!.focus({ preventScroll: true });
  next.element.scrollIntoView({ block: 'start' });
}
document.addEventListener('keydown', event => {
  if (app.inert || $('#comparison-page').hidden || !$('#panels').classList.contains('enlarged') || event.altKey || event.metaKey || event.isComposing) return;
  const p = panels.find(p => p.element.classList.contains('selected'));
  if (!p) return;
  const target = event.target as HTMLElement;
  const editing = target.matches('input, textarea, select, [contenteditable="true"]');
  if (event.ctrlKey && event.key === 'Enter' && mode === 'evidence') {
    event.preventDefault(); if (!event.repeat) void saveEvidenceComment(p); return;
  }
  if (event.ctrlKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault(); moveVariant(p, event.key === 'ArrowRight' ? 1 : -1); return;
  }
  if (event.key === 'Tab' && !event.shiftKey && mode === 'evidence' && !target.closest('.evidence-comment')) {
    event.preventDefault(); p.element.querySelector<HTMLTextAreaElement>('.comment-text')!.focus(); return;
  }
  if (editing || event.ctrlKey || event.shiftKey) return;
  if (event.key === ' ') {
    event.preventDefault(); if (event.repeat) return;
    if (mode === 'evidence') playExcerpt(p);
    else $('#play').click();
  } else if (['ArrowLeft', 'ArrowRight', ',', '.'].includes(event.key)) {
    event.preventDefault();
    const delta = event.key === ',' ? -SIMULATION_DT : event.key === '.' ? SIMULATION_DT : event.key === 'ArrowLeft' ? -.5 : .5;
    if (mode === 'evidence') inspectPanel(p, p.cursor * SIMULATION_DT + delta);
    else {
      seek(Math.max(0, Math.min(EXPERIMENT.maxSeconds, elapsedTicks * SIMULATION_DT + delta)));
      p.element.querySelector<HTMLButtonElement>('.panel-head button')!.click();
    }
  }
});
function advanceWorld(p: Panel, count: number) {
  for (let tick = 0; tick < count && !p.finished; tick++) {
    p.world.update(SIMULATION_DT); p.view.recordTick();
    p.finished = p.world.contestants.filter(c => c.alive).length <= 1 || p.world.tick >= Math.round(EXPERIMENT.maxSeconds / SIMULATION_DT);
  }
}
function resetPanel(p: Panel) {
  p.playing = false; p.accumulator = 0; p.cursor = 0;
  p.view.dispose(); p.world = createScenario({ seed, scenario, rotation, variant: p.variant.scenarioVariant });
  p.view = new BattleView(p.world, p.gfx.camera, { visualSeed: seed ^ 0x5f3759df, spellReadability: p.variant.spellReadability, artDirection: p.variant.artDirection }); p.gfx.scene.add(p.view.group); p.finished = false;
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
    p.playing = p.autoplay;
  }
  renderEvidenceFeedback(); render();
}
function playExcerpt(p: Panel, replay = false) {
  if (mode !== 'evidence' || !p.clip) return;
  const play = replay || !p.playing;
  if (!play) p.autoplay = false;
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
    const notes = notesForEvidence(confirmedFeedbackNotes(), scope(), reference);
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
    const reviewed = brief.clips.filter(clip => notesForEvidence(confirmedFeedbackNotes(), { experiment: EXPERIMENT.id, scenario: brief.scenario, seed: brief.seed, rotation: 0 }, evidenceReference(brief.id, clip)).length > 0).length;
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
  pendingComments.set(key, text); commentSaves.set(key, 'Saving to workspace…'); renderEvidenceFeedback();
  await persist();
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
  metadata: { experiment: EXPERIMENT.id, source, alternatives: VARIANTS.map(v => ({ id: v.id, scenarioVariant: v.scenarioVariant, spellReadability: v.spellReadability, artDirection: v.artDirection })), dt: SIMULATION_DT, browser: navigator.userAgent },
  seek, states, loadExample,
  viewing() { return { mode, focusedVariant, panels: panels.map(p => ({ variant: p.variant.id, playing: p.playing, cursor: p.cursor * SIMULATION_DT, clip: p.clip })) }; },
  ready: () => feedbackReady,
  step(count = 1) { if (mode === 'evidence') showFullFights(); paused = true; advance(count); render(); return states(); },
  pause() { storagePlayback = null; paused = true; for (const p of panels) { p.playing = false; p.autoplay = false; } render(); }, play() { if (mode === 'evidence') showFullFights(); paused = false; last = null; render(); },
  feedback() { return structuredClone(feedback); },
};
declare global { const __BUILD_SOURCE__: string; interface Window { comparison: typeof comparison } }
window.comparison = comparison;
renderExpectations(); renderNotes(); render();
let migrateBrowser = false;
const feedbackReady = (async () => {
  try {
    const saved = await workspaceRequest('/api/feedback'); validateFeedback(saved.feedback);
    for (const n of saved.feedback.notes) confirmedNotes.add(JSON.stringify(n));
    feedback = mergeFeedback(feedback, saved.feedback);
    migrateBrowser = JSON.stringify(feedback) !== JSON.stringify(saved.feedback) && (feedback.notes.length > 0 || feedback.expectations.some(e => e.history.length > (initialExpectations().find(i => i.id === e.id)?.history.length ?? 0)));
    saveBrowser(); renderNotes(); renderExpectations();
    $('#save-status').textContent = `Workspace connected · ${saved.location}. Existing browser notes will also be saved here.`;
  } catch {
    $('#save-status').textContent = 'Workspace storage unavailable. Reconnect before reviewing or commenting.';
    blockWorkspace('Workspace storage is unavailable. The experiment room is locked. Reconnect to continue, or export a feedback backup.');
  }
})();
void feedbackReady.then(() => { initialLoadComplete = true; if (migrateBrowser) void persist(); else void checkConnection(); });
// Bound outage detection even when the page was loaded before the server stopped.
setInterval(() => { void checkConnection(); }, 2000);
window.addEventListener('offline', () => blockWorkspace('Connection lost. Reconnect before continuing.'));
window.addEventListener('online', () => { void checkConnection(); });
window.addEventListener('focus', () => { void checkConnection(); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    blockWorkspace('Checking workspace storage before resuming…');
    void checkConnection();
  }
});
if (params.has('time')) seek(Number(params.get('time')));
function tick(now: number) {
  if (last === null) last = now;
  const dt = Math.max(0, Math.min(.1, (now - last) / 1000)) * Number($<HTMLSelectElement>('#speed').value);
  if (app.inert) { last = now; requestAnimationFrame(tick); return; }
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
    const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = plain?.title ? `${review.persona}: ${plain.title}` : review.persona;
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
