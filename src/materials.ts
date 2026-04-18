import * as THREE from "three";

let toonGradient: THREE.Texture | null = null;

export function makeOutline(
  geometry: THREE.BufferGeometry,
  scale = 1.05,
  color = 0x111111
): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.scale.setScalar(scale);
  return mesh;
}

export function getToonGradient(): THREE.Texture {
  if (toonGradient) return toonGradient;
  const steps = 16;
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const shaped = t * t * (3 - 2 * t);
    data[i] = Math.round(100 + shaped * 155);
  }
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  toonGradient = tex;
  return tex;
}
