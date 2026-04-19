import * as THREE from "three";
import { ARENA } from "./config";

export function buildArena(): THREE.Group {
  const group = new THREE.Group();
  const { width, depth, height } = ARENA;

  const ARENA_COLOR = 0xf0ece4;
  const GRID_COLOR = 0xb8b2a4;
  const EDGE_COLOR = 0x555555;
  const GRID_CELL = 50;

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x777777,
    emissive: ARENA_COLOR,
    emissiveIntensity: 0.65,
    roughness: 1,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1;
  floor.receiveShadow = true;
  group.add(floor);
  const gridLines = makeGridLines(width, depth, GRID_CELL, GRID_COLOR, "xz");
  gridLines.position.y = 0.1;
  group.add(gridLines);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x555555,
    emissive: ARENA_COLOR,
    emissiveIntensity: 0.8,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
  backWall.position.set(0, height / 2, -depth / 2);
  backWall.receiveShadow = true;
  group.add(backWall);
  const backGrid = makeGridLines(width, height, GRID_CELL, GRID_COLOR, "xy");
  backGrid.position.set(0, height / 2, -depth / 2 + 0.1);
  group.add(backGrid);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-width / 2, height / 2, 0);
  leftWall.receiveShadow = true;
  group.add(leftWall);
  const leftGrid = makeGridLines(depth, height, GRID_CELL, GRID_COLOR, "xy");
  leftGrid.rotation.y = Math.PI / 2;
  leftGrid.position.set(-width / 2 + 0.1, height / 2, 0);
  group.add(leftGrid);

  const edgeMat = new THREE.LineBasicMaterial({ color: EDGE_COLOR });
  const prismEdges = new THREE.EdgesGeometry(
    new THREE.BoxGeometry(width, height, depth)
  );
  const prismLines = new THREE.LineSegments(prismEdges, edgeMat);
  prismLines.position.y = height / 2;
  group.add(prismLines);

  return group;
}

function makeGridLines(
  sizeA: number,
  sizeB: number,
  cell: number,
  color: number,
  plane: "xz" | "xy"
): THREE.LineSegments {
  const positions: number[] = [];
  const halfA = sizeA / 2;
  const halfB = sizeB / 2;
  const toVec = (a: number, b: number): [number, number, number] =>
    plane === "xz" ? [a, 0, b] : [a, b, 0];

  for (let a = -halfA; a <= halfA + 0.001; a += cell) {
    positions.push(...toVec(a, -halfB), ...toVec(a, halfB));
  }
  for (let b = -halfB; b <= halfB + 0.001; b += cell) {
    positions.push(...toVec(-halfA, b), ...toVec(halfA, b));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color }));
}
