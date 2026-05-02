# Headless harness & telemetry

The headless harness runs the simulator without a renderer, advancing a virtual clock so a 30-minute simulated match takes ~1 second of wall-clock. Each match emits structured telemetry as JSONL files; DuckDB queries them in place.

## Quick start

```
# run one match, 60 sim-seconds, deterministic
npm run sim -- --runs 1 --max 60 --seed 1 -q

# run a 20-match sweep, up to 30 sim-minutes each
npm run sim -- --runs 20 --max 1800 --seed 1 -q

# query an event count
npm run q -- "SELECT type, COUNT(*) FROM read_json_auto('runs/m-s1-0/events.jsonl') GROUP BY 1"
```

`runs/` is wiped at the start of each `npm run sim` invocation unless `--keep` is set. To preserve a baseline for comparison against a code change, rename the directory: `mv runs runs-baseline`.

## Harness flags

| flag | default | meaning |
|---|---|---|
| `--runs N` | 1 | number of matches |
| `--dt SECONDS` | 1/60 | simulator step size; smaller = higher fidelity, slower |
| `--max SECONDS` | 120 | sim-time cap before a match is force-ended as `timeout` |
| `--sample-hz N` | 10 | per-contestant frame sample rate; `0` disables frames entirely |
| `--seed N` | (random) | RNG seed; runs `0..N-1` use `seed+0..seed+N-1` |
| `--run-id PREFIX` | (auto) | output dir name; for multi-run, `PREFIX-0`, `PREFIX-1`, ... |
| `--runs-dir PATH` | runs | parent directory for run outputs |
| `--keep` | false | keep prior contents of `runs-dir` instead of wiping |
| `--quiet` / `-q` | false | suppress per-tick console.log noise from the simulator |

Default `runId` is `m-s<seed>-<index>` when seeded, or `m-t<timestamp>-<index>` otherwise.

## Output layout

```
runs/
  m-s1-0/
    meta.json        run config + result summary
    events.jsonl     one record per significant event
    frames.jsonl     periodic per-contestant state snapshot
```

### meta.json

Captured at match start, finalized at match end. Includes seed, dt, max-seconds, sample-hz, contestants list, ISO timestamps for `startedAt`/`endedAt`, and the result (`reason`, `winner`, `alive`, `simulatedSeconds`).

### events.jsonl

Each line is a JSON object. Common columns: `run`, `t` (sim seconds), `type`, `who` (contestant id or `null`). Everything else lives in a `meta` object so the schema doesn't have to grow with new event types.

| `type` | `who` | `meta` fields |
|---|---|---|
| `match_start` | null | `runId, seed, dt, sampleHz, contestants[]` |
| `match_end` | null | `reason, winner, alive[], simulatedSeconds, wallMs` |
| `tactic_switch` | wizard | `from, to, score` |
| `tactic_phase` | wizard | `tactic, from, to` (e.g. AntiMageZone approach→cast→rush) |
| `interrupt` | wizard | `reason, currentTactic` |
| `cast_request` | wizard | `factory, targetId, accepted` plus either `distToTarget` (if accepted) or `reason` (`cooldown`, `state:sprinting`, `dead`) |
| `cast_release` | wizard | `factory, targetId` |
| `damage` | attacker | `victim, amount, spell, hpAfter` |
| `death` | victim | `killer, spell` |
| `dash` | wizard | `dirX, dirZ` |

`cast_request` is verbose — when a tactic wants to cast but is blocked (cooldown, sprinting, etc.), one event is emitted per tick. Filter with `WHERE accepted = true` for "actually cast" or `WHERE meta->>'$.reason' = 'cooldown'` for cooldown-blocked attempts.

### frames.jsonl

One record per (sampled tick × living contestant). Columns are flat for direct DuckDB querying:

| column | type | meaning |
|---|---|---|
| `run` | string | `runId` |
| `t` | double | sim seconds |
| `who` | string | contestant id |
| `x`, `z` | double | position |
| `vx`, `vz` | double | velocity |
| `fx`, `fz` | double | facing unit vector |
| `state` | string | movement state (`idle`/`walking`/`running`/`sprinting`/`dashing`/`charging`/`recovering`) |
| `tactic` | string | current tactic id |
| `hp` | double | 0..100 |
| `stamina` | double | 0..1 |
| `nearest` | string \| null | id of nearest living enemy |
| `surfDist` | double \| null | surface distance to `nearest` |

Dead contestants stop emitting frames after their `death` event.

## Querying with DuckDB

The wrapper script `scripts/duckq.ts` runs SQL against an in-memory DuckDB instance with `@duckdb/node-api`. Files are read on demand via `read_json_auto`; nothing persists between query invocations.

```
# inline SQL
npm run q -- "SELECT * FROM read_json_auto('runs/m-s1-0/frames.jsonl') LIMIT 5"

# from a file
npm run q -- --file query.sql

# from stdin
echo "SELECT 1" | npm run q -- --stdin

# JSON output for further processing
npm run q -- --json "SELECT type, COUNT(*) AS n FROM read_json_auto('runs/m-s1-0/events.jsonl') GROUP BY 1"

# aggregate across all runs in a sweep
npm run q -- "SELECT runId, simulatedSeconds, reason FROM read_json_auto('runs/*/meta.json', union_by_name=true)"
```

## Recipes

### Outcome distribution across a sweep

```sql
SELECT reason, COUNT(*) AS n
FROM read_json_auto('runs/*/meta.json', union_by_name=true)
GROUP BY 1;
```

### Match durations: who's getting stuck

```sql
SELECT runId, simulatedSeconds, alive
FROM read_json_auto('runs/*/meta.json', union_by_name=true)
ORDER BY simulatedSeconds DESC
LIMIT 10;
```

### Melee hit rate

```sql
WITH casts AS (
  SELECT meta->>'$.factory' AS factory, meta->>'$.accepted' AS accepted
  FROM read_json_auto('runs/m-s1-0/events.jsonl')
  WHERE type = 'cast_request' AND meta->>'$.factory' = 'melee' AND meta->>'$.accepted' = 'true'
),
hits AS (
  SELECT *
  FROM read_json_auto('runs/m-s1-0/events.jsonl')
  WHERE type = 'damage' AND meta->>'$.spell' = 'melee'
)
SELECT
  (SELECT COUNT(*) FROM casts)  AS attempts,
  (SELECT COUNT(*) FROM hits)   AS hits;
```

### Surface distance during red's CloseQuarters tactic windows

```sql
WITH switches AS (
  SELECT t,
         meta->>'$.from' AS from_t,
         meta->>'$.to'   AS to_t
  FROM read_json_auto('runs/m-s1-0/events.jsonl')
  WHERE type = 'tactic_switch' AND who = 'red'
),
windows AS (
  SELECT t AS t_in,
         LEAD(t) OVER (ORDER BY t) AS t_out
  FROM switches
  WHERE to_t = 'closequarters'
)
SELECT f.t, f.surfDist
FROM read_json_auto('runs/m-s1-0/frames.jsonl') f
JOIN windows w ON f.t >= w.t_in AND (w.t_out IS NULL OR f.t < w.t_out)
WHERE f.who = 'red'
ORDER BY f.t;
```

### Detect head-shake (rapid facing oscillation)

```sql
WITH dframe AS (
  SELECT
    who, t, fx, fz,
    LAG(fx) OVER (PARTITION BY who ORDER BY t) AS pfx,
    LAG(fz) OVER (PARTITION BY who ORDER BY t) AS pfz,
    state
  FROM read_json_auto('runs/m-s1-0/frames.jsonl')
)
SELECT who, t, state, ACOS(GREATEST(LEAST(fx*pfx + fz*pfz, 1), -1)) AS turn_radians
FROM dframe
WHERE pfx IS NOT NULL AND state = 'sprinting'
  AND ACOS(GREATEST(LEAST(fx*pfx + fz*pfz, 1), -1)) > 0.6
ORDER BY t;
```

### Damage summary per match

```sql
SELECT who AS attacker,
       meta->>'$.victim' AS victim,
       meta->>'$.spell'  AS spell,
       SUM((meta->>'$.amount')::DOUBLE) AS total_damage
FROM read_json_auto('runs/m-s1-0/events.jsonl')
WHERE type = 'damage'
GROUP BY 1, 2, 3
ORDER BY total_damage DESC;
```

## Emitting custom events

Any code path with access to `src/telemetry.ts` can emit. For scenario-specific milestones — "red is in melee state for the third time this match," "two zones overlap," whatever — just call `emit`:

```ts
import { emit } from "../telemetry";

emit("scenario_milestone", self.id, {
  marker: "third-melee-entry",
  surfDist: distanceToTarget,
});
```

The `type` field is a free-form string; pick a name that's easy to grep. No registration needed.

## Adding a new event type to the simulator

When you make a behavioral change that introduces a new significant event or decision (a new tactic phase, a new spell impact mode, a new interrupt class), add an `emit(...)` call at the same site. Document the new type by adding a row to the events table above if it's something other agents/users will want to query for.

Don't pre-emit "just in case" — emission has cost (file IO, JSON serialization), and sparse, well-named events are easier to use than dense, noisy ones.

## Determinism notes

- `--seed N` seeds `Math.random` at match start. The clock is virtual and starts at 0. With both fixed, two runs with the same seed produce byte-identical JSONL except for the wall-clock `wallMs` field in `match_end` and the ISO timestamps in `meta.json`.
- The harness wipes `runs/` at the start of every invocation. To preserve a baseline, rename it (`mv runs runs-baseline-fix1+2`) before re-running with code changes.
- Ad-hoc analysis can join across multiple run directories: `read_json_auto('runs-*/m-s1-0/events.jsonl', union_by_name=true)`.
