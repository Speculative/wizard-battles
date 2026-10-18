import type { EvidenceClip } from './comparisonEvidence';
import type { EvidenceReference, Note } from './feedback';

export function evidenceReference(briefId: string, clip: EvidenceClip): EvidenceReference {
  return { id: clip.id, revision: clip.revision, briefId, variant: clip.variant, start: clip.start, end: clip.end };
}
export function evidenceKey(reference: EvidenceReference): string {
  return JSON.stringify(reference);
}
export function notesForEvidence(notes: Note[], scope: { experiment: string; scenario: string; seed: number; rotation: number }, evidence: EvidenceReference): Note[] {
  // A general comparison note is not proof that the owner opined on each clip.
  // UI-only source changes retain responses; changed content gets a new revision.
  return notes.filter(n => n.experiment === scope.experiment && n.scenario === scope.scenario && n.seed === scope.seed && n.rotation === scope.rotation && n.evidence && n.text.trim() &&
    n.evidence.id === evidence.id && n.evidence.revision === evidence.revision && n.evidence.briefId === evidence.briefId && n.evidence.variant === evidence.variant && n.evidence.start === evidence.start && n.evidence.end === evidence.end);
}
