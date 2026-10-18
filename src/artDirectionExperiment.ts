import { SPELL_EXPERIMENT, SPELL_BRIEFS } from './spellReadabilityExperiment';
import { variantDefinition } from './experiment';
import { ART_STYLES } from './presentation/artDirection';
import type { SpellReadability } from './presentation/spellCues';
import type { ComparisonBrief } from './comparisonEvidence';

export const ART_EXPERIMENT = {
  ...SPELL_EXPERIMENT, id: 'art-direction-v1', title: 'Five visions for a magic training room',
  hypothesis: 'Choose a coherent visual world: welcoming ceramic lab, holographic simulator, academy observatory, paper teaching model or industrial proving chamber.',
};
export const ART_VARIANTS = ART_STYLES.map(style => ({
  ...variantDefinition('burst'), id: style.id, name: style.name,
  scenarioVariant: 'burst', spellReadability: 'reaction' as SpellReadability, artDirection: style.id,
  description: `${style.vision} Training-room fit: ${style.fit}`,
}));
const cues = [
  'Follow blue’s two fireballs into red, then red’s empty swing and eventual finish. Judge the flame silhouette and separation of release sparks from the hurt fighter’s flash.',
  'Follow the falling ice at 7.23s, then red moving through yellow’s spread. Ice lands without damage: its material should feel magical without pretending that every landing is a hit.',
  'Follow yellow’s six-shot burst and green’s spread into red. Keep an eye on the falling ice behind them. This crowd tests whether the visual world stays coherent when magic overlaps.',
];
const descriptions = [
  'Start here: five treatments of the same duel, one clip at a time. My provisional proposal is A / Porcelain Lab for a welcoming, physical training room; B / Photon Chamber is the more literal simulation. C, D and E push scholarly fantasy, a teaching diorama and destructive testing. You can also reject all five. Hit flashes/sparks are retained in all five; accepting those did not approve the old projectile style.',
  'Same intersecting four-way fight in every direction. The empty ice landing is the important contrary case: judge the shard against the room as well as fire in flight. The arena is decorative; movement, targeting and collisions are identical.',
  'Stress test the initial impression. This is rapid fire, spread shots, melee and falling ice together, with no slower casting or extra hit pauses. Decide which vision you would want to spend time in, and whether its magic survives the crowd.',
];
export const ART_BRIEFS: ComparisonBrief[] = SPELL_BRIEFS.map((brief, i) => ({
  ...brief, id: `art-${brief.id}`, description: descriptions[i],
  clips: ART_VARIANTS.map((v, j) => ({
    id: `art-v1-${brief.scenario}-${brief.seed}-${v.id}`, revision: 1, variant: v.id,
    start: brief.clips[0].start, end: brief.clips[0].end,
    title: `${String.fromCharCode(65+j)} · ${v.name}`,
    watchFor: `${cues[i]} ${ART_STYLES[j].vision}`,
    why: `${brief.clips[0].why} These moments revisit the owner’s concrete fire/ice and crowded-readability concerns. Matched times are intentional because gameplay is identical. This is selected evidence, not a claim about every seed or a completed production art pass.`,
  })),
}));
