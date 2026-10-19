import * as THREE from 'three';
import { revisedArena, revisedFigure, revisedProjectile, revisedShard } from './artDirectionRevision';
import { explorationArena, explorationFigure, explorationProjectile, explorationShard, type ArtBranch } from './artExplorations';
import { ART_EXPLORATION_STYLES } from './artExplorationStyles';
import { ARENA } from '../config';
import { ring, glow } from './primitives';

export type ArtFamily = 'porcelain' | 'photon' | 'observatory' | 'paper' | 'foundry';
export type ArtDirection = ArtFamily | `${ArtFamily}-v2` | `photon-${'calibration' | 'vector' | 'wave'}` | `observatory-${'armillary' | 'astral' | 'archive'}` | `foundry-${'cloister' | 'geode' | 'ember'}`;
export interface ArtStyle {
  id: ArtDirection; family?: ArtFamily; revision?: 2 | 3; branch?: ArtBranch; name: string; vision: string; fit: string;
  background: number; floor: number; wall: number; line: number; accent: number;
  fire: number; fireCore: number; ice: number; iceCore: number;
  fighters: number[]; roughness: number; metalness: number;
}
export const ART_STYLES: ArtStyle[] = [
  { id: 'porcelain', name: 'Porcelain Lab',
    vision: 'A sunlit ceramic test chamber: ivory panels, glazed enamel trainees, tangerine flames and cobalt glass. Soft forms, crisp color, generous quiet space.',
    fit: 'Best initial fit for a welcoming training room. The room feels purpose-built and physical; bright magic needs saturated bodies to stay visible against ivory.',
    background: 0xd7e1e4, floor: 0xf0ece0, wall: 0xe3e7e4, line: 0xc4cfc9, accent: 0x60999a,
    fire: 0xff6b24, fireCore: 0xffed99, ice: 0x287bc5, iceCore: 0xb5eeff,
    fighters: [0xd75246, 0x3c81c4, 0x439675, 0xe2ae32], roughness: 0.24, metalness: 0.12 },
  { id: 'photon', name: 'Photon Chamber',
    vision: 'A midnight holographic simulator: cyan calibration rails, translucent wire-shell trainees, white-hot plasma needles and laser-cut ice. Magic is synthesized light.',
    fit: 'Strongest literal simulator. Sharp timing and luminous silhouettes, with the risk that the digital language overwhelms the warmth of wizardry.',
    background: 0x060f24, floor: 0x101d36, wall: 0x101a32, line: 0x1c3f58, accent: 0x42e4ef,
    fire: 0xff6b9d, fireCore: 0xfff0dc, ice: 0x3be3ed, iceCore: 0xd6ffff,
    fighters: [0xff628f, 0x559bff, 0x49e2b0, 0xffdc69], roughness: 0.3, metalness: 0.5 },
  { id: 'observatory', name: 'Arcane Observatory',
    vision: 'An academy observatory: plum stone, brass inlays and celestial instruments. Amber comets and faceted aquamarine crystals behave like small astronomical events.',
    fit: 'A magical research room rather than a digital simulation. Richest scholarly fantasy; ceremonial decoration must leave the fights in charge.',
    background: 0x221d39, floor: 0x34304f, wall: 0x2d2947, line: 0x63556f, accent: 0xc4a46a,
    fire: 0xffaa46, fireCore: 0xfff2bf, ice: 0x51bebf, iceCore: 0xd8fff1,
    fighters: [0xc95d70, 0x779bdc, 0x66ac94, 0xe6bd69], roughness: 0.48, metalness: 0.25 },
  { id: 'paper', name: 'Paper Theater',
    vision: 'A tactile teaching diorama: sage card walls, ruled cream paper, folded trainees and layered coral flame cutouts. Ice reads as folded blue paper, with no simulated glass.',
    fit: 'A charming educational model of a training room. Clear silhouettes and hand-made playfulness; deliberately gives up the fantasy of dangerous, luminous energy.',
    background: 0xc6d3c2, floor: 0xf5e6c8, wall: 0xdce2cd, line: 0xd3c09d, accent: 0x6d9687,
    fire: 0xe86b45, fireCore: 0xffc65e, ice: 0x468fa6, iceCore: 0xa4d6d8,
    fighters: [0xc75a52, 0x4f8ba9, 0x648f63, 0xd5a243], roughness: 1, metalness: 0 },
  { id: 'foundry', name: 'Obsidian Foundry',
    vision: 'A heavy industrial proving chamber: graphite slabs, copper busbars and amber safety lights. Dense molten fire and fractured blue minerals bring weight to each release.',
    fit: 'A destructive-test facility for powerful magic. Strong material contrast and physical impact; can feel hostile and less inviting than a practice room.',
    background: 0x161b20, floor: 0x30383f, wall: 0x252d35, line: 0x47515a, accent: 0xce8e55,
    fire: 0xff7624, fireCore: 0xffe6a0, ice: 0x428dab, iceCore: 0xb5edff,
    fighters: [0xca5841, 0x448eaf, 0x5c9d80, 0xd6ac4d], roughness: 0.65, metalness: 0.65 },
];
export const ART_REVISION_STYLES: ArtStyle[] = ART_STYLES.map(base => {
  const updates: Record<string, Partial<ArtStyle>> = {
    porcelain: { vision: 'Celadon ceramic atelier: directional warm light, shaded ivory alcoves, glazed trainees and cobalt crystals with luminous edges.', fit: 'A physical practice room with warmth and material depth. The light floor remains the difficult spell-readability case.', background: 0xb6c9c5, floor: 0xe6dfc9, wall: 0xbed0c3, line: 0x76988b, accent: 0x547f78, ice: 0x286c9f, iceCore: 0xa6e7fa },
    photon: { vision: 'Light-made simulator, refined: translucent trainees, high-contrast plasma needles and quieter calibration brackets. Preserve the round-one identity.', fit: 'Still the most literal simulator. This is a restrained revision; judge whether fewer competing lines actually improve on the original.' },
    observatory: { vision: 'A vaulted academy practice room: robed geometric scholars, familiar colored hats, brass orreries and aquamarine crystal magic.', fit: 'A magical training room with the strongest academy theme. Robes replace spherical bodies; judge whether this better belongs with the geometric spell language.' },
    paper: { vision: 'A cut-and-fold teaching stage: thick card panels, bent mounting tabs, creased polygon trainees, folded spells and a warm theatrical key light.', fit: 'A deliberate tabletop teaching model. Keep the low-poly figures while making paper construction tangible instead of simply flatly lit.', background: 0xb1bda5, floor: 0xe9d5af, wall: 0xc6cfae, accent: 0x6f8e77 },
    foundry: { vision: 'Obsidian Atelier: a mineral practice sanctuary with carved stone bays, jade crystals and the retained dense molten projectiles. No factory fittings.', fit: 'Preserves the liked physical spells while testing a quieter, less industrial setting. Decide whether the revised mood fits everyday training.', name: 'Obsidian Atelier', background: 0x1a292b, floor: 0x354b49, wall: 0x344c4b, accent: 0xa8af86, roughness: 0.6, metalness: 0.18 },
  };
  return { ...base, ...updates[base.id], family: base.id as ArtFamily, id: `${base.id}-v2` as ArtDirection, revision: 2 };
});
export function artFamily(style?: ArtStyle): ArtFamily | undefined { return style?.family ?? style?.id as ArtFamily | undefined; }
export function artStyle(id?: ArtDirection): ArtStyle | undefined { return [...ART_STYLES, ...ART_REVISION_STYLES, ...ART_EXPLORATION_STYLES].find(s => s.id === id); }
export function fighterColor(style: ArtStyle, id: string): number {
  return style.fighters[Math.max(0, ['red', 'blue', 'green', 'yellow'].indexOf(id))];
}
function surface(style: ArtStyle, color: number) {
  return new THREE.MeshStandardMaterial({ color, roughness: style.roughness, metalness: style.metalness, flatShading: style.id === 'paper' || style.id === 'foundry' });
}
function box(group: THREE.Group, style: ArtStyle, color: number, size: number[], pos: number[]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), surface(style, color));
  mesh.position.set(pos[0], pos[1], pos[2]); mesh.receiveShadow = true; mesh.castShadow = false; group.add(mesh); return mesh;
}
function line(group: THREE.Group, points: number[], color: number, opacity = 1) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const mesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity })); group.add(mesh); return mesh;
}

/** Room geometry is presentation only. The world keeps its exact square bounds. */
export function buildArtArena(style: ArtStyle): THREE.Group {
  if (style.revision === 3) return explorationArena(style);
  if (style.revision === 2) return revisedArena(style);
  const group = new THREE.Group(); group.name = `art-room:${style.id}`;
  const { width: w, depth: d, height: h } = ARENA;
  box(group, style, style.floor, [w, 22, d], [0, -13, 0]);
  box(group, style, style.wall, [w, h, 12], [0, h / 2, -d / 2 - 6]);
  box(group, style, style.wall, [12, h, d], [-w / 2 - 6, h / 2, 0]);
  const dark = style.id === 'photon' || style.id === 'foundry';
  const spacing = style.id === 'paper' ? 100 : 200;
  for (let p = -400; p <= 400; p += spacing) {
    line(group, [p, 0, -500, p, 0, 500, -500, 0, p, 500, 0, p], style.line, dark ? 0.65 : 0.5);
  }
  // Raised perimeter and sparse wall seams frame rather than fill the stage.
  for (const p of [-500, 500]) {
    box(group, style, style.accent, [1000, 5, 7], [0, 1, p]);
    box(group, style, style.accent, [7, 5, 1000], [p, 1, 0]);
  }
  for (const p of [-300, 0, 300]) {
    line(group, [p, 0, -493, p, h, -493, -493, 0, p, -493, h, p], style.line, 0.8);
  }
  for (const y of [35, 320]) {
    box(group, style, style.accent, [1000, 4, 3], [0, y, -492]);
    box(group, style, style.accent, [3, 4, 1000], [-492, y, 0]);
  }
  if (style.id === 'observatory') {
    for (const radius of [180, 350, 460]) { const r = ring(radius, style.accent, 0.35); r.geometry.dispose(); r.geometry = new THREE.RingGeometry(radius-1.5, radius, 96); r.position.y = 0.4; group.add(r); }
    for (let i = 0; i < 32; i++) {
      const a = i / 32 * Math.PI * 2, r = 430;
      line(group, [Math.cos(a)*r, 1, Math.sin(a)*r, Math.cos(a)*(r+15), 1, Math.sin(a)*(r+15)], style.accent);
    }
    for (const x of [-300, 0, 300]) {
      const dial = new THREE.Mesh(new THREE.TorusGeometry(57, 2, 6, 64), surface(style, style.accent));
      dial.position.set(x, 210, -489); group.add(dial);
      const orbit = new THREE.Mesh(new THREE.TorusGeometry(42, 1.5, 6, 48), surface(style, style.accent));
      orbit.position.copy(dial.position); orbit.rotation.y = 0.7; orbit.rotation.z = 0.5; group.add(orbit);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(8), glow(style.accent)); star.position.copy(dial.position); star.position.z += 3; group.add(star);
      line(group, [x-40,210,-485,x+40,210,-485,x,170,-485,x,250,-485], style.accent);
    }
  } else if (style.id === 'photon') {
    for (let p = -400; p <= 400; p += 100) {
      line(group, [p-8,1,0,p+8,1,0,p,1,-8,p,1,8, -8,1,p,8,1,p,0,1,p-8,0,1,p+8], style.accent, 0.65);
    }
    for (const x of [-350, 0, 350]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(50, 1.5, 6, 48), glow(style.accent, 0.6));
      hoop.position.set(x, 200, -489); group.add(hoop);
      line(group, [x-65,200,-488,x+65,200,-488,x,135,-488,x,265,-488], style.accent, 0.45);
    }
  } else if (style.id === 'porcelain') {
    for (const x of [-330, 0, 330]) {
      box(group, style, 0xf8f4e8, [270, 180, 8], [x, 210, -490]);
      box(group, style, style.accent, [110, 6, 9], [x, 120, -484]);
    }
    const circle = ring(340, style.accent, 0.22); group.add(circle);
  } else if (style.id === 'paper') {
    for (const x of [-350, 0, 350]) {
      const badge = new THREE.Mesh(new THREE.CircleGeometry(54, 6), surface(style, style.accent));
      badge.position.set(x, 215, -490); group.add(badge);
      const center = new THREE.Mesh(new THREE.CircleGeometry(34, 6), surface(style, style.wall));
      center.position.set(x, 215, -488); group.add(center);
    }
    for (const p of [-400, -200, 0, 200, 400]) {
      const fold = box(group, style, 0xe7d4ad, [8, 10, 980], [p, -8, 0]); fold.rotation.z = 0.15;
      const tab = box(group, style, style.accent, [40, 30, 10], [p, 16, -490]); tab.rotation.z = 0.1;
    }
    for (const p of [-450, 450]) {
      line(group, [p,-1,-500,p,-1,500, -500,-1,p,500,-1,p], style.accent);
    }
  } else {
    for (const x of [-330, 0, 330]) {
      for (const z of [-330, 0, 330]) {
        box(group, style, style.floor, [320, 3, 320], [x, -2, z]);
        for (const dx of [-140, 140]) for (const dz of [-140, 140]) {
          const bolt = new THREE.Mesh(new THREE.CylinderGeometry(3,3,2,6), surface(style, style.accent));
          bolt.position.set(x+dx,2,z+dz); group.add(bolt);
        }
      }
      box(group, style, 0x19232b, [210, 180, 9], [x, 210, -490]);
      for (let i = 0; i < 6; i++) box(group, style, style.line, [170, 5, 12], [x, 150+i*22, -481]);
    }
    for (let p = -450; p < 500; p += 45) {
      const stripe = box(group, style, style.accent, [22, 1, 18], [p, 1, 472]); stripe.rotation.y = -0.4;
    }
  }
  // Corner instruments have a shared purpose, with direction-specific materials.
  for (const x of [-455, 455]) for (const z of [-455, 455]) {
    box(group, style, style.line, [26, 45, 26], [x, 21, z]);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(18, 5, 18), glow(style.accent)); lamp.position.set(x, 45, z); group.add(lamp);
  }
  return group;
}

export function styleFigure(figure: THREE.Group, style: ArtStyle, id: string): void {
  if (style.revision === 3) return explorationFigure(figure, style, id);
  if (style.revision === 2) return revisedFigure(figure, style, id);
  const color = fighterColor(style, id);
  for (const node of figure.children) if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshToonMaterial) {
    node.material.dispose(); node.material = surface(style, color);
    if (style.id === 'photon') {
      node.material.emissive.setHex(color); node.material.emissiveIntensity = 0.22;
      node.material.transparent = true; node.material.opacity = 0.62; node.material.depthWrite = false;
      const shell = new THREE.LineSegments(new THREE.WireframeGeometry(node.geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.28 }));
      shell.scale.setScalar(1.06); node.add(shell);
    }
    if (style.id === 'paper') { const original = node.geometry; node.geometry = original.toNonIndexed(); original.dispose(); node.geometry.computeVertexNormals(); }
  }
  const band = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 4, style.id === 'paper' ? 6 : 24), surface(style, style.accent));
  band.position.y = 26; figure.add(band);
  if (style.id === 'observatory') {
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(5), glow(style.accent)); star.position.set(11, 45, 5); figure.add(star);
  }
  if (style.id === 'photon') for (const y of [-9, 0, 9]) {
    const scan = ring(Math.sqrt(400-y*y), color, 0.7); scan.position.y = y; figure.add(scan);
  }
}

function energy(style: ArtStyle, color: number, opacity = 1): THREE.MeshBasicMaterial {
  const mat = glow(color, opacity);
  if (style.id === 'photon') mat.blending = THREE.AdditiveBlending;
  return mat;
}

/** +X is travel direction. Shape, layering and motion distinguish the visions. */
export function artProjectile(style: ArtStyle, radius: number, ice: boolean) {
  if (style.revision === 3) return explorationProjectile(style, radius, ice);
  if (style.revision === 2) return revisedProjectile(style, radius, ice);
  const group = new THREE.Group();
  const color = ice ? style.ice : style.fire, core = ice ? style.iceCore : style.fireCore;
  const mesh = (geo: THREE.BufferGeometry, color: number, opacity = 1) => {
    const m = new THREE.Mesh(geo, energy(style, color, opacity)); group.add(m); return m;
  };
  if (style.id === 'photon') {
    const needle = mesh(new THREE.OctahedronGeometry(radius), core); needle.scale.set(ice ? 3.5 : 2.5, 0.4, 0.4);
    const sheath = mesh(new THREE.OctahedronGeometry(radius), color, 0.35); sheath.scale.set(4, 0.8, 0.8);
    for (const x of [-1.7, -0.8]) { const hoop = mesh(new THREE.TorusGeometry(radius*0.85, 0.8, 6, 16), color, 0.8); hoop.rotation.y = Math.PI/2; hoop.position.x = radius*x; }
  } else if (style.id === 'paper') {
    const shape = new THREE.Shape();
    if (ice) {
      shape.moveTo(radius*1.8, 0); shape.lineTo(-radius*0.6, radius*0.7); shape.lineTo(-radius*1.3, 0); shape.lineTo(-radius*0.6,-radius*0.7);
    } else {
      shape.moveTo(radius*1.2, 0);
      shape.bezierCurveTo(radius*0.9, radius*1.4, -radius, radius*0.9, -radius*2, radius*0.5);
      shape.lineTo(-radius*0.8, radius*0.2); shape.lineTo(-radius*1.8, -radius*0.8);
      shape.bezierCurveTo(-radius*0.1, -radius*0.5, radius*0.5, -radius*0.9, radius*1.2, 0);
    }
    shape.closePath();
    for (const a of [0, Math.PI/2]) {
      const plane = mesh(new THREE.ShapeGeometry(shape), color); plane.rotation.x = a;
      const inner = mesh(new THREE.ShapeGeometry(shape), core); inner.scale.setScalar(0.62); inner.position.x = radius*0.3; inner.position.z = 0.5; inner.rotation.x = a;
    }
  } else if (ice) {
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(radius), surface(style, color)); body.scale.set(2.6, 0.65, 0.65); group.add(body);
    const inner = mesh(new THREE.OctahedronGeometry(radius*0.5), core); inner.scale.set(2.8, 0.7, 0.7); inner.position.z = radius*0.4;
    if (style.id === 'observatory') {
      const hoop = mesh(new THREE.TorusGeometry(radius, 0.9, 6, 16), style.accent); hoop.rotation.y = Math.PI/2; group.add(hoop);
    }
  } else {
    const segments = style.id === 'porcelain' ? 20 : 7;
    const flame = mesh(new THREE.SphereGeometry(radius, segments, 8), color); flame.scale.set(1.5, 0.85, 0.85);
    const hot = mesh(new THREE.SphereGeometry(radius*0.65, segments, 8), core); hot.position.x = radius*0.65;
    for (let i = 0; i < 3; i++) {
      const tongue = mesh(new THREE.ConeGeometry(radius*(0.45-i*0.08), radius*(2.7-i*0.3), segments), i === 1 ? core : color);
      tongue.rotation.z = Math.PI/2; tongue.position.set(-radius*(0.7+i*0.15), (i-1)*radius*0.5, 0);
    }
    if (style.id === 'observatory') {
      const orbit = mesh(new THREE.TorusGeometry(radius*1.45, 0.8, 6, 24), style.accent, 0.9); orbit.rotation.y = Math.PI/3;
    }
  }
  return { group, update(time: number, frozen: boolean) {
    // Low-amplitude pulse preserves recognizable projectile shape and shot rhythm.
    const pulse = frozen ? 0.9 + 0.1*Math.sin(time*10) : 1;
    group.scale.setScalar(pulse);
    group.rotation.x = style.id === 'paper' ? 0.3 : time*(style.id === 'photon' ? 4 : 2);
  } };
}

export function artShard(style: ArtStyle) {
  if (style.revision === 3) return explorationShard(style);
  if (style.revision === 2) return revisedShard(style);
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(22), surface(style, style.ice)); body.scale.set(0.7,3,0.7); group.add(body);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(13), energy(style, style.iceCore)); core.scale.set(0.7,3.8,0.7); core.position.z = 8; group.add(core);
  if (style.id === 'photon' || style.id === 'observatory') {
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: style.id === 'photon' ? style.iceCore : style.accent }));
    edges.scale.copy(body.scale); group.add(edges);
  }
  if (style.id === 'foundry') for (const x of [-15, 16]) {
    const chip = new THREE.Mesh(new THREE.OctahedronGeometry(10), surface(style, style.ice)); chip.scale.y=3.2; chip.position.set(x, 10, 2); group.add(chip);
  }
  return group;
}
