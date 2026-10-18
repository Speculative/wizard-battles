# Experiment room

Run `npm run dev` and open **http://localhost:5173/compare.html**. The ordinary single-battle page remains at `/`.

The first experiment, `movement-pacing-v1`, compares baseline (A), measured commitments (B), and bursts/resets (C). These are configuration packages applied to every fighter; abilities and tactics stay the same. The hypothesis concerns anticipating pressure/commitment/escape, not maximizing activity. All three can fail. The two scenes use the existing asymmetric kits, so a red win is not a general balance result.

The seven initial expectations come from `nezw-rsmt` and `sfmb-mnnj`. E004–E007 began as agent proposals, provisionally approved in the owner's 2026-10-17 agreement. History retains that distinction. Expectation approval does not certify build satisfaction.

## Viewing and feedback

Use shared play/pause, restart, speed, single-second stepping, and seeking. Recommended match buttons apply a complete setup immediately; the active match and selected button stay visible. Custom seed, scene and layout controls are under a disclosure and apply on change. All unfinished worlds advance the same number of ticks. A completed fight freezes at its final tick while others continue. Under a slow renderer, wall-time playback can slow down for every panel together; simulation time does not diverge. Enlarge a panel to inspect small actions, then restore the simultaneous view.

The three recommended presets are duel seed 7, stalled duel seed 1, and four-wizards seed 19. Each offers a full fight and a short interaction (2–6 seconds for duel 7, 8–14 seconds for the others). Duel 1 also offers a late 84–90 second window. Selecting a window starts playback; short windows loop unless unchecked. Restart returns to the selected window’s start. Preset changes reset to a paused full fight. The initial page is paused so the setup is readable before playback.

A timestamped note saves experiment, exact source hash, scenario, seed, rotation, panel identities, shared time and each panel's actual held time. Preferences include unsure, no meaningful difference, and none works. With `npm run dev` or `npm run preview`, feedback automatically saves append-only JSON snapshots to **`runs-feedback/` in the workspace**, through `/api/feedback`. Each contains `savedAt` and the full `feedback` object. The status beside the notes shows the saved file or an explicit failure. Existing notes in this browser migrate automatically when the updated viewer opens at the same origin. A fresh browser loads merged workspace feedback. Concurrent browsers retain both sets of notes and expectation histories; the newest history entry determines current wording/decision. An open page loads other browsers’ saves on reload. Files are ignored by Git, survive server restarts, and remain agent-readable; archive them separately when moving workspaces. `WIZARD_FEEDBACK_DIR` can override the storage directory (used for isolated checks).

Browser localStorage remains a backup. **Export feedback JSON** makes another agent-readable copy; imports merge histories and distinct notes without replacing newer edits with older ones. Static-only hosting has no workspace API and explicitly reports that saves are browser-only; it needs a backend to provide durable saves. Invalid imports are rejected without changing current feedback.

**What you want from battles** shows all goals by default, with counts for approved goals and proposals needing review. The initial seven are already approved; no repeat approval is needed. These decisions describe what the owner cares about, not whether the current build satisfies it. Use viewing notes for a reaction to a particular fight, and this list for qualities to preserve or improve across experiments.

Edit wording, optional free-text targets and notes, then **Save edits**. **Propose expectation** adds an entry needing review. **Approve** keeps a proposal as a goal; **Decline** rejects it; **Remove** retires a goal; **Reopen** returns it for review. Filters include every decision state. An empty review filter says no decisions are pending and offers **View all goals**, rather than implying there are no expectations. History remains available. Evidence/satisfaction is recorded in persona reports separately from these owner decisions.

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

`window.comparison` exposes `metadata`, `seek(seconds)`, `step(ticks)`, `states()`, `play()`, `pause()`, `loadExample({seed, scenario, rotation})`, `ready()` (workspace feedback loaded) and a copied `feedback()` for automation. Query parameters `capture=1`, `scenario`, `seed`, `rotation`, and `time` make an exact paused example addressable.

## Checks and review loop

```
npm test
npm run build
npm run check:comparison
npm run check:comparison -- --production
# UI/storage changes only, skipping unchanged full-match checks:
npm run check:comparison -- --ui-only
```

The comparison browser check verifies preset changes, short-window boundaries/loop/restart, fresh-browser workspace recovery, save failure/retry, headless agreement (unless `--ui-only`), resize/enlargement independence, synchronized live ticks, finished holds, feedback persistence/export/import, invalid imports, and expectation decisions. The existing `check:browser` checks the single-battle view.

For a persona round, use `docs/PERSONA_REVIEW.md`. Publish actual reviews and triage in `public/experiments/movement-pacing-v1/reviews.json` so they appear below the viewing panels. Give each review a `displaySummary: {title, text}` in plain language: what the reviewer noticed, where, and what it means for the choice. Keep source/evidence detail in the original report; summaries restate that review and do not imply a new evaluation. Never describe a log review or sampled stills as watching a clip, never fabricate owner preferences, and retain disagreement. A working loop is delivered before the owner chooses any approach.

## Delivered pilot evidence

The committed report contains 48 screening matches; `public/experiments/movement-pacing-v1/validation.json` adds 24 fresh-seed matches. Current media in that directory shares source `sha256:c818e1626474c535cf8c552ee5a650ae70f70eda3c9a4b65857abc9d6a45f55f`:

- [Duel seed1 clip](../public/experiments/movement-pacing-v1/media/duel-s1/clip.mp4), with [frame-state manifest](../public/experiments/movement-pacing-v1/media/duel-s1/capture.json).
- [Four-way seed19 clip](../public/experiments/movement-pacing-v1/media/four-s19/clip.mp4), with [manifest](../public/experiments/movement-pacing-v1/media/four-s19/capture.json).
- [Measured duel seed1 at 90s](../public/experiments/movement-pacing-v1/media/duel-s1-late/frame-00000.png), showing continuing projectile activity without HP progress.
- [Three persona assessments](../public/experiments/movement-pacing-v1/reviews.json) and [triage](../public/experiments/movement-pacing-v1/triage.json), also displayed under the comparison page's evidence disclosure.

Initial review excerpts and the full spectacle review preserve pre-fix source labels; corrected follow-up evidence is clearly distinguished. The systems report retains initial independent reviewer messages plus an explicitly root-authored verification follow-up. `media/reviewed-frames/manifest.json` maps retained inspected images to original workspace paths and hashes. The reviews inspected sampled stills and logs; they did not continuously watch the encoded clips. Clips are provided for human viewing.

The next useful hypothesis is stronger spell commitment/payoff communication, including framing at comparison scale. Measured movement is not adopted: it offers some clearer spacing but can create prolonged non-progress. Fresh validation also finds baseline/burst stalls, so no profile is a general solution. The owner’s first exported viewing note (2026-10-18) strongly prefers C/burst, especially in duels and for intersecting fights in the four-way scene, and dislikes B/measured’s strafing duels. This is owner feedback on the viewed examples, rather than a general calibration of the persona judges.
