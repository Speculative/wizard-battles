import * as THREE from "three";

const BAR_WIDTH = 60;
const BAR_HEIGHT = 5;
const BAR_GAP = 2;
const BG_COLOR = 0x222222;
const HP_COLOR_FULL = new THREE.Color(0x44cc44);
const HP_COLOR_LOW = new THREE.Color(0xcc3322);
const VIGOR_COLOR = 0x4488cc;
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
  private readonly resBg: Segment;
  private readonly vigorFill: Segment;
  private readonly staminaFill: Segment;
  private readonly tmpColor = new THREE.Color();

  constructor() {
    this.hpBg = makeSegment(BG_COLOR);
    this.hpFill = makeSegment(0x44cc44);
    this.resBg = makeSegment(BG_COLOR);
    this.vigorFill = makeSegment(VIGOR_COLOR);
    this.staminaFill = makeSegment(STAMINA_COLOR);

    const hpY = BAR_HEIGHT + BAR_GAP;
    this.hpBg.mesh.position.y = hpY;
    this.hpFill.mesh.position.y = hpY;
    this.resBg.mesh.position.y = 0;
    this.vigorFill.mesh.position.y = 0;
    this.staminaFill.mesh.position.y = 0;

    this.group.add(
      this.hpBg.mesh,
      this.hpFill.mesh,
      this.resBg.mesh,
      this.vigorFill.mesh,
      this.staminaFill.mesh
    );
  }

  update(
    hp01: number,
    vigor01: number,
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

    const vigorMaxW = BAR_WIDTH * 0.7;
    const staminaMaxW = BAR_WIDTH * 0.3;
    const totalMaxW = vigorMaxW + staminaMaxW;
    this.setBar(this.resBg, totalMaxW, BAR_HEIGHT, 0);
    const vigorW = Math.max(0, Math.min(1, vigor01)) * vigorMaxW;
    this.setBar(this.vigorFill, vigorW, BAR_HEIGHT, -(totalMaxW - vigorW) / 2);

    const stamW = Math.max(0, Math.min(1, stamina01)) * staminaMaxW;
    if (stamW > 0.5) {
      this.staminaFill.mesh.visible = true;
      this.setBar(
        this.staminaFill,
        stamW,
        BAR_HEIGHT,
        vigorW - totalMaxW / 2 + stamW / 2
      );
    } else {
      this.staminaFill.mesh.visible = false;
    }
  }

  private setBar(seg: Segment, w: number, h: number, xOffset: number): void {
    seg.mesh.scale.set(Math.max(0.0001, w), h, 1);
    seg.mesh.position.x = xOffset;
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }
}
