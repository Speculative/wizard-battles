// Keep every published comparison round discoverable, including retained history.
const groups = [
  { title: 'Art direction', description: 'Finding a visual world for the training room.', rounds: [
    { id: 'art-direction-v3', title: 'Three families, nine explorations', status: 'Latest art round', description: 'Explore branches of Photon Chamber, Arcane Observatory and Obsidian Atelier alongside retained baselines. No branch is adopted.' },
    { id: 'art-direction-v2', title: 'Five training-room visions · round two', status: 'Earlier round', description: 'Revisions alongside the original rooms, including the Photon regression comparison.' },
    { id: 'art-direction-v1', title: 'Five visions for a magic training room', status: 'Earlier round', description: 'The original Porcelain, Photon, Observatory, Paper and Foundry directions.' },
  ] },
  { title: 'Spell readability', description: 'Making preparation, release and damage easier to distinguish.', rounds: [
    { id: 'spell-readability-v2', title: 'Making the hit feel different from the cast', status: 'Hit-feedback direction chosen', description: 'Compare previous cues, damage rings and fighter flashes with impact sparks. Fighter flashes and sparks were chosen for future experiments.' },
    { id: 'spell-readability-v1', title: 'Preparation, release and impact', status: 'Earlier round', description: 'Compare the original spell visuals with distinct cues for casting and contact.' },
  ] },
  { title: 'Movement and pacing', description: 'Exploring pressure, commitment and escape.', rounds: [
    { id: 'movement-pacing-v1', title: 'Pressure, commitment, escape', status: 'Recorded preference: bursts and resets', description: 'Baseline movement, measured commitments, and bursts and resets across duels and four-way fights.' },
  ] },
];

const library = document.querySelector<HTMLDivElement>('#experiments')!;
for (const group of groups) {
  const section = document.createElement('section');
  section.innerHTML = `<h2>${group.title}</h2><p class="section-intro">${group.description}</p><div class="rounds">${group.rounds.map(round => `
    <article><p class="status">${round.status}</p><h3><a href="./compare.html?experiment=${round.id}">${round.title}</a></h3><p>${round.description}</p><p class="round-id">${round.id}</p><a class="open" href="./compare.html?experiment=${round.id}">Open comparison →<span class="sr-only"> ${round.title}</span></a></article>
  `).join('')}</div>`;
  library.append(section);
}
