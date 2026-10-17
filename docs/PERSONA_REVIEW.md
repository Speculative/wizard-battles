# Persona review loop (v1)

The owner wants recognizable fighters creating surprising, understandable exchanges. The comparison viewer elicits human preference; persona critics identify problems and competing interpretations. They do not certify customer demand or override owner decisions.

Use three independent lenses:

- **Fighting-game spectator:** track neutral, commitment, pressure, escapes and reversal. Point to what made a threat anticipatable and its consequence understandable (WB-E004/E005).
- **Mage-fight fan:** follow recognizable magic, buildup, payoff, fighter identity and surprises that grow from established abilities (WB-E001/E002/E006/E007).
- **Systems-curious spectator:** investigate cause/effect and whether the evidence supports the experiment's claims. Distinguish actual tactical changes from changed outcomes or longer duration (WB-E004/E006/E007).

## Round procedure

1. Run/preserve a batch and captures from the same source/configuration. Use ordinary and awkward duels plus a four-way example. Keep complete fight context available; don't pick only highlights.
2. Give independent reviewers the hypothesis and expectation catalog, but no instruction to prefer a variant. Use A/B/C labels for initial viewing. Reveal definitions for interpretation. Stable labels are convenient but do not establish order-invariant preference; use another ordering for later preference-stability checks.
3. Each reviewer lists evidence actually inspected (exact frames/times, logs, browser actions), source IDs, model, observed facts, interpretations, expectation IDs, ranked concerns, preference and uncertainty. A sampled frame sequence is not continuous video viewing. Logs cannot establish visual beauty or tension. Mark unsupported dimensions inconclusive.
4. Collect independent reports without editing away dissent. Triage findings as accepted, rejected or deferred with reasons. Fix concrete tooling/reproduction defects promptly. Keep speculative combat changes as future experiments, rather than silently changing the current baseline until critics like it.
5. Run a targeted follow-up after the fix, including an independent reviewer and fresh seeds where relevant. Preserve the original reports and mark superseded evidence explicitly. Stop after this bounded fix/review round unless new concrete blockers prevent a usable comparison.
6. Publish `reviews.json` with the retained reports, triage and evidence limits beneath the viewer. Ask the human to watch before reading judgments. Record their actual feedback separately. No owner preference or calibration pass exists until they provide it.

The initial invocation uses available agent tools directly; no external inference API or credentials are required. The root agent can invoke the three review roles with self-contained tasks and distinct output files, then reconcile them. A manual agent invocation using the same packet is equally valid.

## Reusable reviewer prompt

> Review experiment [ID/source] as [persona]. First inspect anonymized matched ordinary and awkward examples, including buildup and resets. List exactly what you inspected. Provide timestamped observations tied to scenario/seed/panel/expectation ID. Separate facts from interpretations; identify repeated patterns, missing evidence and contrary examples. Give a tentative preference or none/unsure, with ranked concerns. Balance claims need matchup evidence. Do not infer taste from damage count or purchase intent from a persona. Do not claim to watch a clip if you only inspected stills or logs. Save a traceable report; send reproducible tooling defects to the root for triage. Do not change owner expectations or game code.

## Evidence integrity

The first round exposed an actual browser/headless disagreement for measured duel seed1. Tiny numerical differences changed which side a centered projectile dodge selected. That made two different outcomes appear to be the same experiment example. The fix gives centered shots a deterministic side tie; complete-match browser checks cover screening and fresh seeds. Preserve both pre-fix and post-fix source IDs and reports; never combine pre-fix batch numbers with post-fix viewing claims. This is a useful result of the review loop, independently of which movement profile the owner prefers.

Current telemetry still lacks unique cast/projectile IDs, so near misses and dodges cannot be attributed to individual attacks confidently. These reports are preliminary spectator criticism, not a complete causal analysis or a calibrated owner-taste model.
