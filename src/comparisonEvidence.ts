/** Designer-selected evidence, scoped to exact setups. Update with the fights,
 * rather than assigning generic opening/late windows to every experiment. */
export interface EvidenceClip {
  /** Keep id stable; bump revision when the depicted evidence changes. */
  id: string;
  revision: number;
  variant: string;
  start: number;
  end: number;
  title: string;
  watchFor: string;
  why: string;
}
export interface ComparisonBrief {
  id: string;
  title: string;
  scenario: string;
  seed: number;
  description: string;
  clips: EvidenceClip[];
}
export const COMPARISON_BRIEFS: ComparisonBrief[] = [
  {
    id: 'ordinary-duel', title: '1 · Pursuit or reset?', scenario: 'duel', seed: 7,
    description: 'My read: C gives the duel more room to breathe. Compare A’s uninterrupted finish with C’s break and return. Watch one excerpt, then the other; they show different moments in the same starting matchup.',
    clips: [
      { id: 'duel7-baseline-finish', revision: 1, variant: 'baseline', start: 2.5, end: 6.4, title: 'A · Red stays on blue',
        watchFor: 'Follow red once it reaches blue. Repeated close-range hits drain blue’s health until the fight ends.',
        why: 'Covers the first exchange through the finish: blue hits at 2.80s, then red lands five melee hits and wins at 6.37s.' },
      { id: 'duel7-burst-reset', revision: 1, variant: 'burst', start: 6, end: 12.3, title: 'C · A break before the finish',
        watchFor: 'Watch the distance open after the initial melee sequence, then red return to contact. Does this reset make the next exchange more satisfying?',
        why: 'Blue survives the opening at 34 HP, lands fireballs at 9.25s and 11.18s, then red finishes at 12.22s. The interruption is why this later window was chosen.' },
    ],
  },
  {
    id: 'stalled-duel', title: '2 · When movement stalls', scenario: 'duel', seed: 1,
    description: 'My read: B shows the failure to avoid—motion without changing stakes. Compare its repeated movement with C returning to contact and ending the duel. These excerpts deliberately use different fight times.',
    clips: [
      { id: 'duel1-measured-stall', revision: 1, variant: 'measured', start: 40, end: 46, title: 'B · Moving, but getting nowhere',
        watchFor: 'Track the circling and shots, then check health: red stays at 30 HP and blue at 90 HP throughout. Is there a believable threat, or just repetition?',
        why: 'Selected inside the damage-free stretch after the last hit at 16.98s. The same health remains at the 120s timeout; six seconds illustrate the pattern, while the full fight establishes its duration.' },
      { id: 'duel1-burst-finish', revision: 1, variant: 'burst', start: 8, end: 12, title: 'C · Contact changes the outcome',
        watchFor: 'Follow red closing back in on blue. Blue lands shots, but red gets into melee range and finishes. Compare that change of stakes with B’s loop.',
        why: 'Blue hits red at 9.28s and 10.95s; red hits blue at 11.00s and wins at 11.87s. This is the payoff after separation, rather than the same clock position as B.' },
    ],
  },
  {
    id: 'four-way', title: '3 · Who gets drawn into the fight?', scenario: 'four-wizards', seed: 19,
    description: 'You liked C when separate fights intersected. Here is a concrete contrast: follow which opponent red engages after green falls, and whether yellow becomes involved. This is evidence for that preference, not proof that A never has interactions.',
    clips: [
      { id: 'four19-baseline-pursuit', revision: 1, variant: 'baseline', start: 8.5, end: 12.5, title: 'A · Red turns to blue',
        watchFor: 'Follow red’s pursuit of blue. Blue takes repeated melee hits; red remains untouched during this excerpt.',
        why: 'After green falls at 7.42s, red lands four melee hits on blue between 10.00s and 12.30s. Chosen to show the next matchup.' },
      { id: 'four19-burst-intersection', revision: 1, variant: 'burst', start: 6.5, end: 10.5, title: 'C · Yellow enters red’s exchange',
        watchFor: 'Green falls, yellow’s spread hits red, then red engages yellow while blue is still alive. Does the change of opponent make this feel more connected?',
        why: 'Green falls at 6.98s, yellow hits red at 7.57s and 7.60s, then red hits yellow at 8.52s, 9.30s and 10.08s.' },
    ],
  },
];

export function comparisonBrief(scenario: string, seed: number, rotation: number) {
  return rotation === 0 ? COMPARISON_BRIEFS.find(b => b.scenario === scenario && b.seed === seed) : undefined;
}
