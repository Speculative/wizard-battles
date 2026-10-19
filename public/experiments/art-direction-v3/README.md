# Three families · nine divergent explorations

[Photon Chamber](/compare.html?experiment=art-direction-v3&family=photon) ·
[Arcane Observatory](/compare.html?experiment=art-direction-v3&family=observatory) ·
[Obsidian Atelier](/compare.html?experiment=art-direction-v3&family=foundry)

**Decision:** choose a promising branch within each remaining family, combine
specific strengths, retain a predecessor, or reject these explorations. Porcelain
Lab and Paper Theater are cut from this active round, as requested; their rooms,
media and comments remain in [round one](../art-direction-v1/README.md) and
[round two](../art-direction-v2/README.md). No new branch is adopted.

**My provisional proposal:** Calibration Hall, Armillary Hall and Jade Cloister
are the most direct continuations of the training-room concept. Vector Deck is
the boldest Photon departure, following the owner's wallless-stage suggestion.
Astral Terrace tests magical astronomy as a place; Constellation Archive tests it
as a scholarly practice. Geode Vault and Ember Sanctum push the liked dungeon
identity toward natural minerals and carved volcanic ritual respectively.
These are designer hypotheses, not owner preferences or a calibrated taste model.

## Nine visions

| Family / branch | Coherent vision | Training-room question |
| --- | --- | --- |
| Photon · Calibration Hall | Enclosed midnight simulator, restored cyan wall grid, translucent sphere trainees with sparse contour bands, plasma needles. | Strongest direct continuation. Are visible walls and less fighter mesh noise better than either old Photon? |
| Photon · Vector Deck | Floating square light deck, angular holographic avatars, split-rail bolts, distant stars and explicit glowing bounds. | An open simulation stage, suggested by the owner. Does spectacle compensate for losing a physical room? |
| Photon · Wave Chamber | Resonant laboratory, concentric wall waveforms, rounded capsule trainees with bright nuclei, swept wave-packet spells. | A softer scientific language for synthesized light. Does it preserve enough force and wizard character? |
| Observatory · Armillary Hall | Plum-stone instrument hall, brass orbits, shaped shoulders/faces/belts on robed scholars, colored hats, aquamarine crystal. | Develop the promising robes without changing the liked palette and magical geometry. Do they feel like scholars? |
| Observatory · Astral Terrace | Open celestial practice platform, distant moon, brass floor tracks, orbit-belted spherical trainees and amber comets. | Reinterpret rounded figures as celestial objects. Is it a satisfying magical training place, or mostly a spectacle stage? |
| Observatory · Constellation Archive | Inset constellation maps, shelves, slim book-bearing archivists, square glyphs and faceted spell cores. | Most explicitly scholarly. Does the research language stay clear at the ordinary viewing scale? |
| Atelier · Jade Cloister | Carved green stone bays, jade specimens, restrained climbing leaves, sculpted trainees and retained dense molten magic. | Protect the improved dungeon identity while making repeated practice inviting. Check green-fighter contrast. |
| Atelier · Geode Vault | Jagged violet/slate crystal cavity, cut mineral trainees, ember fragments around dense fire cores, fractured blue ice. | Natural spectacle, with the risk that environmental crystals compete with the falling shard. |
| Atelier · Ember Sanctum | Basalt bays, amber mineral seams, stepped plinths, stone-mantled trainees and glowing chest seals. | A warm ceremonial dungeon. Does it suit ordinary training without drifting back to factory imagery? |

Each family has three branches by default. “Include retained baselines” adds the
unchanged round-two parent; Photon also includes unchanged round one. The
[dedicated Photon v1/v2 view](/compare.html?experiment=art-direction-v2&family=photon)
remains available for the regression you mentioned. Old construction paths are
retained, not reconstructed. Comments on new branches share identity between
branches-only and baseline-inclusive views, with fresh evidence IDs; old comments
remain on the old pages rather than falsely marking these clips reviewed.

## Actual feedback intake

The [retained workspace snapshot](owner-feedback/2026-10-19.json) was read before
implementation. It contains 13 round-two comments saved through 05:46:04 UTC.
[Feedback disposition](feedback-disposition.json) retains each comment verbatim,
its source/evidence identity, and the action or exploration it informs.

Owner observations: Photon is still strongest, but wall lines were lost and
fighter mesh looks noisy; an open platform is worth exploring. Observatory's
palette/theme and large crystal remain liked; robes are promising but unfinished.
Atelier improved most, with the palette and wall/corner decorations producing a
dungeon-boss-room impression. Porcelain and Paper should be cut. This is distinct
from the designer's proposed branches and their provisional rankings.

## Content-selected evidence

The live room starts with scenario 2, where the owner gave these comments. Each
branch has the same three independent cards, each with seek/replay, optional loop,
enlargement, full-fight context and dedicated durable comments. Playing one
pauses the others.

| Card | Exact setup and fight range | Viewing cue | What it cannot establish |
| --- | --- | --- | --- |
| 2 · When yellow joins the exchange — default | four-wizards, seed 19, rotation 0, burst, 5.8–9.8s | Follow the large crystal landing without damage at 7.23s, then red through yellow's spread. Compare spell silhouette, fighter form, floor and wall contrast. | Not every ice landing deals damage; selected action is not representative of all seeds. |
| 1 · Two hits, a miss, then a finish | duel, seed 7, rotation 0, burst, 8.3–12.6s | Blue's fireball hits at 9.25s and 11.18s, then red's finish: projectile shape, release and the retained hurt flash. | Less clutter than a four-way fight; does not establish crowd readability. |
| 3 · Rapid fire in the crowd | four-wizards, seed 1, rotation 0, burst, 0.1–3.9s | Yellow's six-shot burst, green's spread into red and falling ice behind them. Check whether architecture and magic compete. | Deliberately stressful, not a claim about average full-match rhythm. |

Matched times are intentional because this is a presentation-only experiment.
The content retains the event/HP assertions of the earlier spell excerpts.
Gameplay, camera, arena bounds, burst movement, rapid-fire cadence and the chosen
fighter flash/impact sparks are held identical. Architecture is decorative and
never changes collision. The active style families exclude the two cut directions.

## Retention, validation and limits

The live comparison is the primary review surface: 27 independently playable
cards across nine branches, including the duel and crowded contrary cases.
[Download all nine scenario-2 MP4s](scenario-2/Wizard-Battles-Round-3-Scenario-2.zip)
for sharing. These are silent four-second clips, 30 FPS, fight time 5.8–9.8s.
The ZIP includes viewing notes and family labels; send the downloaded files to
others, since localhost links require access to the server machine.

The [media manifest](media-manifest.json) identifies each H.264 clip, exact source,
focused variant, time range, hash and frame count. Each media directory retains
`capture.json` with all 120 frame states, the Chromium identity, 1440×1050 browser
viewport and 1/60s simulation step. Visual seed is seed XOR 0x5f3759df. The
focused gameplay states match exactly at every captured frame across all nine.
Only scenario 2 is exported as MP4 in this packet; the duel and crowded opening
remain playable in the live room and have enlarged retained inspection samples.

The [source identity](source/identity.json) and [exact archive](source/source.tar.gz)
retain the bytes used by every new clip. The archive reproduces its recorded
content hash; generated media and reports do not enter that hash. Earlier clips
keep their original source labels.

[Baseline verification](baseline-verification.json) checks a retained 5.8s frame
for Photon v1, Photon v2, Observatory v2 and Atelier v2. Every battle canvas is
pixel-identical to its old sample. Observatory/Atelier panels also match as whole
PNG files; Photon has 266 differing pixels confined to the Restore button hover
styling, outside the battle canvas. This is a single-frame regression check per
baseline, not recapture of every old clip.

[Validation](validation.json) records build, 35 unit tests, the final presentation
checks, 27 browser cards, durable comment recovery/baseline linkage, responsive
views and 45 complete browser/headless fights including fresh seeds. All nine
videos decode fully and the ZIP passes integrity checking. [Inspection](inspection.json)
identifies enlarged stills actually examined from every branch in all three
setups, plus one frame from each new MP4 and real browser controls. No continuous
human video viewing or persona review is claimed; animation-feel judgments stay
provisional.

All art is procedural. No sound or external art assets are introduced. Feedback
saves to append-only `runs-feedback/` snapshots with a disk receipt; the room
locks on storage loss. Saving feedback does not start an agent dispatch. The
bounded goal ends when this round is ready for owner review; further revisions
require the next owner instruction.


## Individual scenario-2 downloads

| Photon Chamber | Arcane Observatory | Obsidian Atelier |
| --- | --- | --- |
| [Calibration Hall](scenario-2/1A-Calibration-Hall-Scenario-2.mp4) | [Armillary Hall](scenario-2/2A-Armillary-Hall-Scenario-2.mp4) | [Jade Cloister](scenario-2/3A-Jade-Cloister-Scenario-2.mp4) |
| [Vector Deck](scenario-2/1B-Vector-Deck-Scenario-2.mp4) | [Astral Terrace](scenario-2/2B-Astral-Terrace-Scenario-2.mp4) | [Geode Vault](scenario-2/3B-Geode-Vault-Scenario-2.mp4) |
| [Wave Chamber](scenario-2/1C-Wave-Chamber-Scenario-2.mp4) | [Constellation Archive](scenario-2/2C-Constellation-Archive-Scenario-2.mp4) | [Ember Sanctum](scenario-2/3C-Ember-Sanctum-Scenario-2.mp4) |
