import { ART_EXPERIMENT } from './artDirectionExperiment';
import { SPELL_BRIEFS } from './spellReadabilityExperiment';
import { ART_STYLES, ART_REVISION_STYLES, type ArtStyle } from './presentation/artDirection';
import type { ArtBranch } from './presentation/artExplorations';
import type { ComparisonBrief } from './comparisonEvidence';
import { variantDefinition } from './experiment';

export const ART_EXPLORATION_EXPERIMENT = { ...ART_EXPERIMENT, id: 'art-direction-v3', title: 'Three families · nine divergent explorations' };
// Constants are kept beside the retained style definitions to avoid a runtime
// dependency from presentation onto the experiment/viewer modules.
export { ART_EXPLORATION_STYLES } from './presentation/artExplorationStyles';
import { ART_EXPLORATION_STYLES } from './presentation/artExplorationStyles';
export function explorationFamily(family: string | null) {
  return family === 'observatory' || family === 'foundry' ? family : 'photon';
}
export function explorationStyles(family: string | null, baselines = false): ArtStyle[] {
  const f = explorationFamily(family);
  const branches = ART_EXPLORATION_STYLES.filter(s => s.family === f);
  if (!baselines) return branches;
  // Photon v1 remains the explicitly requested regression reference. Other
  // families retain their v2 starting point; their older rooms stay linked.
  return [...(f === 'photon' ? [ART_STYLES.find(s => s.id === f)!] : []), ART_REVISION_STYLES.find(s => s.family === f)!, ...branches];
}
export function explorationVariants(family: string | null, baselines = false) {
  return explorationStyles(family, baselines).map(s => ({ ...variantDefinition('burst'), id: s.id,
    name: s.revision === 3 ? s.name : `${s.name} · ${s.revision === 2 ? 'round 2 unchanged' : 'round 1 unchanged'}`,
    scenarioVariant: 'burst', spellReadability: 'reaction' as const, artDirection: s.id, description: `${s.vision} Training-room fit: ${s.fit}` }));
}
export const BRANCH_QUESTIONS: Record<ArtBranch, string> = {
  calibration: 'Enclosed training simulator: restored wall grid, clean translucent spheres, sparse contour bands and familiar plasma needles. Does the room read clearly without fighter mesh noise?',
  vector: 'Wallless floating simulation deck: angular light avatars, split-rail bolts, explicit square boundary and distant stars. Does the open stage help spectacle or lose the practice-room identity?',
  wave: 'Wave laboratory: rounded light capsules, luminous nuclei and curved wave-packet projectiles. Is this a warmer form of synthesized light, or too soft beside rapid fire?',
  armillary: 'Instrument hall: shaped shoulders, visible faces and belted robes under the familiar hats; retain brass orbital magic and aquamarine crystal. Do these feel like scholars rather than cones?',
  astral: 'Astral practice terrace: colored celestial spheres with orbital belts, comet tails and a moon beyond the open platform. Does this fantasy training deck justify returning to rounded figures?',
  archive: 'Constellation archive: slim robed archivists carrying books, angular glyph projectiles and inset star maps. Does the geometric research language stay readable in the crowd?',
  cloister: 'Jade cloister: carved green stone, specimen alcoves and restrained climbing leaves, sculpted trainees and dense molten spells. Does it retain the liked dungeon-room appeal while feeling usable for practice?',
  geode: 'Geode vault: raw jagged crystal walls, cut mineral fighters and ember fragments around the retained fire core. Is this richer natural spectacle, or does the framing compete with the falling ice?',
  ember: 'Ember sanctum: carved basalt bays, amber seams and stone-mantled trainees with glowing chest seals. Does the ceremonial warmth advance the dungeon idea without returning to factory imagery?',
};
const recommendations: Record<string, string> = {
  photon: 'My provisional lead is Calibration Hall for everyday training; Vector Deck is the boldest departure, following your wallless-stage suggestion. Wave Chamber tests a softer alternative. Use “Include retained baselines” to compare Photon v1 and v2 directly.',
  observatory: 'My provisional lead is Armillary Hall: it develops the promising robes and keeps the liked palette, hats and large crystal. Astral Terrace and Constellation Archive test celestial spectacle versus scholarly ritual.',
  foundry: 'My provisional lead is Jade Cloister, protecting the improved dungeon setting. Geode Vault is the strongest environmental departure; Ember Sanctum tests warmer, ceremonial stonework while keeping the physical spells.',
};
export function explorationBriefs(family: string | null, baselines = false): ComparisonBrief[] {
  const f = explorationFamily(family), styles = explorationStyles(f, baselines), variants = explorationVariants(f, baselines);
  const cues = [
    'Follow blue’s fireballs hitting red at 9.25s and 11.18s, then red’s finish. Watch the projectile silhouette, release and retained fighter hit flash.',
    'Follow the large ice crystal landing without damage at 7.23s, then red moving through yellow’s spread. Compare the fighter and projectile against both floor and walls.',
    'Follow yellow’s six-shot burst and green’s spread into red, with falling ice behind them. This crowded exchange tests whether the room, fighters and overlapping magic belong together.',
  ];
  return SPELL_BRIEFS.map((b, i) => ({ ...b, id: `art-v3-${f}-${b.id}`, description: `${recommendations[f]} ${cues[i]}`,
    clips: variants.map((v, j) => ({ id: `art-v3-${b.scenario}-${b.seed}-${v.id}`, revision: 1, variant: v.id,
      start: b.clips[0].start, end: b.clips[0].end, title: `${String.fromCharCode(65 + j)} · ${v.name}`,
      watchFor: `${cues[i]} ${styles[j].branch ? BRANCH_QUESTIONS[styles[j].branch!] : 'Unchanged retained renderer, provided as a regression reference.'}`,
      why: `${b.clips[0].why} Same burst gameplay, camera and hit reactions isolate art direction. Matched moments intentionally revisit your actual feedback. The duel and crowded exchange are contrary cases; these excerpts do not establish whole-match pacing or production readiness.` })) }));
}
