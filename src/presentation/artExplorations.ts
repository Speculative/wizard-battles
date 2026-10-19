import * as T from 'three';
import type { ArtStyle } from './artDirection';

export type ArtBranch = 'calibration' | 'vector' | 'wave' | 'armillary' | 'astral' | 'archive' | 'cloister' | 'geode' | 'ember';
const surface = (color: number, roughness = .65, metalness = .12) => new T.MeshStandardMaterial({ color, roughness, metalness, side: T.DoubleSide });
const light = (color: number, opacity = 1) => new T.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1, side: T.DoubleSide });
function add(g: T.Group, geo: T.BufferGeometry, material: T.Material, p = [0, 0, 0]) {
  const m = new T.Mesh(geo, material); m.position.set(p[0], p[1], p[2]); g.add(m); return m;
}
function slab(g: T.Group, color: number, size: number[], p: number[], roughness = .65) {
  const m = add(g, new T.BoxGeometry(size[0], size[1], size[2]), surface(color, roughness), p); m.receiveShadow = true; return m;
}
function lines(g: T.Group, pts: number[], color: number, opacity = 1) {
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
  const l = new T.LineSegments(geo, new T.LineBasicMaterial({ color, transparent: opacity < 1, opacity })); g.add(l); return l;
}
function outline(g: T.Group, m: T.Mesh, color: number, opacity = .7) {
  const l = new T.LineSegments(new T.EdgesGeometry(m.geometry, 24), new T.LineBasicMaterial({ color, transparent: true, opacity }));
  l.position.copy(m.position); l.rotation.copy(m.rotation); l.scale.copy(m.scale); g.add(l);
}
function hoop(g: T.Group, radius: number, tube: number, color: number, p = [0, 0, 0], opacity = 1) {
  return add(g, new T.TorusGeometry(radius, tube, 6, 80), light(color, opacity), p);
}
function floorRing(g: T.Group, radius: number, color: number, width = 1, opacity = .4) {
  const r = add(g, new T.RingGeometry(radius - width, radius, 96), light(color, opacity), [0, .4, 0]); r.rotation.x = -Math.PI / 2; return r;
}
function wallGrid(g: T.Group, s: ArtStyle, spacing = 100) {
  for (let p = -500; p <= 500; p += spacing) {
    lines(g, [p, .3, -500, p, .3, 500, -500, .3, p, 500, .3, p], s.line, .55);
    lines(g, [p, 0, -498, p, 350, -498, -498, 0, p, -498, 350, p], s.accent, .28);
  }
  for (const y of [0, 100, 200, 300, 350]) lines(g, [-500, y, -498, 500, y, -498, -498, y, -500, -498, y, 500], s.accent, .28);
}
function stars(g: T.Group, color: number) {
  // Fixed ornamental positions; no gameplay or ambient RNG consumption.
  const pts: number[] = [];
  for (let i = 0; i < 90; i++) {
    const x = Math.sin(i * 17.71) * 950, y = 80 + (i * 113 % 650), z = -850 - (i * 79 % 250);
    pts.push(x - 1.8, y, z, x + 1.8, y, z, x, y - 1.8, z, x, y + 1.8, z);
  }
  lines(g, pts, color, .55);
}
function crystal(g: T.Group, s: ArtStyle, p: number[], size: number, color = s.ice) {
  const m = add(g, new T.OctahedronGeometry(size), surface(color, .2, .2), p); m.scale.set(.65, 2, .65); outline(g, m, s.iceCore, .65); return m;
}

/** Each branch owns its complete set, so divergence is spatial as well as chromatic. */
export function explorationArena(s: ArtStyle) {
  const g = new T.Group(); g.name = `art-room:${s.id}`;
  const b = s.branch!;
  slab(g, s.floor, [1000, 22, 1000], [0, -13, 0], s.roughness);
  const open = b === 'vector' || b === 'astral';
  if (!open) {
    slab(g, s.wall, [1000, 350, 14], [0, 175, -507]);
    slab(g, s.wall, [14, 350, 1000], [-507, 175, 0]);
  }
  if (b === 'calibration') {
    wallGrid(g, s);
    for (const p of [-500, 500]) {
      slab(g, s.accent, [1000, 3, 3], [0, 0, p]); slab(g, s.accent, [3, 3, 1000], [p, 0, 0]);
    }
    for (const x of [-330, 0, 330]) {
      const ring = hoop(g, 47, 1.1, s.accent, [x, 210, -494], .65); ring.name = 'calibration-target';
      lines(g, [x - 65, 210, -493, x - 53, 210, -493, x + 53, 210, -493, x + 65, 210, -493], s.accent, .8);
    }
  } else if (b === 'vector') {
    stars(g, 0x6a96c9);
    // A floating square simulation deck; all four physical bounds remain visible.
    slab(g, 0x132a48, [1020, 17, 1020], [0, -29, 0]);
    for (const p of [-500, 500]) {
      add(g, new T.BoxGeometry(1000, 3, 4), light(s.accent), [0, 0, p]);
      add(g, new T.BoxGeometry(4, 3, 1000), light(s.accent), [p, 0, 0]);
    }
    for (const x of [-480, 480]) for (const z of [-480, 480]) {
      const post = add(g, new T.ConeGeometry(13, 95, 4), light(s.accent, .38), [x, 46, z]); outline(g, post, s.iceCore);
    }
    floorRing(g, 340, s.accent, 1.3, .35);
    for (const p of [-250, 0, 250]) lines(g, [p - 12, .6, 0, p + 12, .6, 0, 0, .6, p - 12, 0, .6, p + 12], s.accent, .6);
    // Underside fins strengthen the impression of a suspended instrument.
    for (const x of [-360, 0, 360]) slab(g, 0x183957, [45, 55, 960], [x, -58, 0]);
  } else if (b === 'wave') {
    // Broad translucent waveforms instead of Cartesian rails and needle motifs.
    for (const x of [-370, 0, 370]) {
      slab(g, 0x101b3f, [280, 310, 6], [x, 166, -497]);
      for (const radius of [58, 86, 114]) {
        const r = hoop(g, radius, 1.7, s.accent, [x, 177, -489], .25 + radius / 600); r.scale.x = .7;
      }
      for (const dx of [-140, 140]) {
        const column = add(g, new T.CylinderGeometry(9, 9, 320, 12), light(s.accent, .18), [x + dx, 160, -480]); outline(g, column, s.accent, .3);
      }
    }
    for (const radius of [250, 375, 470]) floorRing(g, radius, s.accent, 2, .2);
    for (const z of [-330, 0, 330]) { const r = hoop(g, 85, 2, s.accent, [-491, 170, z], .38); r.rotation.y = Math.PI / 2; }
  } else if (b === 'armillary') {
    for (const x of [-330, 0, 330]) {
      slab(g, 0x242139, [282, 255, 4], [x, 157, -497]);
      const arch = hoop(g, 118, 4, s.accent, [x, 208, -489], .7); arch.scale.y = 1.05;
      // Stone uprights ground the luminous instruments in an academy room.
      for (const dx of [-145, 145]) slab(g, 0x695771, [17, 333, 21], [x + dx, 167, -486]);
      for (const a of [-.7, .6]) { const r = hoop(g, 62, 1.4, s.accent, [x, 187, -480], .8); r.rotation.set(a, .6, a); }
      crystal(g, s, [x, 187, -477], 9, s.accent);
      slab(g, s.accent, [242, 5, 18], [x, 43, -486]);
    }
    floorRing(g, 362, s.accent, 1.5); floorRing(g, 451, s.accent, 1);
    for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; lines(g, [Math.cos(a) * 435, .6, Math.sin(a) * 435, Math.cos(a) * 450, .6, Math.sin(a) * 450], s.accent, .65); }
    for (const z of [-330, 0, 330]) slab(g, 0x695771, [19, 333, 17], [-486, 167, z]);
  } else if (b === 'astral') {
    stars(g, 0xc7badb);
    // An outdoor astronomical practice terrace. The square walkable deck stays
    // explicit while concentric brass tracks imply a larger celestial device.
    for (const p of [-500, 500]) { slab(g, s.accent, [1000, 8, 8], [0, -1, p]); slab(g, s.accent, [8, 8, 1000], [p, -1, 0]); }
    for (const radius of [190, 350, 470]) floorRing(g, radius, s.accent, 1.6, .55);
    for (const x of [-455, 455]) for (const z of [-455, 455]) {
      slab(g, 0x514260, [38, 55, 38], [x, 24, z]);
      const r = hoop(g, 28, 1.5, s.accent, [x, 83, z]); r.rotation.x = .8;
      crystal(g, s, [x, 83, z], 8);
    }
    const moon = add(g, new T.SphereGeometry(62, 32, 20), light(0xb6a7c8, .38), [0, 235, -655]); moon.name = 'distant-moon';
    const orbit = hoop(g, 91, 1, s.accent, [0, 235, -656], .35); orbit.rotation.y = .55;
  } else if (b === 'archive') {
    // Inset constellation panels and shelves: a geometric magical library.
    for (const x of [-330, 0, 330]) {
      slab(g, 0x1c273b, [275, 270, 6], [x, 177, -496]);
      for (const dx of [-143, 143]) slab(g, s.accent, [5, 306, 10], [x + dx, 177, -487]);
      for (const y of [36, 318]) slab(g, s.accent, [285, 5, 10], [x, y, -487]);
      const coords = [[-78, 114], [-40, 236], [32, 198], [88, 270], [62, 98]];
      for (let i = 0; i < coords.length; i++) {
        const [dx, y] = coords[i]; crystal(g, s, [x + dx, y, -482], 3.5, s.accent);
        if (i) lines(g, [x + coords[i - 1][0], coords[i - 1][1], -483, x + dx, y, -483], s.accent, .55);
      }
      slab(g, 0x6a5b7b, [270, 12, 35], [x, 20, -477]);
    }
    for (const z of [-330, 0, 330]) for (const y of [75, 175, 275]) {
      slab(g, 0x6a5b7b, [30, 9, 270], [-480, y, z]);
      for (let i = 0; i < 7; i++) slab(g, i % 2 ? 0x3e566c : 0x79536e, [24, 43 + i % 3 * 7, 22], [-478, y + 27, z - 96 + i * 32]);
    }
    const hex = add(g, new T.RingGeometry(349, 351, 6), light(s.accent, .45), [0, .5, 0]); hex.rotation.x = -Math.PI / 2;
    floorRing(g, 455, s.accent, 1, .25);
  } else if (b === 'cloister') {
    for (const x of [-330, 0, 330]) {
      slab(g, 0x172e2c, [270, 246, 6], [x, 174, -498]);
      for (const dx of [-141, 141]) slab(g, 0x547d6f, [18, 312, 24], [x + dx, 159, -483]);
      const arch = hoop(g, 109, 6, 0x749582, [x, 209, -482], .8); arch.scale.y = .8;
      slab(g, 0x8a9d80, [223, 13, 47], [x, 48, -473]);
      crystal(g, s, [x, 166, -479], 38, 0x3d957b);
      for (const dx of [-115, 115]) for (let i = 0; i < 4; i++) {
        const leaf = add(g, new T.SphereGeometry(8, 6, 4), surface(0x447b63), [x + dx, 70 + i * 34, -470]); leaf.scale.set(.5, 1.8, .7); leaf.rotation.z = i % 2 ? .6 : -.6;
      }
    }
    for (const z of [-330, 0, 330]) slab(g, 0x547d6f, [24, 312, 18], [-483, 159, z]);
    floorRing(g, 377, s.accent, 3, .5);
    for (const x of [-455, 455]) for (const z of [-455, 455]) { slab(g, 0x688478, [42, 22, 42], [x, 9, z]); crystal(g, s, [x, 43, z], 18); }
  } else if (b === 'geode') {
    // Deep crystal cavity: jagged specimens frame the back and left edges,
    // never the fighting surface. Warm molten magic cuts against violet stone.
    for (let i = 0; i < 7; i++) {
      const x = -440 + i * 144 + Math.sin(i * 4.1) * 22, height = 48 + i * 43 % 72;
      const m = crystal(g, s, [x, 105 + height / 3, -487], height, i % 2 ? 0x665382 : 0x3f566e);
      m.scale.x = .9; m.rotation.set(.1, i * .7, (i % 3 - 1) * .3);
      const n = crystal(g, s, [-487, 100 + height / 3, x], height * .72, 0x515779);
      n.scale.z = .95; n.rotation.set((i % 3 - 1) * .3, i, .1);
      for (const dx of [-32, 34]) {
        const chip = crystal(g, s, [x + dx, 55, -473], 29 + i * 11 % 23, 0x4b546b);
        chip.rotation.z = dx / 90;
      }
    }
    for (const x of [-460, 460]) for (const z of [-460, 460]) {
      const base = add(g, new T.DodecahedronGeometry(37), surface(0x404657), [x, 15, z]); base.scale.y = .5;
      crystal(g, s, [x, 60, z], 23);
    }
    for (const p of [-330, 0, 330]) lines(g, [p - 65, .2, -470, p, .2, -370, p + 20, .2, -280, -470, .2, p, -380, .2, p + 60], s.accent, .3);
    floorRing(g, 373, s.accent, 1, .3);
  } else {
    // A carved volcanic practice sanctum, with no factory metal or fittings.
    for (const x of [-330, 0, 330]) {
      slab(g, 0x191e28, [270, 260, 7], [x, 177, -496]);
      for (const dx of [-143, 143]) {
        slab(g, 0x504450, [20, 332, 30], [x + dx, 166, -481]);
        add(g, new T.BoxGeometry(2, 290, 2), light(s.accent, .6), [x + dx, 166, -464]);
      }
      const crest = add(g, new T.OctahedronGeometry(48), surface(0x55434b), [x, 197, -479]); crest.scale.set(1, 1.4, .18); outline(g, crest, s.accent, .7);
      const coal = add(g, new T.OctahedronGeometry(17), light(s.fireCore), [x, 197, -467]); coal.scale.set(.6, 1.5, .3);
      for (let i = 0; i < 3; i++) slab(g, 0x64505a, [230 - i * 25, 9, 48 - i * 7], [x, 8 + i * 10, -475]);
    }
    for (const z of [-330, 0, 330]) slab(g, 0x504450, [30, 332, 20], [-481, 166, z]);
    floorRing(g, 380, s.accent, 2, .5); floorRing(g, 390, s.accent, .8, .3);
    for (const x of [-455, 455]) for (const z of [-455, 455]) {
      const pedestal = add(g, new T.CylinderGeometry(21, 27, 33, 6), surface(0x68525a), [x, 15, z]); outline(g, pedestal, 0x92716a, .35);
      const flame = add(g, new T.OctahedronGeometry(12), light(s.accent), [x, 44, z]); flame.scale.y = 1.7;
    }
  }
  return g;
}

export function explorationLighting(scene: T.Scene, s: ArtStyle) {
  const photon = s.family === 'photon';
  scene.traverse(n => {
    if (n instanceof T.AmbientLight) { n.intensity = photon ? .5 : .35; n.color.setHex(photon ? 0xffffff : 0xc9cce9); }
    if (n instanceof T.DirectionalLight) { n.intensity = photon ? .35 : 1.45; n.color.setHex(s.branch === 'ember' ? 0xffc495 : 0xdce5ff); }
    if (n instanceof T.SpotLight) { n.intensity = photon ? 3.5 : 1.7; n.penumbra = .65; }
  });
  if (!photon) { const fill = new T.DirectionalLight(s.branch === 'ember' ? 0xb4b7ed : 0x9bd1cb, .45); fill.position.set(500, 280, -200); scene.add(fill); }
}

export function explorationFigure(g: T.Group, s: ArtStyle, id: string) {
  const color = s.fighters[Math.max(0, ['red', 'blue', 'green', 'yellow'].indexOf(id))];
  const [body, hat, brim, nose] = g.children as T.Mesh[];
  for (const n of [body, hat, brim]) { (n.material as T.Material).dispose(); n.material = surface(color, s.roughness, s.metalness); }
  const replace = (n: T.Mesh, geo: T.BufferGeometry) => { n.geometry.dispose(); n.geometry = geo; };
  if (s.family === 'photon') {
    // No latitude/longitude wire mesh. Sparse contour bands or a solid core
    // carry the construction without drawing every triangle of the sphere.
    for (const n of [body, hat, brim]) {
      const m = n.material as T.MeshStandardMaterial; m.emissive.setHex(color); m.emissiveIntensity = .22;
      m.transparent = true; m.opacity = s.branch === 'wave' ? .4 : .58; m.depthWrite = false;
    }
    if (s.branch === 'vector') {
      replace(body, new T.OctahedronGeometry(22, 1));
      outline(g, body, color, .8);
      const core = add(g, new T.OctahedronGeometry(9), light(color), [0, 0, 0]); core.scale.y = 1.3;
      replace(hat, new T.ConeGeometry(21, 34, 4)); outline(g, hat, color, .6);
    } else if (s.branch === 'wave') {
      replace(body, new T.CapsuleGeometry(15, 9, 6, 20));
      for (const y of [-9, 3, 13]) { const r = hoop(g, 17, .65, color, [0, y, 0], .65); r.rotation.x = Math.PI / 2; }
      const nucleus = add(g, new T.SphereGeometry(7, 16, 10), light(color)); nucleus.scale.y = 1.4;
    } else {
      const r = hoop(g, 20.5, .75, color, [0, 0, 0], .75); r.rotation.x = Math.PI / 2;
      const r2 = hoop(g, 21, .45, color, [0, 0, 0], .45); r2.rotation.y = .5;
    }
    (nose.material as T.Material).dispose(); nose.material = light(color, .7);
  } else if (s.branch === 'astral') {
    replace(body, new T.SphereGeometry(19, 20, 12));
    const belt = hoop(g, 21, 1, s.accent, [0, 0, 0]); belt.rotation.x = .8;
    for (const n of [body, hat]) { const m = n.material as T.MeshStandardMaterial; m.emissive.setHex(color); m.emissiveIntensity = .15; }
    add(g, new T.OctahedronGeometry(4), light(s.accent), [11, 45, 5]);
  } else if (s.family === 'observatory') {
    // Rounded shoulders, shaped waist and a separate face distinguish a
    // scholar from the earlier cone with a hat perched directly on top.
    replace(body, new T.CylinderGeometry(s.branch === 'archive' ? 10 : 12, 21, 28, 12)); body.position.y = -5;
    const shoulders = add(g, new T.SphereGeometry(15, 16, 10), surface(color, .8), [0, 9, 0]); shoulders.scale.set(1, .62, .8);
    const face = add(g, new T.SphereGeometry(8, 12, 8), surface(0xc7ab9b), [0, 17, 3]); face.scale.set(1, .8, 1);
    const sash = add(g, new T.CylinderGeometry(14, 15, 4, 12), surface(s.accent, .4, .35), [0, 0, 0]); sash.name = 'scholar-belt';
    for (const a of [-.65, .65]) { const x = Math.sin(a), z = Math.cos(a); lines(g, [x * 13, 12, z * 13, x * 20, -19, z * 20], s.accent, .65); }
    if (s.branch === 'archive') {
      const book = slab(g, 0x384661, [12, 14, 4], [17, 0, 9]); book.rotation.z = -.2;
      slab(g, s.accent, [8, 1, 4.5], [17, 0, 9]);
      replace(hat, new T.ConeGeometry(19, 37, 6)); hat.rotation.z = -.13;
    }
    add(g, new T.OctahedronGeometry(4), light(s.accent), [11, 45, 5]);
  } else {
    replace(body, new T.DodecahedronGeometry(20, s.branch === 'geode' ? 0 : 1));
    if (s.branch === 'cloister') {
      const collar = hoop(g, 20.5, 1.8, s.accent, [0, 4, 0]); collar.rotation.x = Math.PI / 2;
      const seal = add(g, new T.OctahedronGeometry(5), surface(0x81bc9d, .2), [0, 3, 19]); seal.scale.y = 1.5;
    } else if (s.branch === 'geode') {
      replace(hat, new T.ConeGeometry(20, 35, 6));
      // Crystal seam, not a complete dice-edge cage.
      lines(g, [-9, 15, 15, 1, 2, 20, 1, 2, 20, -3, -14, 15], s.iceCore, .6);
      const stone = body.material as T.MeshStandardMaterial; stone.roughness = .3;
    } else {
      replace(body, new T.CylinderGeometry(13, 22, 35, 8)); body.position.y = -1;
      const chest = add(g, new T.OctahedronGeometry(6), light(s.accent), [0, 4, 17]); chest.scale.set(.6, 1.4, .3);
      const mantle = add(g, new T.CylinderGeometry(17, 20, 9, 8), surface(color), [0, 10, 0]); mantle.name = 'stone-mantle';
    }
  }
  const band = add(g, new T.CylinderGeometry(18, 18, 2.5, 24), surface(s.accent, .4, .3), [0, 26, 0]); band.name = 'hat-band';
}

export function explorationProjectile(s: ArtStyle, r: number, ice: boolean) {
  const g = new T.Group(), c = ice ? s.ice : s.fire, core = ice ? s.iceCore : s.fireCore;
  const energy = (geo: T.BufferGeometry, color: number, opacity = 1, p?: number[]) => {
    const m = add(g, geo, light(color, opacity), p);
    if (s.family === 'photon') (m.material as T.MeshBasicMaterial).blending = T.AdditiveBlending;
    return m;
  };
  if (s.family === 'photon') {
    if (s.branch === 'wave') {
      // A compact wave packet: hollow shell, bright droplet core, swept arcs.
      const head = energy(new T.SphereGeometry(r * .6, 16, 10), core); head.scale.set(1.6, .8, .8);
      for (let i = 0; i < 3; i++) {
        const wave = energy(new T.TorusGeometry(r * (.6 + i * .22), r * .08, 5, 24, Math.PI * 1.6), c, .7 - i * .15, [-r * i * .7, 0, 0]); wave.rotation.y = Math.PI / 2;
      }
    } else {
      const head = energy(new T.OctahedronGeometry(r), core); head.scale.set(ice ? 3.5 : 2.5, .35, .35);
      const sheath = energy(new T.OctahedronGeometry(r), c, .3); sheath.scale.set(3.8, .75, .75);
      if (s.branch === 'vector') {
        for (const z of [-.7, .7]) { const rail = energy(new T.BoxGeometry(r * 2.8, r * .1, r * .1), c, .65, [-r, 0, z * r]); rail.rotation.y = z * .2; }
      } else {
        const bracket = energy(new T.TorusGeometry(r * .8, .65, 5, 24, Math.PI * 1.5), c, .65, [-r * 1.2, 0, 0]); bracket.rotation.y = Math.PI / 2;
      }
    }
  } else if (s.family === 'observatory') {
    const head = energy(new T.OctahedronGeometry(r), c); head.scale.set(ice ? 2.8 : 1.65, .65, .65); outline(g, head, core, .65);
    const hot = energy(new T.OctahedronGeometry(r * .55), core, 1, [r * .55, 0, r * .2]); hot.scale.set(1.9, .6, .6);
    if (s.branch === 'astral') {
      for (const z of [-.35, .35]) { const tail = energy(new T.ConeGeometry(r * .3, r * 3, 6), c, .7, [-r, 0, r * z]); tail.rotation.z = Math.PI / 2; }
      const orbit = hoop(g, r * 1.4, .7, s.accent, [0, 0, 0], .7); orbit.rotation.y = .7;
    } else if (s.branch === 'archive') {
      for (const a of [0, Math.PI / 2]) { const glyph = energy(new T.RingGeometry(r * .85, r, 4), s.accent, .8, [-r * .7, 0, 0]); glyph.rotation.set(0, Math.PI / 2, a); }
    } else { const orbit = hoop(g, r * 1.2, .8, s.accent, [0, 0, 0], .65); orbit.rotation.y = Math.PI / 3; }
  } else if (ice) {
    const head = add(g, new T.OctahedronGeometry(r), surface(c, .2, .15)); head.scale.set(2.6, .7, .7); outline(g, head, core, .8);
    const inner = energy(new T.OctahedronGeometry(r * .48), core, 1, [0, 0, r * .48]); inner.scale.set(2.7, .6, .6);
  } else {
    // Preserve the dense molten form the owner liked. Surroundings diverge
    // more strongly than the shared core spell silhouette in this family.
    const head = energy(new T.SphereGeometry(r, 7, 8), c); head.scale.set(1.5, .85, .85);
    energy(new T.SphereGeometry(r * .64, 7, 8), core, 1, [r * .65, 0, 0]);
    for (let i = 0; i < 3; i++) { const tail = energy(new T.ConeGeometry(r * (.45 - i * .08), r * (2.7 - i * .3), 7), i === 1 ? core : c, 1, [-r * (.7 + i * .15), (i - 1) * r * .5, 0]); tail.rotation.z = Math.PI / 2; }
    if (s.branch === 'geode') for (const z of [-r * .55, r * .55]) { const chip = energy(new T.TetrahedronGeometry(r * .3), c, .8, [-r, 0, z]); chip.rotation.y = z; }
  }
  return { group: g, update(time: number, frozen: boolean) { g.scale.setScalar(frozen ? .9 + .1 * Math.sin(time * 10) : 1); g.rotation.x = time * (s.branch === 'wave' ? 1.2 : 2); } };
}

export function explorationShard(s: ArtStyle) {
  const g = new T.Group();
  const body = add(g, new T.OctahedronGeometry(22), s.family === 'photon' ? light(s.ice, .28) : surface(s.ice, .19, .08));
  body.scale.set(.7, 3, .7); outline(g, body, s.iceCore, .8);
  if (s.family === 'photon') (body.material as T.MeshBasicMaterial).blending = T.AdditiveBlending;
  const core = add(g, new T.OctahedronGeometry(12), light(s.iceCore), [3, -4, 10]); core.scale.set(.65, 4, .35);
  if (s.branch === 'wave') for (const y of [-27, 0, 27]) { const r = hoop(g, 20, .7, s.iceCore, [0, y, 0], .5); r.rotation.x = Math.PI / 2; }
  if (s.family === 'observatory') { const orbit = hoop(g, 24, .7, s.accent, [0, 0, 0], .65); orbit.rotation.x = .9; }
  if (s.branch === 'archive') { const glyph = add(g, new T.RingGeometry(25, 26, 4), light(s.accent, .65)); glyph.rotation.x = Math.PI / 2; }
  if (s.family === 'foundry') for (const x of [-15, 16]) { const chip = add(g, new T.OctahedronGeometry(s.branch === 'geode' ? 13 : 10), surface(s.ice, .25), [x, 10, 2]); chip.scale.y = 3.2; outline(g, chip, s.iceCore, .45); }
  return g;
}
