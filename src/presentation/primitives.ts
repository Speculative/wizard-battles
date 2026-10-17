import * as THREE from 'three';

export function glow(color: number, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity,
    side: THREE.DoubleSide, depthWrite: false });
}

export function ring(radius: number, color: number, opacity = 0.6): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(radius * 0.94, radius, 48), glow(color, opacity));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.5;
  return mesh;
}

/** Disposal belongs to the view that allocated these geometries and materials. */
export function disposeObject(object: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  object.traverse(node => {
    const drawable = node as THREE.Mesh;
    if (drawable.geometry) geometries.add(drawable.geometry);
    if (drawable.material) for (const material of Array.isArray(drawable.material) ? drawable.material : [drawable.material]) materials.add(material);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  object.removeFromParent();
}
