# Making the hit feel different from the cast

[Open round 2](http://localhost:5173/compare.html?experiment=spell-readability-v2)
· [Previous round and comments](http://localhost:5173/compare.html?experiment=spell-readability-v1)

The proposal is **C · Fighter flash / impact sparks** for more direct local hit
confirmation. B is the quieter alternative if preserving fighter color matters
more. This is a recommendation to compare, not an adopted default.

| Alternative | What changes | Main tradeoff |
| --- | --- | --- |
| A · Previous cues | The previous round's B, preserved as reference | Casting and damage both use rings; the upright hit cross can be occluded |
| B · Damage rings / release sparks | Only damage produces a ground ring; releases use warm airborne sparks | Preserves fighter colors, but small rings compete with the floor grid |
| C · Fighter flash / impact sparks | Actual damage briefly lights and compresses the victim, with sparks; no damage ring | Makes the victim more obvious, but briefly washes out fighter identity |

B and C share fading preparation rings, release sparks, darker ice and a
stronger melee sweep. Their comparison isolates how damage is shown. Comparing
A with either revision tests the combined package. All three run identical
C/burst gameplay. Ordinary battles and round one retain their presentation.

## Outcome after owner feedback — 18 October 2026

The owner chose **C’s fighter flash / impact sparks** as the most legible hit
feedback and less noisy than damage rings, including the crowded opening.
The duel flash may still be a little too busy. This establishes a preferred
hit-feedback technique, not acceptance of the whole visual package: the owner
also found the post-engine-refactor appearance of fireballs and ice shards
“dirty and unappealing.” The owner explicitly clarified that this appearance
criticism applies to those spell visuals, not damage flashes. The separately approved
goal is beautiful, coherent, intentional art direction.

**Disposition:** close the ring-versus-flash comparison and carry C-style hit
reactions forward. Scope suggested follow-up `09n7-p3qk` first to the
post-engine-refactor appearance of fireballs and ice shards. A whole-scene art
redesign was an agent proposal, not the scope of the owner complaint. Do not
start a third local cue-polish round. The follow-up, linked to this experiment
and the overhaul plan, awaits the owner’s decision to start. Ordinary battle defaults
have not changed. The recommendation above and persona reports retain their
original pre-feedback context.

[Exact owner comments and disposition](outcome.json) retain the feedback snapshot,
acceptance scope, outstanding concerns and factual follow-up. Source inspection
confirms revised ice has dark edge lines; fireballs use layered colored spheres
and trails rather than that ice-outline treatment. This does not invalidate the
owner’s projectile-appearance concern or establish its cause. Compare with
pre-refactor rendering before attributing the change. No new gameplay or visual
changes were made;
the existing validation remains the evidence for the compared build.

## Watch one clip at a time

| Preset | Exact setup | What to follow |
| --- | --- | --- |
| A hit, a miss, then a finish | Duel, seed 7, rotation 0, 8.3–12.6s | Blue's second fireball really hits red at 11.18s. Compare that hit with red's missed swing at 9.63s and later melee hits. |
| When yellow joins the exchange | Four wizards, seed 19, rotation 0, 5.8–9.8s | Red's early rings were releases, not damage. Green falls, red pursues yellow, and yellow's already-fired spread catches red. |
| Several spells at once | Four wizards, seed 1, rotation 0, 0.1–3.9s | Keep yellow's rapid-fire rhythm while following red taking green's spread. Does the new treatment help or overwhelm? |

Each preset contains A, B and C, independently playable, seekable, replayable and
optionally looped. C appears below the first pair at the same size. Playing one
pauses the others. Each clip has its own durable comment form. Full fights and
enlargement are optional context. Matching moments are intentional: the owner's
questions identified these failures and gameplay is identical.

## What the feedback established

The owner found previous B more readable and impactful, liked rapid-fire pulses,
and saw promise in hit rings, while questioning style and confusing casting with
being hit. This is not blanket acceptance. All seven spell comments remain
in the previous room. [Feedback findings](feedback-findings.json) retain the
snapshot identity, exact event answers and limits.

Blue deals 10 fireball damage to red at 11.183333s. Red takes no damage just before
green dies: the 6.15s and 6.95s cues are red's melee releases. Green dies at
6.983333s; red's next sampled frame shows pursuit under duelist with yellow as
nearest living enemy. Yellow fired its spread at green at 6.883333s, before the
kill, and it catches red at 7.566667s and 7.6s. Target pursuit is gameplay context,
not something these effects now claim to communicate.

## Evidence and limits

[Batch report](report.json) contains seven seeds (1, 7, 19, 42, 101, 211, 307), two
scenes and two rotations: 28 starting setups, simulated once each with C/burst.
They are not 84 independent gameplay treatments. All 24 setups shared with the
first round have identical complete event streams, excluding measured runtime.
Existing four-way seed 101 stalls remain possible; this revision does not change
combat decisions.

- [Duel captures and provenance](media/duel7/capture.json), [clip](media/duel7/clip.mp4).
- [Intersection captures and provenance](media/four19/capture.json), [clip](media/four19/clip.mp4).
- [Crowded captures and provenance](media/four1/capture.json), [clip](media/four1/clip.mp4).
- [Independent persona judgments](reviews.json), [triage](triage.json).
- [Validation and presentation self-review](validation.json).

Final source: `sha256:33d49827dade184e43953362b60bf729b1123c9b9492b504b242a6e7d2d351ad`.
Raw source/events/frames: `runs-experiment/spell-readability-v2-final/`.
All captures use dt 1/60, Chromium with SwiftShader, viewport 1440×1050 and visual
seed `seed XOR 0x5f3759df`; exact browser identity/options are in capture metadata.

Reviewers inspected named stills and logs, not continuous footage. Their views
on animation feel, rhythm and distraction remain inconclusive. The initial
review source differs only in designer recommendation prose; all 121 final
recaptured images are byte-identical and all 28 event streams match. Original
review source labels remain intact with a separate final verification.

Selected clips illustrate the decision; they do not prove general readability,
magical identity or balance. Damage cues identify the victim but do not trace
each incoming shot to its attacker. Warm generic sparks add little elemental
specificity. The flash's color loss and the ring's subtlety are tradeoffs for
owner playback judgment, not reasons to loop until reviewers unanimously approve.

## After your feedback

Saving comments retains them; it does not itself launch an agent dispatch.
The next work is to summarize the feedback and recommend adopting one approach,
keeping the previous cues, or parking this direction. Close this line when the
hit-versus-cast question is answered and the remaining style tradeoff is acceptable.
Another round needs a concrete material question; it is not automatic polishing.
