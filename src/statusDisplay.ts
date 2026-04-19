import * as THREE from "three";

const BAR_WIDTH = 60;
const BAR_HEIGHT = 5;
const BAR_GAP = 2;
const BG_COLOR = 0x222222;
const HP_COLOR_FULL = new THREE.Color(0x44cc44);
const HP_COLOR_LOW = new THREE.Color(0xcc3322);
const STAMINA_COLOR = 0xffaa33;

interface Segment {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
}

function makeSegment(color: number): Segment {
  const geo = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({
    color,
    depthTest: false,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.renderOrder = 10;
  return { mesh, material };
}

export class StatusDisplay {
  readonly group = new THREE.Group();
  private readonly hpBg: Segment;
  private readonly hpFill: Segment;
  private readonly staminaBg: Segment;
  private readonly staminaFill: Segment;
  private readonly tmpColor = new THREE.Color();

  constructor() {
    this.hpBg = makeSegment(BG_COLOR);
    this.hpFill = makeSegment(0x44cc44);
    this.staminaBg = makeSegment(BG_COLOR);
    this.staminaFill = makeSegment(STAMINA_COLOR);

    const hpY = BAR_HEIGHT + BAR_GAP;
    this.hpBg.mesh.position.y = hpY;
    this.hpFill.mesh.position.y = hpY;
    this.staminaBg.mesh.position.y = 0;
    this.staminaFill.mesh.position.y = 0;

    this.group.add(
      this.hpBg.mesh,
      this.hpFill.mesh,
      this.staminaBg.mesh,
      this.staminaFill.mesh
    );
  }

  update(
    hp01: number,
    stamina01: number,
    position: THREE.Vector3,
    yOffset: number,
    cameraQuaternion: THREE.Quaternion
  ): void {
    this.group.position.set(position.x, position.y + yOffset, position.z);
    this.group.quaternion.copy(cameraQuaternion);

    this.setBar(this.hpBg, BAR_WIDTH, BAR_HEIGHT, 0);
    const hpW = Math.max(0, hp01) * BAR_WIDTH;
    this.setBar(this.hpFill, hpW, BAR_HEIGHT, -(BAR_WIDTH - hpW) / 2);
    this.tmpColor.copy(HP_COLOR_LOW).lerp(HP_COLOR_FULL, Math.max(0, hp01));
    this.hpFill.material.color.copy(this.tmpColor);

    this.setBar(this.staminaBg, BAR_WIDTH, BAR_HEIGHT, 0);
    const stamW = Math.max(0, Math.min(1, stamina01)) * BAR_WIDTH;
    this.setBar(this.staminaFill, stamW, BAR_HEIGHT, -(BAR_WIDTH - stamW) / 2);
  }

  private setBar(seg: Segment, w: number, h: number, xOffset: number): void {
    seg.mesh.scale.set(Math.max(0.0001, w), h, 1);
    seg.mesh.position.x = xOffset;
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }
}
