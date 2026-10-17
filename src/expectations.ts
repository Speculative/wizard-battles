export type Decision = 'unreviewed' | 'approved' | 'declined' | 'removed';
export interface Expectation {
  id: string;
  text: string;
  target: string;
  notes: string;
  decision: Decision;
  provenance: string;
  history: { at: string; decision: Decision; text: string; target: string; notes: string }[];
}
const texts = [
  'Battles are visually interesting and enjoyable to watch.',
  'Pacing may ebb and flow to build and release tension; quiet duration alone is not a defect.',
  'Art is generated programmatically, without requiring externally authored art assets.',
  'I can anticipate a consequential exchange and understand why its outcome occurred.',
  'I can recognize who has the initiative and feel pressure, escape, and momentum changes.',
  'Fighters have visible identities or habits that let me form expectations and pick favorites.',
  'Surprises develop from established abilities or habits, making an earlier exchange newly meaningful.',
];
export function initialExpectations(): Expectation[] {
  return texts.map((text, i) => ({
    id: `WB-E${String(i + 1).padStart(3, '0')}`, text, target: '', notes: '', decision: 'approved',
    provenance: i < 3 ? 'Explicit owner statements on sfmb-mnnj, 2026-10-17.' : 'Agent proposal on nezw-rsmt, provisionally approved by owner 2026-10-17T20:31:05Z. Priority unresolved.',
    history: [
      ...(i >= 3 ? [{ at: '2026-10-17T19:05:04Z', decision: 'unreviewed' as const, text, target: '', notes: '' }] : []),
      { at: '2026-10-17T20:31:05Z', decision: 'approved', text, target: '', notes: '' },
    ],
  }));
}
