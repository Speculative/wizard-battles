# CLAUDE.md

This file is auto-loaded by Claude Code at session start. Read [DESIGN.md](DESIGN.md) for the architectural overview; this file is for the working rules that aren't obvious from the code.

## Headless harness

There's a node-runnable harness that runs matches without a renderer, advancing a virtual clock so simulated time decouples from wall-clock time. Use it to verify the behavioral impact of any simulator change, especially anything affecting tactics, kinematics, spell mechanics, or AI decisions.

```
npm run sim -- --runs 20 --max 1800 --seed 1 -q
```

Per-run output goes to `runs/<runId>/` as JSONL (events + frames) plus a `meta.json`. The directory is wiped on each invocation unless `--keep` is set. See [docs/HARNESS.md](docs/HARNESS.md) for flags, schema, and DuckDB query recipes.

Workflow when investigating a behavior change:
1. Identify a baseline-vs-modified seed sweep that exercises the behavior.
2. Run the harness on the baseline; rename `runs/` (e.g. `mv runs runs-baseline`) to preserve it.
3. Apply the code change. Run again. Query both directories with DuckDB.

## Telemetry — emit on significant events

The simulator emits structured telemetry to `runs/<runId>/events.jsonl` (semantic events) and `runs/<runId>/frames.jsonl` (10 Hz state snapshots). Telemetry is implemented as a singleton in `src/telemetry.ts` with a noop default; the harness injects a `JsonlSink` per match.

**When you add or modify code in the simulator, also emit telemetry for any new significant event or decision.** This is how future debugging works — agents and humans alike rely on the JSONL streams to understand what happened in a run, and changes that don't emit are invisible to that loop. Concretely:

- **Do** emit on: tactic decisions, cast attempts (accepted *and* refused), hits, deaths, dashes/blinks, interrupts, scenario milestones, anything you'd want to grep for when answering "did X happen this run?"
- **Don't** emit on: per-tick math, helper calls, internal score recomputation, anything that fires every frame regardless of state change.

The pattern:

```ts
import { emit } from "./telemetry"; // adjust relative path

emit("event_type", whoId /* or null */, { /* arbitrary fields */ });
```

The first three columns (`run`, `t`, `type`, `who`) are populated by the sink. Everything else lives in the JSON `meta` blob — query it with `meta->>'$.field'` in DuckDB.

Custom event types are fine. Don't update an enum or registry — just `emit("my-new-thing", ...)` and document the name in [docs/HARNESS.md](docs/HARNESS.md) if it's persistent or in a comment on the call site if it's scenario-specific.

## DuckDB queries

```
npm run q -- "SELECT type, COUNT(*) FROM read_json_auto('runs/m-s1-0/events.jsonl') GROUP BY 1"
```

Or pipe SQL via stdin: `cat query.sql | npm run q -- --stdin`.

The DB is ephemeral — runs are read straight from JSONL via `read_json_auto`. Nothing persists between query invocations.
