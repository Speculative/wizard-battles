# Five training-room visions · round two

**[Open the five revised directions](/compare.html?experiment=art-direction-v2).**
Start with scenario 2, where the owner left the first-round feedback. All five
remain in consideration. This round is ready to compare, not a final adoption.

**My proposal:** keep Photon as the benchmark; give Observatory's new robed
figures a close look as the thematic challenger. Photon round two is deliberately
restrained and may or may not beat round one. The paired views give the originals
equal standing rather than assuming every revision is an improvement.

- **[Photon: unchanged / revised](/compare.html?experiment=art-direction-v2&family=photon)**
- **[Observatory: unchanged / revised](/compare.html?experiment=art-direction-v2&family=observatory)**
- **[Round one, with the original comments](/compare.html?experiment=art-direction-v1)**

The pairs run the actual retained first-round renderer. Revised cards share their
comment identity with the corresponding card in the five-direction room. New
baseline observations in the paired views remain separate from the original
round-one feedback. The original source archives, fifteen clips, sharing ZIP and
all comments remain intact.

## What changed, and why

The [feedback disposition](feedback-disposition.json) retains all fifteen owner
comments verbatim, with their original source/evidence references, and connects
each to a revision action. They come from the recovered
[October 19 export](../art-direction-v1/owner-feedback/2026-10-19.json), not persona
judgments or inferred preferences.

| Direction | Revision in response to the owner | Training-room fit and remaining question |
| --- | --- | --- |
| A · Porcelain Lab | Warm key/cool fill, celadon ceramic alcoves and glazed fighters replace uniform material treatment. Cobalt ice gains explicit bright facet edges and a front core. | Still closest to the initial welcoming practice-room idea. The bright floor remains a demanding contrast case; judge whether it escapes the “beginner 3D” feeling. |
| B · Photon Chamber | Keep translucent light-made fighters, high contrast, the original lighting rig, room material response and distinctive needles. Reduce shell-wire opacity, simplify stacked projectile hoops to an open bracket and quiet room calibration marks. | Strongest literal simulator, with spectator aids that belong in its visual language. Is the refinement better, or did it lose some of the original's character? Use the pair. |
| C · Arcane Observatory | Keep hats, colors, crystal edge light and geometric magic. Replace spherical bodies with faceted robes, collars and sashes. Vaulted bays and restrained orreries frame the academy room. Fire becomes a faceted comet rather than a spherical flame cluster. | A scholarly magical training room. The robe silhouette is the main hypothesis: does it bring the fighters into the same world as the spells? Use the pair to check the complete package. |
| D · Paper Theater | Keep the liked low-poly bodies. Add thick card panels, bent tabs, corner gussets, folded hats and faceted card projectiles, with a warm directional key. | Explicitly a cut-and-fold teaching model. It now exposes construction, but may still feel too toy-like; judge whether that is an appealing identity. |
| E · Obsidian Atelier | Retain the dense molten projectile recipe and fractured mineral ice. Remove bolts, vents, hazard stripes and busbar rails; substitute carved stone bays, jade specimens and warmer mineral accents. | A mineral practice sanctuary rather than a factory. It gives up some industrial force to address the owner's thematic mismatch; decide whether it remains sufficiently distinct. |

These are designer interpretations and hypotheses. The owner preferred Photon
in the first batch, liked Observatory's theme, found Foundry well executed but
too industrial, and found Porcelain/Paper underdeveloped. Those observations do
not amount to adopting a candidate or rejecting the opportunity to revise it.

## Selected evidence

The selected moments remain relevant because gameplay is unchanged. All variants
use burst movement, the same kits, rapid-fire timing, targeting and damage, the
same camera and arena bounds, and the chosen fighter flash/impact sparks. Room
geometry is decorative. Art revisions do not alter the simulation RNG.

| Card | Exact configuration and fight bounds | Follow this | Limit |
| --- | --- | --- | --- |
| **2 · When yellow joins the exchange** — default | Four wizards, seed 19, original layout, burst, 5.8–9.8s | Crystal falling at 7.23s without damage; then red through yellow's spread (hits at 7.57/7.60s) and into yellow (8.52/9.30s). Compare ice against the room, fighter silhouettes and overlapping projectiles. | The empty landing is deliberately a miss, not an ice-hit example. |
| 1 · A hit, a miss, then a finish | Duel, seed 7, original layout, burst, 8.3–12.6s | Blue's fireballs hit red at 9.25/11.18s. Red misses a swing at 9.63s before the finish at 12.22s. Inspect preparation, projectile silhouette and the retained hurt reaction. | Only two fighters, no falling ice. |
| 3 · Stress test: several spells at once | Four wizards, seed 1, original layout, burst, 0.1–3.9s | Yellow's six-shot burst (0.70–1.60s), green's spread into red (0.98–1.02s) and the empty ice landing at 2.32s. | Tests overlap in a selected crowded opening, not whole-match pacing or balance. |

Each live card has independent play, scrub, replay, optional loop, a viewing cue,
a dedicated workspace-backed comment and a route to the complete fight. Playing
one pauses the others. Full fights can be enlarged. The room locks if storage
is disconnected; a submitted comment is only marked reviewed after a persisted
workspace receipt. Saving feedback retains it and does not dispatch a new agent.

## Retained 30 FPS MP4s

| Direction | Scenario 2 | Duel | Crowded opening |
| --- | --- | --- | --- |
| A · Porcelain Lab | [MP4](media/intersection-porcelain/clip.mp4) | [MP4](media/duel-porcelain/clip.mp4) | [MP4](media/crowd-porcelain/clip.mp4) |
| B · Photon Chamber | [MP4](media/intersection-photon/clip.mp4) | [MP4](media/duel-photon/clip.mp4) | [MP4](media/crowd-photon/clip.mp4) |
| C · Arcane Observatory | [MP4](media/intersection-observatory/clip.mp4) | [MP4](media/duel-observatory/clip.mp4) | [MP4](media/crowd-observatory/clip.mp4) |
| D · Paper Theater | [MP4](media/intersection-paper/clip.mp4) | [MP4](media/duel-paper/clip.mp4) | [MP4](media/crowd-paper/clip.mp4) |
| E · Obsidian Atelier | [MP4](media/intersection-foundry/clip.mp4) | [MP4](media/duel-foundry/clip.mp4) | [MP4](media/crowd-foundry/clip.mp4) |

[Download scenario 2 for sharing](scenario-2/Wizard-Battles-Round-2-Scenario-2.zip).
The ZIP includes the five revisions plus clearly named unchanged Photon and
Observatory clips. These are four-second excerpts, not full matches, with no
audio. Download and send the files; localhost links are local to the owner.

## Provenance and actual inspection

The [exact source archives](source/manifest.json) retain both captured application
content hashes and code commits. The final Photon material correction has three
fresh clips; the other twelve keep their initial source labels and archive.
Their focused gameplay states match exactly at every captured frame across all
five styles. No earlier clip has been silently relabeled as a newer source. Each media directory contains its complete
`capture.json`: exact source identity, scenario/seed/rotation, focused style,
1/60s simulation step, visual seed derivation (seed XOR 0x5f3759df), 1440×1050
browser viewport, browser identity and every frame's fight states. Only the
focused panel is visible in its MP4; other panels remain state context.

[Baseline verification](baseline-verification.json) records a byte-identical
recapture of the retained Photon and Observatory first frames at 5.8s. This is
one rendered frame per original, not a claim to have recaptured every old frame.
The old source archives and full old clips remain available in round one.

[Inspection](inspection.json) identifies retained samples actually examined from
the new captures. Design judgments use sampled stills, logged event facts and
browser controls; they do not claim continuous human viewing of the videos.
Animation feel remains for owner review. No personas were consulted this round.
No sound, postprocessing or externally authored art assets were introduced.

[Validation](validation.json) records the build, unit and browser checks. Unit
coverage tests both rounds for gameplay invariance, reconstruction and resource
disposal. Browser checks cover all 15 new cards, independent playback/scrubbing,
workspace recovery, wide/narrow enlargement, paired/main comment linkage and 25
complete browser/headless fights including fresh seeds.

This bounded round stops for owner judgment: keep, cut or revise candidates,
and specifically say whether Photon/Observatory revisions improve on their
retained originals. No cuts or adoptions have been made on the owner's behalf.
