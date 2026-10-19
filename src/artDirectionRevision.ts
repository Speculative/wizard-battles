import { ART_EXPERIMENT } from './artDirectionExperiment';
import { SPELL_BRIEFS } from './spellReadabilityExperiment';
import { ART_STYLES, ART_REVISION_STYLES, type ArtStyle } from './presentation/artDirection';
import { variantDefinition } from './experiment';
import type { ComparisonBrief } from './comparisonEvidence';

export const ART_REVISION_EXPERIMENT = { ...ART_EXPERIMENT, id:'art-direction-v2', title:'Five training-room visions · round two' };
export const ART_REVISION_CHANGES = [
  'Porcelain: directional warm/cool lighting, celadon alcoves, glazed figures and a newly edged cobalt crystal. Does the room still feel like beginner 3D?',
  'Photon: preserve translucency, high contrast and light-shaped spells. Reduce shell-wire density, simplify projectile brackets and quiet the room markings. Is this actually better than round one?',
  'Observatory: retain colored hats, brass geometry and glowing crystal edges; replace spherical bodies with robed scholars and add vaulted architecture. Does the fighter now belong in this world?',
  'Paper: keep low-poly bodies, but add card thickness, folded hats/spells, mounting tabs and theatrical lighting. Does it finally read as a made object?',
  'Obsidian Atelier: retain dense molten projectiles and mineral ice; replace factory bolts/vents/hazard stripes with carved stone bays and jade. Is it less industrial while still distinct?',
];
export function revisionStyles(family:string|null):ArtStyle[] {
  if(family==='photon'||family==='observatory') return [ART_STYLES.find(s=>s.id===family)!,ART_REVISION_STYLES.find(s=>s.family===family)!];
  return ART_REVISION_STYLES.flatMap(s => s.family === 'photon' || s.family === 'observatory' ? [ART_STYLES.find(old => old.id === s.family)!, s] : [s]);
}
export function revisionVariants(family:string|null) {
  return revisionStyles(family).map(s=>({...variantDefinition('burst'), id:s.id, name:`${s.name} · ${s.revision===2?'round 2':'round 1 unchanged'}`, scenarioVariant:'burst',spellReadability:'reaction' as const,artDirection:s.id,description:`${s.vision} Training-room fit: ${s.fit}`}));
}
const cues=[
  'Follow blue’s fireballs hitting red at 9.25s and 11.18s, then red’s finish. Compare projectile shape, preparation and the retained fighter hit flash.',
  'Start with the falling crystal at 7.23s; it lands without damage. Then follow red through yellow’s spread. Judge fighter shape, material contrast and overlapping spell silhouettes.',
  'Follow yellow’s six-shot burst and green’s spread into red; ice lands behind them. This is the crowded contrary case: judge whether the new materials and figures hold together.',
];
export function revisionBriefs(family:string|null):ComparisonBrief[] {
  const variants=revisionVariants(family);
  return SPELL_BRIEFS.map((b,i)=>({...b,id:`art-v2-${b.id}`,description: family==='photon'||family==='observatory'
    ? `A is the unchanged first-round ${family==='photon'?'Photon':'Observatory'}; B is its revision. Same gameplay and fight times. Your existing first-round comments remain on the earlier page. New comments on B also appear in the five-direction round-two view. ${cues[i]}`
    : `All five are retained. Photon is the benchmark, with Observatory the strongest thematic challenger; neither revision is automatically an improvement. Unchanged Photon and Observatory are included alongside their revisions to check regressions. ${cues[i]}`,
    clips:variants.map((v,j)=>({id:`art-v2-${b.scenario}-${b.seed}-${v.id}`,revision:1,variant:v.id,start:b.clips[0].start,end:b.clips[0].end,title:`${String.fromCharCode(65+j)} · ${v.name}`,watchFor:`${cues[i]} ${v.id.endsWith('-v2')?ART_REVISION_CHANGES[ART_REVISION_STYLES.findIndex(s=>s.id===v.id)]:'This is the retained round-one renderer, not a reconstruction.'}`,why:`${b.clips[0].why} Matched times isolate visual changes. This excerpt illustrates local material/readability differences, not whole-match pacing or a final choice.`}))}));
}
