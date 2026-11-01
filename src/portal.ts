import { experimentGroups, type ExperimentMetadata } from './experimentMetadata';

// Vite discovers new metadata modules in dev and at build time.
const modules = import.meta.glob<{ default: ExperimentMetadata }>('./experiments/*.ts', { eager: true });
const groups = experimentGroups(Object.values(modules).map(module => module.default));
function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

const library = document.querySelector<HTMLDivElement>('#experiments')!;
for (const group of groups) {
  const section = document.createElement('section');
  section.innerHTML = `<h2>${escapeHtml(group.title)}</h2><p class="section-intro">${escapeHtml(group.description)}</p><div class="rounds">${group.rounds.map(round => `
    <article><p class="status">${escapeHtml(round.status)}</p><h3><a href="${escapeHtml(round.href)}">${escapeHtml(round.title)}</a></h3><p>${escapeHtml(round.description)}</p><p class="round-id">${escapeHtml(round.id)}</p><a class="open" href="${escapeHtml(round.href)}">Open comparison →<span class="sr-only"> ${escapeHtml(round.title)}</span></a></article>
  `).join('')}</div>`;
  library.append(section);
}
