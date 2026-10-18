import * as THREE from "three";
import { ARENA, CAMERA } from "./config";

export class GameRenderer {
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly resizeObserver: ResizeObserver;
  private width = 0;
  private height = 0;

  constructor(canvas: HTMLCanvasElement, options: { pixelRatio?: number; shadowMapSize?: number } = {}) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(options.pixelRatio ?? window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, CAMERA.near, CAMERA.far);
    const isoDistance = Math.max(ARENA.width, ARENA.depth, ARENA.height) * 2;
    const angle = Math.atan(Math.SQRT1_2);
    this.camera.position.set(
      isoDistance * Math.cos(angle) * Math.cos(Math.PI / 4),
      isoDistance * Math.sin(angle),
      isoDistance * Math.cos(angle) * Math.sin(Math.PI / 4)
    );
    this.camera.lookAt(0, ARENA.height / 2, 0);

    this.addLights(options.shadowMapSize ?? 2048);
    this.resize();
    // Grid columns, aspect ratios and hidden panels can change without a
    // window resize, including while playback is paused.
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(canvas);
  }

  private addLights(shadowMapSize: number): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 0.35);
    key.position.set(-ARENA.width * 0.6, ARENA.height * 2.5, ARENA.depth * 0.6);
    key.target.position.set(0, 0, 0);
    this.scene.add(key);
    this.scene.add(key.target);

    const spot = new THREE.SpotLight(0xffffff, 3.5);
    spot.position.set(ARENA.width * 0.3, ARENA.height * 3, ARENA.depth * 0.3);
    spot.target.position.set(0, 0, 0);
    spot.angle = Math.PI / 3;
    spot.penumbra = 0.2;
    spot.decay = 0;
    spot.distance = 0;
    spot.castShadow = true;
    spot.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    spot.shadow.camera.near = 1;
    spot.shadow.camera.far = ARENA.height * 4;
    spot.shadow.bias = 0;
    spot.shadow.normalBias = 0.05;
    this.scene.add(spot);
    this.scene.add(spot.target);
  }

  private resize(): boolean {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    if (w === this.width && h === this.height) return true;
    this.width = w; this.height = h;
    this.renderer.setSize(w, h, false);

    const aspect = w / h;
    const { width, depth, height } = ARENA;
    const corners: THREE.Vector3[] = [];
    for (const x of [-width / 2, width / 2]) {
      for (const y of [0, height]) {
        for (const z of [-depth / 2, depth / 2]) {
          corners.push(new THREE.Vector3(x, y, z));
        }
      }
    }
    this.camera.updateMatrixWorld();
    const view = new THREE.Matrix4().copy(this.camera.matrixWorldInverse);
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const c of corners) {
      const v = c.clone().applyMatrix4(view);
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    }
    const projWidth = maxX - minX;
    const projHeight = maxY - minY;
    const viewHeight =
      Math.max(projHeight, projWidth / aspect) * CAMERA.viewMargin;
    const viewWidth = viewHeight * aspect;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    this.camera.left = cx - viewWidth / 2;
    this.camera.right = cx + viewWidth / 2;
    this.camera.top = cy + viewHeight / 2;
    this.camera.bottom = cy - viewHeight / 2;
    this.camera.updateProjectionMatrix();
    return true;
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.renderer.dispose();
  }

  render(): void {
    // Synchronize before drawing too: a layout change can precede the next
    // observer callback. Hidden canvases retain their last usable size.
    if (!this.resize()) return;
    this.renderer.render(this.scene, this.camera);
  }
}
