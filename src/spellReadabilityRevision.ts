import { SPELL_EXPERIMENT, SPELL_BRIEFS } from './spellReadabilityExperiment';
import { variantDefinition } from './experiment';
import type { ComparisonBrief } from './comparisonEvidence';
import type { SpellReadability } from './presentation/spellCues';

export const REVISION_EXPERIMENT = {
  ...SPELL_EXPERIMENT,
  id: 'spell-readability-v2',
  title: 'Making the hit feel different from the cast',
  hypothesis: 'Can damage-only ground rings or fighter reactions preserve the stronger impact you liked while separating casting from taking damage?',
};
export const REVISION_VARIANTS = [
  { id: 'cues', name: 'Previous cues', spellReadability: true,
    description: 'The previous B, preserved as a reference: preparation rings, release rings and hit crosses.' },
  { id: 'rings', name: 'Damage rings · release sparks', spellReadability: 'rings',
    description: 'Warm airborne sparks mark release; only damage makes a ground ring. Softer preparation and stronger melee/ice contrast.' },
  { id: 'reaction', name: 'Fighter flash · impact sparks', spellReadability: 'reaction',
    description: 'The hurt fighter briefly flashes and compresses, with impact sparks instead of damage rings. Shares the revised preparation, release and spell contrast.' },
].map(v => ({ ...variantDefinition('burst'), ...v, scenarioVariant: 'burst', spellReadability: v.spellReadability as SpellReadability }));

// Reuse these moments because the owner's questions identified concrete failures
// here. New evidence identities keep the previous round's comments intact.
const cues = [
  [
    'Blue’s second fireball really hits red at 11.18s. Can you see it? Compare red’s empty swing at 9.63s with the later hits, then watch the finish.',
    'Follow the warm sparks at release, then the ring on the ground only when someone takes damage. Does the second fireball read without a cross clipping through red?',
    'Watch the hurt fighter flash and compress when damage lands. Is the second fireball and the later melee easier to feel, or does the flash weaken fighter identity?',
  ],
  [
    'The two pulses on red before green dies are releases, not hits. Yellow aimed the spread at green before green died; it catches red later. Can you separate those phases?',
    'Red’s releases use sparks; green’s damage uses ground rings. Then yellow’s spread hurts red. Does reserving rings for damage remove the ambiguity?',
    'Follow green’s hit reaction, then red’s reaction to yellow’s spread. The ice shard lands without hurting anyone. Do fighter reactions help you follow the consequences without extra rings?',
  ],
  [
    'Keep yellow’s rapid-fire rhythm in mind. Compare the abrupt dark startup rings and overlapping release and hit symbols with the revisions.',
    'Preparation fades in; yellow keeps a pulse of sparks per shot. Damage gets ground rings. Does that retain the extra impact while keeping the phases distinct in a crowd?',
    'Watch yellow’s shot rhythm and red taking green’s spread. Hits use a brief body flash and sparks. Is this more satisfying than rings, or too busy when hits overlap?',
  ],
];
const descriptions = [
  'The same duel answers your question about the second fireball: it hits. Compare the previous cues with two alternatives for showing damage. My proposal is C: let the hurt fighter carry the impact. B is the quieter alternative if preserving fighter color matters more.',
  'This exchange exposed casting rings mistaken for hits. Red is not hurt before green dies; yellow’s already-released spread then catches red. None of these visuals changes targeting or movement. Compare the consequences one clip at a time.',
  'The crowd is the contrary case. Preserve the rapid-fire rhythm you liked without making every action the same ring. The revisions share softer preparation and stronger spell contrast; B and C differ in how they show actual damage.',
];
export const REVISION_BRIEFS: ComparisonBrief[] = SPELL_BRIEFS.map((brief, i) => ({
  ...brief, id: `revision-${brief.id}`, description: descriptions[i],
  clips: REVISION_VARIANTS.map((v, j) => ({
    id: `v2-${brief.scenario}-${brief.seed}-${v.id}`, revision: 1, variant: v.id,
    start: brief.clips[0].start, end: brief.clips[0].end,
    title: `${String.fromCharCode(65+j)} · ${v.name}`, watchFor: cues[i][j],
    why: `${brief.clips[0].why} Matched gameplay and times isolate presentation. The previous round’s footage and comments remain in spell-readability-v1. These examples cannot establish readability across all seeds.`,
  })),
}));
