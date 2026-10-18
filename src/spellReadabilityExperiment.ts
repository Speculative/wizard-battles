import { EXPERIMENT as MOVEMENT, variantDefinition } from './experiment';
import type { ComparisonBrief } from './comparisonEvidence';

export const SPELL_EXPERIMENT = {
  ...MOVEMENT,
  id: 'spell-readability-v1',
  title: 'Preparation, release and impact',
  hypothesis: 'Can preparation direction, a release pulse and a confirmed-hit marker make the same exchanges easier to follow without hiding intersecting fights?',
};

// Both alternatives deliberately use the identical C/burst simulation package.
export const SPELL_VARIANTS = [
  { ...variantDefinition('burst'), id: 'current', name: 'Current spell visuals',
    description: 'Existing charge rings, spell telegraphs, trails and impact particles. C movement.',
    scenarioVariant: 'burst', spellReadability: false },
  { ...variantDefinition('burst'), id: 'cues', name: 'Preparation → release → hit',
    description: 'Adds a filling charge ring, short aim pointer, release pulse and white marker only on actual damage. C movement; identical gameplay.',
    scenarioVariant: 'burst', spellReadability: true },
];

// Populated only after inspecting the rendered fights and their event logs.
export const SPELL_BRIEFS: ComparisonBrief[] = [];
