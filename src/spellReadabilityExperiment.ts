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

/** Matched moments are intentional: identical actions isolate presentation.
 * Each card still owns its playback and can be inspected independently. */
export const SPELL_BRIEFS: ComparisonBrief[] = [
  {
    id: 'spell-duel-hit-miss', title: '1 · A hit, a miss, then a finish', scenario: 'duel', seed: 7,
    description: 'My proposal: keep developing B’s cues. They distinguish preparing, releasing and actually hurting someone, though they are small at this camera scale. Start with A, then B. These are the same actions and fight times so the visual change is the only difference.',
    clips: [
      { id: 'spell-duel7-current', revision: 1, variant: 'current', start: 8.3, end: 12.6,
        title: 'A · Current: read the shot and health bars',
        watchFor: 'Follow blue’s fireball into red, then red’s first swing. The swing misses; later red connects and finishes. Can you tell which actions actually hurt someone?',
        why: 'Blue hits at 9.25s and 11.18s. Red releases melee at 9.63s without damage, then hits at 11.43s and 12.22s. Selected to include preparation, a genuine miss and a payoff.' },
      { id: 'spell-duel7-cues', revision: 1, variant: 'cues', start: 8.3, end: 12.6,
        title: 'B · Cues: release does not mean hit',
        watchFor: 'Watch the filling ring and short aim pointer before blue fires. A brief ring marks release; the white cross marks damage. Red’s missed swing gets a release pulse but no hit cross. Then watch the finish.',
        why: 'Exactly the same exchange as A. Hit crosses follow damage events, including melee; the 9.63s swing gets no hit marker. This tests action versus consequence without changing the fight.' },
    ],
  },
  {
    id: 'spell-intersection', title: '2 · When yellow joins the exchange', scenario: 'four-wizards', seed: 19,
    description: 'Preserve the intersecting fights you liked in C. My read is that B makes the victims easier to spot, but it still asks you to trace the projectile to know who fired it. Compare one clip at a time; neither version changes this engagement.',
    clips: [
      { id: 'spell-four19-current', revision: 1, variant: 'current', start: 5.8, end: 9.8,
        title: 'A · Current: red changes opponents',
        watchFor: 'Follow red finishing green, taking yellow’s spread shots, then reaching yellow. Blue is still firing. Notice the ice shard falling into empty space as well as the hits.',
        why: 'Green falls at 6.98s; yellow hits red at 7.57s and 7.60s; red hits yellow at 8.52s and 9.30s. Green’s ice shard impacts at 7.23s without damage. Hits and misses coexist in one intersecting exchange.' },
      { id: 'spell-four19-cues', revision: 1, variant: 'cues', start: 5.8, end: 9.8,
        title: 'B · Cues: follow where damage lands',
        watchFor: 'Look for the hit crosses moving from green to red to yellow. The empty ice-shard impact has particles but no hit cross. Do the added rings help you follow the exchange, or compete with it?',
        why: 'Same actions and times as A. The victim markers separate actual damage from nearby explosions, while overlapping release rings expose the extra-clutter risk. They do not identify the attacker by themselves.' },
    ],
  },
  {
    id: 'spell-crowded-opening', title: '3 · Stress test: several spells at once', scenario: 'four-wizards', seed: 1,
    description: 'This is the contrary case, not another highlight: extra cues can become visual noise. B leaves existing magic intact and adds compact markers, but simultaneous shots can pile up. I would advance the direction cautiously rather than call readability solved.',
    clips: [
      { id: 'spell-four1-current', revision: 1, variant: 'current', start: 0.1, end: 3.9,
        title: 'A · Current: spread, rapid fire and falling ice',
        watchFor: 'Green’s spread hits red while yellow launches a string of fireballs. Red closes on green; an ice shard lands behind the exchange. Choose one fighter to follow rather than trying to read everything.',
        why: 'Green releases five ice bolts at 0.75s and hits red three times at 0.98–1.02s. Yellow emits six rapid-fire shots at 0.70–1.60s. Ice lands at 2.32s without damage; red lands melee at 1.37s, 2.17s and 2.97s.' },
      { id: 'spell-four1-cues', revision: 1, variant: 'cues', start: 0.1, end: 3.9,
        title: 'B · Cues: clearer phases or too many rings?',
        watchFor: 'Follow green’s preparation into the spread, then the hit markers on red. Yellow’s rapid-fire launch pulses overlap nearby. Decide whether that helps distinguish phases or draws attention away from the fighters.',
        why: 'Same crowded opening as A. Several hit markers and launch pulses can coexist; this tests the cost of added information. The falling ice still uses its existing full-area warning and gets no false hit marker.' },
    ],
  },
];
