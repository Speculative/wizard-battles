/** One discoverable src/experiments/<id>.ts module per comparison room. */
export interface ExperimentMetadata {
  id: string;
  title: string;
  description: string;
  status: string;
  group: { title: string; description: string; order: number };
  /** Higher rounds appear first within their topic. */
  round: number;
  /** Relative to the portal. May point to a dedicated viewer. */
  href: string;
}

export function experimentGroups(experiments: readonly ExperimentMetadata[]) {
  const ids = new Set<string>();
  const groups = new Map<string, { title: string; description: string; order: number; rounds: ExperimentMetadata[] }>();
  for (const experiment of experiments) {
    for (const value of [experiment.id, experiment.title, experiment.description, experiment.status, experiment.group?.title, experiment.group?.description, experiment.href]) {
      if (typeof value !== 'string' || !value.trim()) throw new Error('Experiment metadata requires nonempty text fields');
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(experiment.id) || ids.has(experiment.id)) throw new Error(`Invalid or duplicate experiment ID: ${experiment.id}`);
    if (!Number.isInteger(experiment.round) || experiment.round < 1 || !Number.isFinite(experiment.group.order)) throw new Error(`Invalid experiment ordering: ${experiment.id}`);
    if (!experiment.href.startsWith('./') || experiment.href.includes('\\')) throw new Error(`Experiment link must be relative: ${experiment.id}`);
    ids.add(experiment.id);
    let group = groups.get(experiment.group.title);
    if (!group) {
      group = { ...experiment.group, rounds: [] };
      groups.set(group.title, group);
    }
    if (group.description !== experiment.group.description || group.order !== experiment.group.order) throw new Error(`Inconsistent experiment group: ${group.title}`);
    group.rounds.push(experiment);
  }
  return [...groups.values()].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)).map(group => ({ ...group,
    rounds: group.rounds.sort((a, b) => b.round - a.round || a.id.localeCompare(b.id)),
  }));
}
