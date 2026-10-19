# Five visions for a magic training room

Open **[the live comparison](/compare.html?experiment=art-direction-v1)**.
All five are playable procedural prototypes, not concept paintings. The ordinary
battle page and earlier experiments keep their existing presentation.

**Proposal:** start with A / Porcelain Lab for a welcoming, physical training
room. B / Photon Chamber is the strongest literal simulator. Choose a promising
vision, combine specific strengths, or reject all five. This is a bounded art
comparison; no direction has owner acceptance and none is promoted to defaults.

| Direction | Particular vision | Fit with simulation / training | Tradeoff to judge |
| --- | --- | --- | --- |
| A · Porcelain Lab | Ivory ceramic chamber, enamel trainees, saturated tangerine flames and cobalt glass; quiet calibration markings | A welcoming physical practice and research room | Fire needs a saturated silhouette on the light floor; less mysterious than the darker options |
| B · Photon Chamber | Midnight projection room, translucent wire shells, cyan rails, plasma needles and scanning contours | The clearest literal simulator; magic becomes synthesized light | Precise, but more technological and less warm or traditionally magical |
| C · Arcane Observatory | Plum stone, brass celestial instruments, amber orbital comets and aquamarine crystals | A scholarly magical laboratory for learning and measurement | The ritual / astronomical language can compete with fast, improvised combat |
| D · Paper Theater | Sage card walls, ruled cream floor, folded figures, layered coral cutout flames and fluttering paper trails | A tactile educational model of a training room | Playful and approachable; intentionally gives up dangerous luminous energy |
| E · Obsidian Foundry | Graphite plates with bolts, copper rails, safety marks, faceted molten fire and fractured blue minerals | A destructive-test chamber for powerful spells | Physical and weighty, but more hostile and less inviting for everyday practice |

These are designer assessments, not persona votes or inferred owner preferences.
The room, fighter finish, spell silhouette, trail, preparation palette and release
palette are treated as a coherent package. Camera, collision arena, movement,
targeting, kits, damage, cast times, rapid-fire timing and simulation RNG are held
identical. Every direction uses burst gameplay and the owner-chosen fighter
flash/compression plus impact sparks. That technique's acceptance did not imply
acceptance of the old C fireball or ice styling.

## Evidence selected from the fights

Every direction has these three independently controlled cards. Matched times are
intentional: identical fight content isolates the art change. These reuse moments
that raised the owner's fire/ice and clutter concerns. They are illustrative,
not a representative seed sample or a balance study.

| Match | Exact range | Viewing cue and factual basis | Limit |
| --- | --- | --- | --- |
| Duel · seed 7 · original layout | 8.3–12.6s | Follow blue's fireballs hitting red at 9.25s and 11.18s, red's empty swing at 9.63s, then red's finish at 12.22s. Compare projectile silhouette, release and hurt flash. | No falling ice; only two fighters |
| Four wizards · seed 19 · original layout | 5.8–9.8s | Green falls at 6.98s. Its ice lands without damage at 7.23s, yellow hits red at 7.57/7.60s, and red reaches yellow at 8.52/9.30s. Judge the falling shard against the room and the transition between opponents. | A deliberately empty ice landing, not evidence that ice never hits |
| Four wizards · seed 1 · original layout | 0.1–3.9s | Green emits five ice bolts at 0.75s and hits red three times at 0.98–1.02s; yellow's six-shot rapid-fire burst runs 0.70–1.60s. Ice lands at 2.32s without damage. | This crowded opening can reveal clutter; it cannot establish whole-match pacing |

Use **Full fight** on any card for its complete context, with enlargement. Every
card has play/pause, scrub, replay, optional loop, exact time bounds and its own
comment history. Playing another card pauses the previous one. All five remain
at the same viewing scale; E is below the first two rows.

Retained 30 FPS captures (each directory includes clip.mp4, provenance and
selected inspected frames):

| Direction | Duel | Intersecting four-way | Crowd |
| --- | --- | --- | --- |
| Porcelain Lab | [clip](media/duel-porcelain/clip.mp4) | [clip](media/intersection-porcelain/clip.mp4) | [clip](media/crowd-porcelain/clip.mp4) |
| Photon Chamber | [clip](media/duel-photon/clip.mp4) | [clip](media/intersection-photon/clip.mp4) | [clip](media/crowd-photon/clip.mp4) |
| Arcane Observatory | [clip](media/duel-observatory/clip.mp4) | [clip](media/intersection-observatory/clip.mp4) | [clip](media/crowd-observatory/clip.mp4) |
| Paper Theater | [clip](media/duel-paper/clip.mp4) | [clip](media/intersection-paper/clip.mp4) | [clip](media/crowd-paper/clip.mp4) |
| Obsidian Foundry | [clip](media/duel-foundry/clip.mp4) | [clip](media/intersection-foundry/clip.mp4) | [clip](media/crowd-foundry/clip.mp4) |

Scenario 2 is also available as a [sharing ZIP](scenario-2/Wizard-Battles-Scenario-2-All-5.zip)
with five clearly named MP4s, viewing notes and a source/hash manifest. These are
the same 5.8–9.8s excerpts above, copied without re-encoding.

The capture manifests retain exact source, scene, seed, rotation, focused visual
direction, 1/60s simulation step, visual seed derivation (seed XOR 0x5f3759df),
browser and viewport. Nonfocused panels are retained as state context in the raw
manifests; only the focused direction is visible in each encoded clip.

## Investigating the older spell appearance

[Controlled material reconstruction](diagnostics/historical-materials.png), with
[reproduction script](diagnostics/material-study.mjs).

Source inspection compares before the separation refactor (`6f70b0b^`), the
refactor (`6f70b0b`) and round-2 C (`1175edf`):

- Fire colors were retained, including dark red outer layers. Before the
  refactor, translucent layers used additive blending and the opaque core wrote
  depth. The new shared `glow()` helper uses normal alpha blending, double-sided
  faces and no depth writing. Sphere tessellation also became coarser. In the
  controlled reconstruction the old recipe produces a bright halo; the new
  recipe visibly darkens into nested red disks. The fire was not given a new
  outline in round two. This is a concrete rendering regression independent of
  the owner's choice of hit flashes.
- Old falling ice used a 0.4-opacity additive body, bright wire edges, a portal
  glow disc and dedicated fragments. The refactor replaced it with a 0.7-opacity
  normally blended body and omitted the bright edges and portal disc. Round two
  added dark blue edges and a ground backing. The reconstruction shows the
  distinct material/edge treatments. It does not reproduce old portal animation,
  particles, light setup or a complete historical fight.
- The candidates test five broader visions rather than assuming that restoring
  additive blending alone is a sufficient art direction. The old rendering is a
  useful reference, not a newly accepted package.

The reconstruction uses fixed specimen sizes for a material comparison, not
fight-scale evidence. It is intentionally kept separate from source-identified
live captures.

## Validation and handoff

- Unit checks cover simulation invariance, visual reconstruction and resource
  disposal for all five directions. Existing content assertions verify the
  hit/miss and crowd facts above.
- Production browser checks cover 15 clip identities, exclusive playback,
  independent fifth-panel seeking/replay, dedicated comment save/recovery,
  wide/narrow enlargement and 25 complete browser/headless fights (five setups
  × five directions, including fresh seeds).
- Existing movement-room UI checks preserve playback, comments, save failure /
  retry, goals and resizing after the shared viewer changes.
- Design inspection uses sampled rendered frames, event assertions and actual
  browser controls. It is not continuous human viewing of the encoded clips;
  judgments about animation feel and experienced pacing remain provisional.
  There are no persona reviews for this round. No extra camera tracking,
  postprocessing, textures or sound have been added.

Feedback saves append-only workspace snapshots under `runs-feedback/`, with
stable art evidence identities and revision 1. Older comparisons and comments
remain accessible from the live page. Saving a comment retains it; it does not
trigger another agent dispatch. The next step is the owner's visual preference
(or rejection), not an automatic cycle of tuning every candidate.

Reproduction example:

```sh
npm run capture:comparison -- --experiment art-direction-v1 --variant porcelain \
  --scenario duel --seed 7 --time 8.3 --duration 4.3 --fps 30 --out runs-captures/art-duel
npx tsx scripts/check-art-comparison.ts
```

Build before running the production browser check. Generated media and this
packet are excluded from the application source content hash.

The exact captured and final-viewer source snapshots are in
[`source/manifest.json`](source/manifest.json). The captured source is
`sha256:2d538a3a44e6bba3d14d08ef28b42ac7b22583fb5ab33e2b605144f495258141`
(commit `b40b952`). A later navigation-only fix, `1ba35d0`, changes no rendering,
gameplay or captions. [`source-followup.json`](source-followup.json) records a
byte-identical recapture of one matching frame from each of all 15 clips. The
other frames were not recaptured. Both source archives reproduce their recorded
application content hashes.

[`inspection.json`](inspection.json) maps the 30 actually inspected frame
samples and 15 validated videos to their manifests. Contact sheets are retained
under `diagnostics/*-inspected.png`. All numbered raw PNGs remain in ignored
`runs-captures/art-direction-v1/`; the public packet keeps inspected samples,
poster/end frames, encoded clips and complete frame-state manifests.
[`validation.json`](validation.json) records the final checks, including the
successful isolated rerun of the prior spell-revision check after a timed
assertion failed under concurrent capture load. This is not an unresolved
application failure.
