# Spell readability: preparation, release and impact

Open [the comparison room](http://localhost:5173/compare.html?experiment=spell-readability-v1).
Play A, then B. The three preset buttons load complete comparisons. Each card
has independent playback, a time slider, replay, optional loop and comments;
Full fight opens its context enlarged. Comments save to workspace snapshots
under `runs-feedback/` and recover in a fresh browser. General notes are scoped
to their experiment; movement feedback remains in the movement room.

**Proposal:** advance B cautiously. The clearest gain is knowing that someone
actually took damage, including when nearby effects miss. This does not yet
solve who attacked whom, initiative, magical identity or experienced pacing.
Both alternatives use identical C/burst gameplay, preserving intersecting
four-way engagements. B adds preparation progress/direction, brief launch
pulses and white/dark markers only on damage. Existing magic remains intact.

| Pair | Exact setup and bounds | What to follow |
| --- | --- | --- |
| Hit, miss, finish | Duel, seed 7, rotation 0, 8.3–12.6s | Blue hits; red's first released swing misses; red later connects and finishes. |
| Intersecting fights | Four wizards, seed 19, rotation 0, 5.8–9.8s | Damage moves from green to red to yellow; falling ice misses. |
| Crowded stress case | Four wizards, seed 1, rotation 0, 0.1–3.9s | Spread, rapid fire, melee and ice compete for attention; extra markers can overlap. |

A and B deliberately show the same actions and bounds, isolating presentation.
The controls remain independent; these are content selections, not generic
opening/late slots or representative estimates across seeds.

- [Report and exact configuration](report.json): 24 C setups, six seeds,
  two scenarios, two rotations. This is one simulation trace per setup, not
  independent gameplay treatments. Full raw logs and source snapshot remain
  in `runs-experiment/spell-readability-v1-final/` in the workspace.
- [Evidence, event excerpts and file hashes](evidence.json).
- [Duel clip](media/duel7/clip.mp4) and [states/provenance](media/duel7/capture.json).
- [Intersection clip](media/four19/clip.mp4) and [states/provenance](media/four19/capture.json).
- [Crowded opening clip](media/four1/clip.mp4) and [states/provenance](media/four1/capture.json).
- [Three independent persona reports](reviews.json) and [triage](triage.json).
- [Source follow-up](source-followup.json): a generator fix corrected the
  effective-seed header. Initial reviews retain their source labels and
  [original report](initial-review/report.json). The generator-metadata and general-note scoping fixes changed no gameplay
  or spell rendering definitions; all 121 recaptured images are byte-identical, and all 24 gameplay
  event streams match excluding `match_end.meta.wallMs`.

Final source is
`sha256:3eab2014d6c60f477cec56e5c2dcd020401aee2aa4c66082121e8664fd219c60`.
Captures use fixed dt 1/60s, visual seed `seed ^ 0x5f3759df`, default effects
and trails, 10 fps, Chromium 156.0.8078.4, and viewport 1440×1050 at device
scale 1. Exact browser identity, frame times, held finishes and alternatives
are recorded in each capture manifest.

**Review limits:** the independent fighting-game, mage-fan and systems lenses
all tentatively favor B for confirming local consequences. They retain concern
about small preparation detail and crowded attribution. All use gpt-6.1-sol;
this is role diversity, not model diversity or an owner-taste model. Reviews
inspect sampled images and logs, not continuous footage. Encoded clips and
the live room are provided for judging animation, distraction and feel. Logs
lack unique cast/projectile lineage. No balance or general readability claim
follows from these selected asymmetric matchups. C's existing stalls also
remain possible because gameplay is unchanged.

Validation: 30 tests; build; development and production spell comparison
checks, including 24 complete browser/headless setups × two visual alternatives,
independent controls, durable evidence comments/recovery and enlargement.
