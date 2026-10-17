# Experiment room

Run `npm run dev` and open **http://localhost:5173/compare.html**. The ordinary single-battle page remains at `/`.

The first experiment, `movement-pacing-v1`, compares baseline (A), measured commitments (B), and bursts/resets (C). These are configuration packages applied to every fighter; abilities and tactics stay the same. The hypothesis concerns anticipating pressure/commitment/escape, not maximizing activity. All three can fail. The two scenes use the existing asymmetric kits, so a red win is not a general balance result.

The seven initial expectations come from `nezw-rsmt` and `sfmb-mnnj`. E004–E007 began as agent proposals, provisionally approved in the owner's 2026-10-17 agreement. History retains that distinction. Expectation approval does not certify build satisfaction.

## Viewing and feedback

Use shared play/pause, restart, speed, single-second stepping, and seeking. Example controls load a seed, scene, and original/quarter-turn layout. All unfinished worlds advance the same number of ticks. A completed fight freezes at its final tick while others continue. Under a slow renderer, wall-time playback can slow down for every panel together; simulation time does not diverge. Enlarge a panel to inspect small actions, then restore the simultaneous view.

Start with duel seed 7 (ordinary), duel seed 1 (awkward prolonged measured variant), and four-wizards seeds 1 and 19. Include the beginning, exchanges, and resets. Use the scrubber to inspect late stages; no highlight-only loop is imposed. Seed and layout controls permit other examples, including fresh seeds.

A timestamped note saves experiment, exact source hash, scenario, seed, rotation, panel identities, shared time and each panel's actual held time. Preferences include unsure, no meaningful difference, and none works. Feedback is local to this browser/origin. **Export feedback JSON** saves an agent-readable backup for sharing; imports merge expectations by ID and preserve decision history and distinct notes. The imported record becomes current when IDs conflict; inspect its history before importing older edits over newer ones. Invalid imports are rejected without changing current feedback.

The expectation queue defaults to unreviewed and hides approved/declined/removed entries. The initial seven are already approved, so use All / history to see them. Free-text wording, targets and notes remain editable; **Save edits** records a new history entry. **Propose expectation** creates an unreviewed entry. Evidence/satisfaction is recorded in persona reports, separately from these owner decisions.

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

`window.comparison` exposes `metadata`, `seek(seconds)`, `step(ticks)`, `states()`, `play()`, `pause()` and a copied `feedback()` for automation. Query parameters `capture=1`, `scenario`, `seed`, `rotation`, and `time` make an exact paused example addressable.

## Checks and review loop

```
npm test
npm run build
npm run check:comparison
npm run check:comparison -- --production
```

The comparison browser check verifies headless agreement, resize/enlargement independence, synchronized live ticks, finished holds, feedback persistence/export/import, invalid imports, and expectation decisions. The existing `check:browser` checks the single-battle view.

For a persona round, use `docs/PERSONA_REVIEW.md`. Publish actual reviews and triage in `public/experiments/movement-pacing-v1/reviews.json` so they appear below the viewing panels. Never describe a log review or sampled stills as watching a clip, never fabricate owner preferences, and retain disagreement. A working loop is delivered before the owner chooses any approach.
