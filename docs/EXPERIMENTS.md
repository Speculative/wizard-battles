# Experiment room

For the repeatable preparation and handoff process, follow the
[experiment-comparison skill](../.agents/skills/experiment-comparison/SKILL.md).
This document covers the current tools, formats and delivered examples.

For owner viewing, run `npm run dev:server -- start` and open
**http://localhost:5173/compare.html**. This starts a detached Vite process with
no dispatch-owned terminal or pipes. It survives the launching command and agent
dispatch; it lasts until stopped, crashed, or the container stops. Agents manage
it with `npm run dev:server -- status`, `stop`, and `restart`. Status checks the
process identity and workspace health; logs and PID/token state live in ignored
`runs-server/`. Port 5173 is strict: a conflict fails instead of silently serving
another port. Do not use a foreground tool-session server for owner handoffs.
`npm run dev` remains available for temporary interactive development.

The server controller is Linux-specific (it verifies `/proc` identity before
signaling a process). If a controller is killed while holding
`runs-server/controller.lock`, inspect processes before removing the stale lock.
For isolated lifecycle checks, `WIZARD_SERVER_DIR` and `WIZARD_DEV_PORT` override
its state directory and port; `WIZARD_FEEDBACK_DIR` overrides feedback storage.
Container shutdown still stops the service; start it again after container
startup. An already-open page rendering battles is not proof the server is up. The ordinary single-battle page remains at `/`.

The first experiment, `movement-pacing-v1`, compares baseline (A), measured commitments (B), and bursts/resets (C). These are configuration packages applied to every fighter; abilities and tactics stay the same. The hypothesis concerns anticipating pressure/commitment/escape, not maximizing activity. All three can fail. The two scenes use the existing asymmetric kits, so a red win is not a general balance result.

The seven initial expectations come from `nezw-rsmt` and `sfmb-mnnj`. E004–E007 began as agent proposals, provisionally approved in the owner's 2026-10-17 agreement. History retains that distinction. Expectation approval does not certify build satisfaction.

## Viewing and feedback

The **Comparison** tab opens a designer's evidence brief: two labeled excerpts, a concrete interpretation, and captions saying what to watch and why that moment was chosen. **Play excerpt** plays only that card and pauses the other; each has its own time, scrubber, replay and optional loop. Nothing auto-plays on load. Names and commentary remain visible. This supports assessing a proposal, rather than asking the owner to follow three simultaneous fights or perform a blind trial.

`src/comparisonEvidence.ts` owns the editorial selection, separately from playback. Selection is manual and based on inspected fight content, never generic “short”/“late” offsets. Current briefs:

- Duel 7: A at 2.5–6.4s (uninterrupted melee finish) versus C at 6–12.3s (separation and return to contact).
- Duel 1: B at 40–46s (casting/movement without damage, red 30 / blue 90 HP) versus C at 8–12s (shots, renewed contact and a finish). B was still landing hits in the old 8–14s window, so that window did not demonstrate the stall. No further damage follows B's last hit at 16.98s through the 120s timeout.
- Four-wizards 19: A at 8.5–12.5s (red pursues blue) versus C at 6.5–10.5s (green falls, yellow hits red, red engages yellow with blue still alive).

These are selected arguments, not representative samples or proof that other variants never produce a desired behavior. `tests/comparisonEvidence.test.ts` verifies the underlying event/HP claims against current gameplay. Reinspect/reselect if mechanics change; do not keep stale captions to satisfy a score. Browser checks inspect exact reconstructed excerpt states and independent controls. Visual inspection of sampled frames does not count as continuously watching the clips.

**Full fights / context** returns to the shared three-panel player; each evidence card also opens its own full fight enlarged. Shared play/pause, restart, speed, single-second stepping and seeking remain available there. All unfinished worlds advance the same number of ticks, and completed fights hold their final state. Query parameters `capture=1` or `time` open the full-fight view for reproducible capture. Custom setups apply on change and have no evidence excerpts unless specifically curated.

Each evidence card has a comment form and its own comment history. **Not reviewed** changes to **Commented** only after the server confirms persistence of a nonempty comment; preset buttons show how many of their pieces have comments (for example, 1/2). This means the owner has opined, not that they like the result. A successful POST is acknowledged only after the snapshot file and directory are synced to disk. Browser-only or pending submissions do not mark evidence reviewed. Inline save status identifies the workspace receipt. Comments recover from workspace snapshots in a fresh browser. Unsaved card drafts survive preset/tab switches in the current page, but are not durable until saved.

Attached notes carry an optional `evidence` reference: stable clip `id`, `revision`, brief ID, variant and exact bounds. Matching also checks experiment, scene, seed and rotation. UI-only source updates preserve comment history; change the clip revision whenever its depicted gameplay materially changes, and reselect/inspect it as usual. Different bounds/revisions do not inherit a reviewed status. Older and general viewing notes remain in the general notes area, without marking individual evidence as reviewed.

A timestamped note saves experiment, exact source hash, scenario, seed, rotation, panel identities and each panel’s actual held time. New notes also retain viewing mode, brief ID, focused variant, and each excerpt’s bounds. In evidence mode there is no shared fight time; `time` records the focused panel’s actual time (or zero if none was focused), while `panelTimes` retains every panel’s time. Older notes without this optional context remain compatible. Preferences include unsure, no meaningful difference, and none works. With `npm run dev` or `npm run preview`, feedback automatically saves append-only JSON snapshots to **`runs-feedback/` in the workspace**, through `/api/feedback`. Each contains `savedAt` and the full `feedback` object. The status beside the notes shows the saved file or an explicit failure. Existing notes in this browser migrate automatically when the updated viewer opens at the same origin. A fresh browser loads merged workspace feedback. Concurrent browsers retain both sets of notes and expectation histories; the newest history entry determines current wording/decision. An open page loads other browsers’ saves on reload. Files are ignored by Git, survive server restarts, and remain agent-readable; archive them separately when moving workspaces. `WIZARD_FEEDBACK_DIR` can override the storage directory (used for isolated checks).

The room starts locked until workspace storage is reachable. A two-second
heartbeat with a four-second request timeout checks storage availability; lost
connectivity locks the entire room and pauses playback. Returning to a hidden tab
also checks storage before resuming. There can be a short interval between a
server outage and detection: a submission in that interval locks the page while
saving and stays pending on failure. Only an explicit persistence receipt unlocks
that submission. Failed submissions are kept in browser backup when available,
can be exported from the lock screen, and retry on reconnection without creating
duplicate notes. Typed drafts are not autosaved; pressing **Save comment** is the
persistence boundary. Do not report a pending comment as reviewed or agent-readable.

Before a revision dispatch changes candidates, verify the feedback actually
exists in accessible workspace snapshots or an owner-provided export. Identify
the file, count and evidence context, and summarize the comments being acted on.
Resolve missing intake before starting visual revisions. A saved browser backup
alone is not a completed agent handoff.

**Feedback saves and backups**, available below either tab, contains the workspace status, retry, export and import controls. Browser localStorage remains a backup. **Export feedback JSON** makes another agent-readable copy; imports merge histories and distinct notes without replacing newer edits with older ones. Static-only hosting has no workspace API, so the experiment room remains locked; owner viewing requires the feedback backend. Invalid imports are rejected without changing current feedback.

The separate **Goals** tab contains **What you want from battles** and shows all goals by default, with counts for approved goals and proposals needing review. The initial seven are already approved; no repeat approval is needed. These decisions describe what the owner cares about, not whether the current build satisfies it. Use viewing notes for a reaction to a particular fight, and this list for qualities to preserve or improve across experiments.

Edit wording, optional free-text targets and notes, then **Save edits**. **Propose expectation** adds an entry needing review. **Approve** keeps a proposal as a goal; **Decline** rejects it; **Remove** retires a goal; **Reopen** returns it for review. Switching to Goals pauses playback; returning to Comparison preserves the selected evidence and its times. Filters include every decision state. An empty review filter says no decisions are pending and offers **View all goals**, rather than implying there are no expectations. History remains available. Evidence/satisfaction is recorded in persona reports separately from these owner decisions.

## Reproducible evidence

```
npm run experiment -- --publish
npm run experiment -- --seeds 101,211 --out runs-experiment/fresh-validation
npm run capture:comparison -- --scenario duel --seed 1 --duration 20 --fps 6 --out runs-captures/duel-s1
npm run capture:comparison -- --scenario duel --seed 1 --time 90 --duration 0 --out runs-captures/duel-s1-late
```

The batch uses four seeds × two scenarios × two rotations × three approaches (48 matches), at 1/60 s for at most 120 s. Each batch gets its own directory and refuses to overwrite an existing one. It retains raw events/frames, metadata, exact source files, configuration, and a content hash. `--publish` updates the compact report served by the viewer at `public/experiments/movement-pacing-v1/report.json`. Raw diagnostic logs and source snapshots remain in the ignored `runs-experiment/` directory. Commit or separately archive artifacts when moving machines. The report retains all per-run outcomes, HP, spell damage, speeds, sampled movement states, and bounded opening/consequence excerpts; a complete causal log is the raw JSONL, not that excerpt.

The content hash covers simulation/viewer code, scripts, package files and build configuration. It remains stable across commits with unchanged source inputs; the batch also records HEAD. The viewer warns when a saved report's source differs. Rebuild production after regenerating published reports so it serves current evidence.

Damage gaps, duration, outcomes and speed are independent descriptive dimensions, not an interestingness score. Current event IDs identify spell types rather than individual attacks. Unique cast/projectile lineage and broad matchup validation remain follow-up work; the report explicitly records that limitation. Rotation alone does not swap asymmetric kits or establish balance. Fresh-seed batches support checking a hypothesis, not approval of a preferred approach.

Comparison capture starts its own local Vite server, captures the three synchronized panels, stores per-frame states and source/browser/viewport metadata in `capture.json`, and encodes `clip.mp4` through ffmpeg. FPS must divide 60. For smoother clips use 10 or 30 FPS. Images and clips are generated evidence, not externally authored art assets. The existing `npm run capture` still captures one battle, as documented in CAPTURE.md.

`window.comparison` exposes `metadata`, `seek(seconds)`, `step(ticks)`, `states()`, `play()`, `pause()`, `loadExample({seed, scenario, rotation})`, `viewing()` (mode, focused variant and per-panel playback/ranges), `ready()` (workspace feedback loaded) and a copied `feedback()` for automation. Query parameters `capture=1`, `scenario`, `seed`, `rotation`, and `time` make an exact paused example addressable. Automation `seek`, `step` and `play` use full-fight mode; evidence controls are independent.

## Checks and review loop

```
npm test
npm run build
npm run check:comparison
npm run check:comparison -- --production
# UI/storage changes only, skipping unchanged full-match checks:
npm run check:comparison -- --ui-only
# Real server shutdown/restart, pending saves and browser recovery:
npx tsx scripts/check-feedback-connection.ts
```

The comparison browser check verifies content-selected evidence, independent seek/replay/loop, exclusive clip playback, evidence note context, per-piece comments/progress and recovery, Comparison/Goals tabs, preset changes, fresh-browser workspace recovery, save failure/retry, headless agreement (unless `--ui-only`), resize/enlargement independence, synchronized live ticks, finished holds, feedback persistence/export/import, invalid imports, and expectation decisions. The existing `check:browser` checks the single-battle view.

For a persona round, use `docs/PERSONA_REVIEW.md`. Publish actual reviews and triage in `public/experiments/movement-pacing-v1/reviews.json` so they appear below the viewing panels. Give each review a `displaySummary: {title, text}` in plain language: what the reviewer noticed, where, and what it means for the choice. Keep source/evidence detail in the original report; summaries restate that review and do not imply a new evaluation. Never describe a log review or sampled stills as watching a clip, never fabricate owner preferences, and retain disagreement. A working loop is delivered before the owner chooses any approach.

## Delivered pilot evidence

The committed report contains 48 screening matches; `public/experiments/movement-pacing-v1/validation.json` adds 24 fresh-seed matches. Current media in that directory shares source `sha256:c818e1626474c535cf8c552ee5a650ae70f70eda3c9a4b65857abc9d6a45f55f`:

- [Duel seed1 clip](../public/experiments/movement-pacing-v1/media/duel-s1/clip.mp4), with [frame-state manifest](../public/experiments/movement-pacing-v1/media/duel-s1/capture.json).
- [Four-way seed19 clip](../public/experiments/movement-pacing-v1/media/four-s19/clip.mp4), with [manifest](../public/experiments/movement-pacing-v1/media/four-s19/capture.json).
- [Measured duel seed1 at 90s](../public/experiments/movement-pacing-v1/media/duel-s1-late/frame-00000.png), showing continuing projectile activity without HP progress.
- [Three persona assessments](../public/experiments/movement-pacing-v1/reviews.json) and [triage](../public/experiments/movement-pacing-v1/triage.json), also displayed under the comparison page's evidence disclosure.

Initial review excerpts and the full spectacle review preserve pre-fix source labels; corrected follow-up evidence is clearly distinguished. The systems report retains initial independent reviewer messages plus an explicitly root-authored verification follow-up. `media/reviewed-frames/manifest.json` maps retained inspected images to original workspace paths and hashes. The reviews inspected sampled stills and logs; they did not continuously watch the encoded clips. Clips are provided for human viewing.

The next useful hypothesis is stronger spell commitment/payoff communication, including framing at comparison scale. Measured movement is not adopted: it offers some clearer spacing but can create prolonged non-progress. Fresh validation also finds baseline/burst stalls, so no profile is a general solution. The owner’s first exported viewing note (2026-10-18) strongly prefers C/burst, especially in duels and for intersecting fights in the four-way scene, and dislikes B/measured’s strafing duels. This is owner feedback on the viewed examples, rather than a general calibration of the persona judges.

## Spell readability comparison

`compare.html?experiment=spell-readability-v1` selects the presentation-only
experiment. Both panels construct the exact `burst` scenario; A retains current
spell visuals and B enables preparation progress/direction, release pulses and
confirmed-damage markers. It does not change the default movement experiment or
the ordinary battle page. Event metadata includes release/hit positions so
reconstructed markers stay at the event location. Explosions retain their old
particles and do not imply damage. The directional pointer describes current
preparation, not a guaranteed future projectile path.

The room now contains three content-selected pairs in `SPELL_BRIEFS` in
`src/spellReadabilityExperiment.ts`:

- Duel 7, 8.3–12.6s: blue lands fireballs, red releases a melee swing that
  misses, then red connects and finishes.
- Four-wizards 19, 5.8–9.8s: green falls, yellow hits red, red reaches yellow;
  an ice shard also lands without damage.
- Four-wizards 1, 0.1–3.9s: the contrary case with spread shots, rapid fire,
  melee and falling ice competing for attention.

Matched times are intentional because gameplay is identical; each card still
plays, seeks and replays independently. The proposal is to advance B cautiously
for clearer damage confirmation, with small preparation detail, overlap and
attacker attribution retained as limitations. All three independent persona
lenses tentatively prefer B for local consequences, with no demonstrated gain
in experienced pacing, magical identity or readable initiative. They inspected
sampled images and logs, not continuous footage.

The [packet](../public/experiments/spell-readability-v1/README.md) links the
24-setup report, three captures, exact state/provenance manifests, retained
reviews and triage. Original review source labels remain intact. A batch-header
metadata fix and a fix scoping general notes to their experiment changed no
gameplay or spell rendering; `source-followup.json` verifies that
all 121 recaptured PNGs are byte-identical and all 24 gameplay event streams
match (excluding execution-time diagnostics).

Reproduce or check with:

```
npm run experiment -- --experiment spell-readability-v1 --seeds 1,7,19,42,101,211 --publish
npm run capture:comparison -- --experiment spell-readability-v1 --scenario duel --seed 7 --time 8.3 --duration 4.3 --fps 10
npm run check:spell-comparison -- --production
```

The batch runs C once per scenario/seed/rotation; the visual alternatives are
not separate combat trials. CLI seed/max overrides appear in the report's
effective experiment configuration. Production browser checks cover all 24
complete setups against headless C results, independent excerpt controls,
durable comments/recovery and two-panel enlargement. Existing captures and
experiments default to movement pacing. Feedback continues to save under
`runs-feedback/`, with the new experiment and exact evidence identities.

## Spell readability revision

`compare.html?experiment=spell-readability-v2` preserves the first round and
its comments under `spell-readability-v1`. Round two compares the previous B
(now labeled A), damage-only ground rings with release sparks (B), and fighter
flash/compression with impact sparks (C). All use the same C/burst gameplay.
The revisions share preparation fade-in and stronger melee/ice contrast, so
B versus C isolates the damage treatment; A versus either revision tests the
whole presentation package.

Three retained moments revisit the owner's questions: duel seed 7 at
8.3–12.6s, intersecting four-way seed 19 at 5.8–9.8s, and crowded four-way seed 1
at 0.1–3.9s. Each of the nine clips has its own controls and comment identity.
The third alternative appears below the first pair at the same viewing size.
Full context offers all three alternatives and enlargement. Custom setups have
no curated clips. Do not interpret old comments as reviews of the revision.

The retained packet is `public/experiments/spell-readability-v2/README.md`.
`feedback-findings.json` answers the ambiguous-hit and retargeting questions;
`reviews.json` and `personas/` retain independent reviewer judgments and source
identities. Raw batch/source are in `runs-experiment/spell-readability-v2-final`.
Run `npm run check:spell-comparison -- --revision --production` after a build
for the revision's browser checks. The original command still checks round one.

The next owner decision is whether either revision preserves the impact gain
with acceptable style and phase clarity. The agent should then recommend
adoption, keeping the earlier approach, or parking the direction rather than
starting another round without a concrete unresolved question.

## Five art directions

`compare.html?experiment=art-direction-v1` contains five procedural visual
packages: Porcelain Lab, Photon Chamber, Arcane Observatory, Paper Theater and
Obsidian Foundry. All construct the same burst world and retain the chosen
fighter flash / impact sparks. Arena/background, fighter finishes, spell shapes,
trails and preparation/release palettes vary. Ordinary battle defaults and older
experiments are preserved.

The three owner-relevant duel/intersection/crowd moments have five independent
cards each, with their own stable art evidence identities and durable comments.
Direction summaries discuss fit with the simulation/training-room idea and
state a provisional proposal. None is owner-approved. The
[retained packet](../public/experiments/art-direction-v1/README.md) includes
30 FPS clips, manifests, material-history investigation and inspection limits.

Run `npx tsx scripts/check-art-comparison.ts` after `npm run build` to check
controls, fifth-direction comment recovery, responsive enlargement and complete
browser/headless fights. Focus a retained capture on one direction with
`npm run capture:comparison -- --experiment art-direction-v1 --variant porcelain`
plus the usual scenario, seed, time/duration and output flags. The selected
direction is recorded in the manifest; its full panel fills the capture.

## Art direction revision

`compare.html?experiment=art-direction-v2` keeps all five candidates and starts
on the owner's reviewed scenario 2. The first round and its feedback remain at
`art-direction-v1`. Source-identified revision geometry lives separately in
`src/presentation/artDirectionRevision.ts`; old styles are unchanged.

Photon is the existing benchmark, with Observatory the thematic challenger.
The revision tests ceramic lighting/material depth, a restrained Photon cleanup,
robed Observatory fighters with the liked hats/colors, explicit folded-card
construction, and a less industrial Obsidian Atelier retaining mineral spells.
No candidate is adopted or cut. Gameplay, camera, rapid-fire timing and the
chosen fighter hit reactions are held constant.

Use `&family=photon` or `&family=observatory` for a dedicated unchanged/revised
pair. These show the actual first-round renderer, not a recreation. Revised
cards share evidence IDs and comments with their counterpart in the five-way
room; baseline observations in these pairs do not overwrite original feedback.
All new cards have fresh round-two IDs. The three content-selected moments keep
their first-round fight bounds because the gameplay and relevant events match.

After building, run `npx tsx scripts/check-art-comparison.ts --revision` for
controls, responsive enlargement, paired/main feedback linkage and complete
browser/headless fights. `scripts/inspect-art-revision.ts` captures the sampled
intersection, crowd and duel images used in the presentation review. The retained
packet and shareable MP4s live under `public/experiments/art-direction-v2/`.

## Divergent art families (round three)

`compare.html?experiment=art-direction-v3&family=photon|observatory|foundry`
selects three branches within a surviving family. Porcelain and Paper are no
longer active candidates; earlier pages, comments and clips remain available.
Add `&baselines=1` for the unchanged round-two parent and, for Photon, round one
as well. New branch comments follow the same evidence identity in either view.

This round reads the thirteen round-two workspace comments retained in
`public/experiments/art-direction-v3/owner-feedback/2026-10-19.json`. Its packet
records dispositions and training-room tradeoffs. All branches share burst
combat, camera and selected hurt reactions; room architecture never collides.

The existing comparison capture command now accepts `--family` and
`--baselines`. For example:

```
npm run capture:comparison -- --experiment art-direction-v3 --family photon --variant photon-vector --scenario four-wizards --seed 19 --time 5.8 --duration 4 --fps 30 --out runs-captures/vector
```

After building, `npx tsx scripts/check-art-explorations.ts` uses isolated feedback
storage to exercise the 27 cards, durable comments, baseline linkage,
independent controls, narrow/wide enlargement and 45 complete browser/headless
fights. `npx tsx scripts/inspect-art-explorations.ts` captures enlarged inspection
samples against the managed owner server. Neither writes test feedback into
the owner's workspace snapshots.
