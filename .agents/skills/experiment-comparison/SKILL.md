---
name: experiment-comparison
description: Prepare, evaluate, or present Wizard Battles experiments as designer-led comparisons. Use when choosing alternatives, selecting spectator evidence, conducting persona reviews, publishing results, or asking the owner to compare battles. Applies to new experiments and revisions, not only comparison-dashboard changes.
---

# Experiment comparison

The owner is the director; the agent prepares the design proposal and its evidence.
Make the difference easy to assess without requiring the owner to discover the
setup, find interesting moments, follow simultaneous fights, or repair the review
process. Apply this workflow proactively on every relevant experiment.

## 1. State the decision and carry forward feedback

Read the active item, relevant prior viewing notes and approved expectations.
Workspace feedback is under `runs-feedback/` at the repository root; use the
[experiment tooling guide](../../../docs/EXPERIMENTS.md) for its format and tools. Consult linked experiment items for narrower history.

State the creative question, meaningful alternatives, and your provisional
recommendation in plain language. Explain the property being changed and what
might improve or get worse. Preserve genuine disagreement and the possibility
that none works. Owner feedback is evidence of their preference on viewed
examples; persona opinions are separate. An approved expectation means the owner
cares about a property, not that a build satisfies it.

Do not ask the owner to restate established preferences or approve routine
preparation. Continue authorized experimentation through a reviewable result.

## 2. Find evidence in the fights

Generate or reuse reproducible fights relevant to the question. Inspect what
actually happened before choosing excerpts. Event/state logs locate candidate
moments and check factual claims; rendered evidence supports visual claims.

Choose a few short excerpts that demonstrate the proposed contrast. Include the
buildup, response, reset or payoff needed to understand it. Their locations and
lengths come from the fight content, not fixed “opening,” “short” or “late”
slots. Corresponding alternatives may need entirely different fight times.

For each excerpt retain:

- Exact scenario, seed, layout, variant, source identity and time bounds.
- Who/what to follow and the concrete behavior to notice.
- Why this moment supports the comparison, with relevant event/state evidence.
- What it cannot establish and a direct route to the complete fight.

Check awkward or contrary cases relevant to your recommendation. Explain that
selected excerpts illustrate an argument rather than represent every seed.
A six-second damage-free clip does not prove a whole-match stall; verify the
longer claim separately. Quiet can build tension. Duration, event counts,
brightness, contrast and persona scores are not objectives for “fun.”

Changing source can invalidate old selections and captions. Reinspect affected
content; preserve earlier source labels instead of silently relabeling evidence.

## 3. Prepare the owner-facing comparison

Use the existing viewer and capture tools; see the [tooling guide](../../../docs/EXPERIMENTS.md). Current
editorial selections live in [comparisonEvidence.ts](../../../src/comparisonEvidence.ts),
separately from playback.
Reuse these facilities before inventing another dashboard or evaluation system.

Default to a small, labeled comparison, usually two excerpts per design question.
Give the owner a concrete interpretation and a clear cue for each clip. Use
ordinary language: name actors, actions and consequences. Put technical detail
and full reviewer reports behind the concise explanation.

Make each clip independently playable, seekable and replayable. Start all
excerpts playing with looping enabled; an explicit pause or scrub stops only
that card and disables its automatic restart on setup changes for the current
page visit. Playing another card must leave it alone. Keep each fight time
visible. Enlarged cards need previous/next controls and the documented keyboard
shortcuts. Include retained baselines on the same page as new candidates,
not behind a branches-only/baselines toggle. Independent clocks and enlargement
let the owner focus without requiring synchronized viewing. Full fights provide
optional context, including a way to focus on one alternative. Shared-time playback can remain an inspection tool.

Recommended setups are complete one-click presets with visible active identity.
Avoid seed-entry instructions, unapplied inputs and a separate “Load example”
step. Custom setups need no generic evidence excerpts when none were curated.

Names, explanations and the designer's recommendation are visible by default.
Do not turn the owner's review into an unlabeled unbiased-ranking exercise.
A separately scoped blind test may answer a specific research question; it does
not replace the prepared comparison requested here.

Retain viewing feedback outside browser-only storage. Show actual save success
or failure, and preserve the chosen evidence, focused alternative, individual
panel times and source identity. Keep older feedback readable. For owner
handoffs, use the detached server
controller (`npm run dev:server -- start|status|restart|stop`) documented in the
tooling guide, not a dispatch-owned foreground server. A running battle in an
already-open tab does not establish server availability. Require workspace
persistence acknowledgement for submitted comments; lock the room when storage
is unreachable. Before visual revisions, verify agent-readable feedback intake
from actual snapshots or an exported file and summarize it. Resolve missing
intake before changing candidates. Attach comments to the selected evidence in the
interface, show which pieces the owner has commented on, and show progress across
comparisons. Use stable evidence IDs with explicit revisions; changed footage or
bounds must not inherit a reviewed label accidentally. Keep general notes separate
unless the owner explicitly targets a piece of evidence. Keep editable goals in a
separate view so they do not crowd the viewing task. Export/import is
useful backup, not a substitute for the normal durable save path.

## 4. Self-review before spending owner attention

Open the actual presentation and try the path the owner will use. Resolve routine
presentation defects within the authorized work instead of sending the owner a
list of seeds and asking them to find the comparison. Verify:

- The first screen states the choice and makes the next viewing action obvious.
- Each cue corresponds to visible content, with enough context to understand it.
- Switching, pausing, scrubbing and replaying clips do not move another clip.
- Full-fight context is accessible, and labels/time ranges remain unambiguous.
- Rendered geometry stays proportional when switching panel counts, enlarging,
  restoring or revealing paused clips; inspect the drawing as well as controls.
- A note saves durably and recovers with its evidence context intact.
- Captions, logs, reports and rendered evidence identify the correct source.

Use checks appropriate to changed inputs. Current browser checks and selected
content assertions are described in the [tooling guide](../../../docs/EXPERIMENTS.md); do not rerun successful
checks against unchanged inputs just to reorient. Do not repeat whole batches or
persona rounds for a wording-only edit. Keep selection data separate from player
code so changing the argument does not require another interface overhaul.

Be exact about what you inspected: sampled frames, logs, browser controls, or
continuous footage. Stills and logs alone cannot establish experienced pacing
or animation quality. Mark unsupported judgments provisional. If a defect cannot
be resolved, explain its concrete effect on the decision; do not claim readiness
for a comparison it prevents. No owner acceptance gate is added by this skill.

## 5. Retain the outcome and continue the loop

When persona review is part of the experiment, follow the [persona procedure](../../../docs/PERSONA_REVIEW.md).
Keep independent opinions and uncertainty in traceable reports; summarize what
they noticed, where, and what it means for the choice. Show the persona name
alongside each visible judgment headline so the owner can identify the reviewing
perspective without opening the raw report. Do not rewrite their
judgments to match the designer or owner. Do not loop until a desired rating.

Deliver a short packet on the active item:

> **Decision:** What we are choosing and the proposed direction.
> **Evidence:** Direct comparison entry point; each alternative's exact moment,
> what to watch, and why it was chosen.
> **Limits:** Contrary cases, scope of the claim and actual inspection method.
> **Readiness:** Relevant checks, feedback destination and any real limitations.
> **Next:** The specific preference/decision needed, or the next authorized step.

Record actual owner feedback separately from agent interpretation. Carry its
implications into the next experiment, preserving what worked while testing the
next hypothesis. Update this skill when the owner corrects the comparison
process; put experiment-specific tastes, seeds and results on their items.
Keep presentation work proportional: prepare enough to make the decision easy,
then return to the creative experiment instead of polishing the dashboard.


## 6. Make feedback lead to a decision

Explain the actual handoff when presenting a round: saving comments retains
feedback; do not imply that it starts an agent dispatch unless that trigger
exists. State what work is already authorized, what starts the next work, and
whether the item awaits owner judgment or agent execution.

After owner feedback, give a concise disposition on the active item:

- What the owner found better, worse or unclear, separately from interpretation.
- Which observations warrant fixes, factual investigation or a design choice.
- Whether to revise, adopt, revert or park the direction, and why.
- For another round, its bounded question and the evidence that would resolve it.

Within existing authorization, incorporate actionable feedback and complete
routine fixes without asking the owner to repeat it or approve each step. A new
round is warranted when it can resolve a material uncertainty or test a concrete
improvement. Do not turn every comment into another experiment or interpret
positive feedback as blanket acceptance.

Set a stopping condition for the line of work. Recommend closure when the
original question has a useful answer, material defects have been addressed,
and remaining tradeoffs are explicit for owner judgment. Closure can mean
adopting an improvement, retaining the baseline, or parking an unpromising
approach. Perfect visuals, unanimous personas and exhausting every idea are not
requirements. When another round has low expected value compared with the next
project priority, say so and recommend moving on.

At closure, record the chosen behavior, actual owner acceptance or unresolved
decision, validation and remaining limitations on the item. Do not claim owner
acceptance from persona opinions. Reconcile the outcome and next priority on
the linked plan when authorized; retain narrower follow-ups on linked items
rather than leaving the whole experiment implicitly open. Respect the item
workflow for creating or suggesting follow-ups.
