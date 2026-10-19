import * as THREE from 'three';
import type { World, SimulationEvent } from '../world';
import type { Contestant } from '../contestants/contestant';
import type { Spell } from '../spells/spell';
import { Projectile } from '../spells/projectile';
import { IceShard } from '../spells/iceShard';
import { MeleeAttack } from '../spells/meleeAttack';
import { ProjectileSlowField } from '../spells/projectileSlowField';
import { Charging, Channeling } from '../components';
import { seededRandom } from '../random';
import { StatusDisplay } from '../statusDisplay';
import { createTelegraph } from './telegraph';
import { glow, ring, disposeObject } from './primitives';
import { artStyle, artFamily, fighterColor, styleFigure, artProjectile, artShard, type ArtDirection } from './artDirection';
import { preparationPointer, semanticCue, revisedSemanticCue, type SpellReadability } from './spellCues';

interface View { group: THREE.Group; update(): void; dispose(): void }
interface TrailSample { t: number; x: number; y: number; z: number }
export interface VisualOptions { effects?: boolean; trails?: boolean; visualSeed?: number; spellReadability?: SpellReadability; artDirection?: ArtDirection }
const EFFECT_LIFETIME = 0.65;
const TRAIL_HISTORY = 0.2;

/** An observer. No simulation mutation, gameplay RNG consumption, or wall-clock effects. */
export class BattleView {
  readonly group = new THREE.Group();
  private readonly contestants = new Map<Contestant, View>();
  private readonly spells = new Map<Spell, View>();
  private readonly effects = new Map<number, View>();
  private readonly trails = new Map<Spell, TrailSample[]>();
  private lastTick = -1;
  private readonly options: Required<Omit<VisualOptions, 'artDirection'>> & Pick<VisualOptions, 'artDirection'>;

  readonly world: World;
  private readonly camera: THREE.Camera;
  constructor(world: World, camera: THREE.Camera, options: VisualOptions = {}) {
    this.world = world;
    this.camera = camera;
    this.options = { effects: options.effects ?? true, trails: options.trails ?? true,
      visualSeed: options.visualSeed ?? (world.seed ^ 0x5f3759df), spellReadability: options.spellReadability ?? false, artDirection: options.artDirection };
  }

  /** Call once after each simulation tick, even when no frame is rendered. */
  recordTick(): void {
    if (this.lastTick === this.world.tick) return;
    this.lastTick = this.world.tick;
    const active = new Set(this.world.spells);
    for (const spell of this.trails.keys()) if (!active.has(spell)) this.trails.delete(spell);
    if (!this.options.trails) return;
    for (const spell of this.world.spells) {
      if (!(spell instanceof Projectile) || spell.frozen || spell.emitterActive) continue;
      const history = this.trails.get(spell) ?? [];
      const { x, y, z } = spell.position;
      history.push({ t: this.world.time, x, y, z });
      while (history.length && history[0].t < this.world.time - TRAIL_HISTORY) history.shift();
      this.trails.set(spell, history);
    }
  }

  render(): void {
    const contestants = new Set(this.world.contestants);
    for (const [contestant, view] of this.contestants) if (!contestants.has(contestant)) { view.dispose(); this.contestants.delete(contestant); }
    for (const c of this.world.contestants) {
      if (!this.contestants.has(c)) this.contestants.set(c, this.makeContestant(c));
      this.contestants.get(c)!.update();
    }
    const active = new Set(this.world.spells);
    for (const [spell, view] of this.spells) if (!active.has(spell)) { view.dispose(); this.spells.delete(spell); }
    for (const spell of this.world.spells) {
      if (!this.spells.has(spell)) this.spells.set(spell, this.makeSpell(spell));
      this.spells.get(spell)!.update();
    }
    if (this.options.effects) for (const event of this.world.events) {
      if (this.world.time - event.t > EFFECT_LIFETIME) continue;
      const duplicateRelease = typeof this.options.spellReadability === 'string' && event.type === 'cast_release' &&
        this.world.events.some(e => e.type === 'projectile_emit' && e.who === event.who && e.t === event.t);
      const cue = this.options.spellReadability && !duplicateRelease && ['damage', 'cast_release', 'projectile_emit'].includes(event.type);
      if (event.type !== 'spell_impact' && event.type !== 'blink' && !cue) continue;
      if (!this.effects.has(event.seq)) {
        if (cue) {
          const mode = this.options.spellReadability;
          const effect = typeof mode === 'string' ? revisedSemanticCue(event, mode, this.camera, artStyle(this.options.artDirection)) : semanticCue(event);
          this.effects.set(event.seq, this.view(effect.group, () => effect.update(this.world.time - event.t)));
        } else this.effects.set(event.seq, this.makeEffect(event));
      }
    }
    for (const [seq, effect] of this.effects) {
      const event = this.world.events.find(event => event.seq === seq);
      if (!event || this.world.time - event.t > EFFECT_LIFETIME) { effect.dispose(); this.effects.delete(seq); }
      else effect.update();
    }
  }

  dispose(): void {
    for (const collection of [this.contestants, this.spells, this.effects]) {
      for (const view of collection.values()) view.dispose();
      collection.clear();
    }
    this.trails.clear();
    this.group.removeFromParent();
  }

  private view(group: THREE.Group, update: () => void): View {
    this.group.add(group);
    return { group, update, dispose: () => disposeObject(group) };
  }

  private makeContestant(c: Contestant): View {
    const group = new THREE.Group();
    const revised = typeof this.options.spellReadability === 'string';
    const body = new THREE.Mesh(new THREE.SphereGeometry(c.radius, artFamily(artStyle(this.options.artDirection)) === 'paper' ? 8 : 24, artFamily(artStyle(this.options.artDirection)) === 'paper' ? 6 : 16), new THREE.MeshToonMaterial({ color: c.color }));
    body.castShadow = true;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(c.radius * 1.05, c.radius * 1.7, artFamily(artStyle(this.options.artDirection)) === 'paper' ? 6 : 16), new THREE.MeshToonMaterial({ color: c.color }));
    hat.position.y = c.radius * 1.5;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(c.radius * 1.3, c.radius * 1.3, 3, 24), new THREE.MeshToonMaterial({ color: c.color }));
    brim.position.y = c.radius * 0.8;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(5, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffdda8 }));
    nose.rotation.z = -Math.PI / 2;
    nose.position.x = c.radius;
    const style = artStyle(this.options.artDirection);
    const color = style ? fighterColor(style, c.id) : c.color;
    const figure = new THREE.Group();
    figure.name = `fighter:${c.id}`;
    figure.add(body, hat, brim, nose);
    if (style) styleFigure(figure, style, c.id);
    const charge = ring(c.radius * 1.4, color);
    const timer = ring(c.radius * 1.65, style?.accent ?? 0xffffff);
    timer.name = 'preparation-progress';
    const track = ring(c.radius * 1.7, style?.line ?? 0x172333, 0.9);
    track.geometry.dispose();
    track.geometry = new THREE.RingGeometry(c.radius * 1.49, c.radius * 1.7, 48);
    const status = new StatusDisplay();
    group.add(figure, charge, track, timer, status.group);
    const contact = style ? new THREE.Mesh(new THREE.CircleGeometry(c.radius*1.15, 32), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { tint: { value: new THREE.Color(artFamily(style) === 'photon' ? color : 0x14202b) }, strength: { value: artFamily(style) === 'photon' ? 0.24 : 0.18 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec2 vUv; uniform vec3 tint; uniform float strength; void main(){float a=1.0-smoothstep(0.05,0.5,length(vUv-0.5));gl_FragColor=vec4(tint,a*strength);}',
    })) : undefined;
    if (contact) { contact.rotation.x = -Math.PI/2; group.add(contact); }
    return this.view(group, () => {
      group.visible = c.alive;
      contact?.position.set(c.position.x, 0.15, c.position.z);
      figure.position.set(c.position.x, c.position.y + Math.sin(this.world.time * 3 + c.color) * 2, c.position.z);
      const hit = this.options.spellReadability === 'reaction' && this.options.effects
        ? this.world.events.findLast(e => e.type === 'damage' && e.meta.victim === c.id && this.world.time - e.t < 0.2) : undefined;
      const reaction = hit ? Math.max(0, 1 - (this.world.time - hit.t) / 0.2) : 0;
      for (const mesh of [body, hat, brim]) {
        const mat = mesh.material as THREE.MeshToonMaterial | THREE.MeshStandardMaterial;
        mat.emissive.setHex(reaction ? 0xffd6a0 : color); mat.emissiveIntensity = reaction * 0.85 + (artFamily(style) === 'photon' ? 0.22 : 0);
      }
      figure.scale.set(1 + reaction * 0.12, 1 - reaction * 0.16, 1 + reaction * 0.12);
      figure.rotation.y = -Math.atan2(c.facing.z, c.facing.x);
      const charging = c.getComponent(Charging) ?? c.getComponent(Channeling);
      charge.visible = !!charging;
      charge.position.set(c.position.x, 0.5, c.position.z);
      timer.visible = this.options.spellReadability && this.options.effects && !!charging;
      timer.position.set(c.position.x, 0.7, c.position.z);
      track.visible = timer.visible;
      track.position.set(c.position.x, 0.6, c.position.z);
      if (charging) {
        const progress = Math.max(0, Math.min(1, 1 - charging.remaining / Math.max(0.001, charging.totalDuration)));
        charge.scale.setScalar(0.7 + progress * 0.3);
        (charge.material as THREE.MeshBasicMaterial).opacity = 0.3 + progress * 0.6;
        if (revised) {
          const fade = Math.min(1, (charging.totalDuration - charging.remaining) / 0.14);
          (track.material as THREE.MeshBasicMaterial).opacity = 0.35 * fade;
          (timer.material as THREE.MeshBasicMaterial).opacity = 0.8 * fade;
          (charge.material as THREE.MeshBasicMaterial).opacity *= fade;
        }
        timer.geometry.setDrawRange(0, Math.floor(progress * 48) * 6);
      }
      const stamina = 'stamina01' in c ? (c as Contestant & { stamina01(): number }).stamina01() : 1;
      status.update(c.hp / 100, stamina, new THREE.Vector3(c.position.x, c.position.y, c.position.z), c.radius * 3.1, this.camera.quaternion);
    });
  }

  private makeSpell(spell: Spell): View {
    if (spell instanceof Projectile) return this.projectile(spell);
    if (spell instanceof IceShard) return this.iceShard(spell);
    if (spell instanceof ProjectileSlowField) return this.field(spell);
    if (spell instanceof MeleeAttack) return this.melee(spell);
    return this.view(new THREE.Group(), () => {});
  }

  private projectile(s: Projectile): View {
    const group = new THREE.Group();
    group.name = `projectile:${s.caster.id}:${s.metadata.id}`;
    const head = new THREE.Group();
    head.name = "head";
    const shape = s.spec.visual.shape;
    const style = artStyle(this.options.artDirection);
    const artwork = style ? artProjectile(style, s.spec.radius, shape.kind !== 'fire-spheres') : undefined;
    if (artwork) head.add(artwork.group);
    else if (shape.kind === 'fire-spheres') for (const layer of shape.layers) {
      head.add(new THREE.Mesh(new THREE.SphereGeometry(s.spec.radius * layer.scale, 12, 8), glow(layer.color, layer.opacity)));
    } else {
      const body = new THREE.Mesh(new THREE.OctahedronGeometry(s.spec.radius), glow(typeof this.options.spellReadability === 'string' ? 0x2388c7 : shape.bodyColor, typeof this.options.spellReadability === 'string' ? 0.8 : 0.65));
      body.scale.set(shape.lengthScale ?? 2.4, shape.widthScale ?? 0.55, shape.widthScale ?? 0.55);
      head.add(body);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: typeof this.options.spellReadability === 'string' ? 0x123958 : shape.edgeColor }));
      edge.scale.copy(body.scale);
      head.add(edge);
    }
    const trail: THREE.Mesh[] = [];
    if (this.options.trails) for (let i = 0; i < 7; i++) {
      const r = s.spec.radius * (s.spec.visual.trailScale ?? 0.7);
      const geometry = artFamily(style) === 'paper' ? new THREE.PlaneGeometry(r*1.7, r*1.7) : artFamily(style) === 'photon' ? new THREE.OctahedronGeometry(r*0.7) : new THREE.SphereGeometry(r, 8, 6);
      const node = new THREE.Mesh(geometry, glow(style ? (shape.kind === 'fire-spheres' ? style.fire : style.ice) : s.spec.visual.trailColor, 0.3));
      trail.push(node); group.add(node);
    }
    const telegraph = s.spec.telegraph ? createTelegraph(style ? { ...s.spec.telegraph, color: shape.kind === 'fire-spheres' ? style.fire : style.ice } : s.spec.telegraph) : null;
    if (style && telegraph) telegraph.mesh.traverse(node => {
      if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshBasicMaterial && artFamily(style) !== 'photon') node.material.blending = THREE.NormalBlending;
    });
    const pointer = preparationPointer(style ? fighterColor(style, s.caster.id) : s.caster.color);
    group.add(pointer);
    group.add(head);
    if (telegraph) { telegraph.mesh.name = "telegraph"; group.add(telegraph.mesh); }
    return this.view(group, () => {
      head.visible = !s.emitterActive;
      artwork?.update(this.world.time, s.frozen);
      head.position.set(s.position.x, s.position.y, s.position.z);
      head.rotation.y = -Math.atan2(s.velocity.z, s.velocity.x);
      pointer.visible = this.options.spellReadability && this.options.effects && (s.frozen || s.emitterActive);
      pointer.position.set(s.caster.position.x, 0.8, s.caster.position.z);
      const direction = s.emitterActive ? s.emitterBaseDir : s.position.clone().sub(s.caster.position);
      pointer.rotation.y = -Math.atan2(direction.z, direction.x);
      if (telegraph) {
        const groundTarget = s.spec.telegraph?.kind === 'ground-circle';
        telegraph.mesh.visible = groundTarget ? !!s.detonateAt : s.frozen || s.emitterActive;
        const charging = s.caster.getComponent(Charging) ?? s.caster.getComponent(Channeling);
        const progress = charging ? Math.max(0, Math.min(1, 1 - charging.remaining / charging.totalDuration)) : 1;
        const origin = groundTarget && s.detonateAt ?
          new THREE.Vector3(s.detonateAt.x, 0, s.detonateAt.z) :
          new THREE.Vector3(s.caster.position.x, s.caster.position.y, s.caster.position.z);
        const aim = s.emitterActive ? s.emitterBaseDir : s.frozen ?
          s.position.clone().sub(s.caster.position) : s.velocity;
        telegraph.update(origin, new THREE.Vector3(aim.x, 0, aim.z), progress,
          s.spec.emission ? { fired: s.emitterFired, total: s.spec.emission.count } : undefined);
      }
      const samples = this.trails.get(s) ?? [];
      for (let i = 0; i < trail.length; i++) {
        const sample = samples[Math.max(0, samples.length - 2 - i * 2)];
        trail[i].visible = this.options.effects && !s.frozen && !s.emitterActive && !!sample;
        if (sample) {
          trail[i].position.set(sample.x, sample.y, sample.z);
          trail[i].scale.setScalar(1 - i / 8);
          if (artFamily(style) === 'paper') { trail[i].quaternion.copy(this.camera.quaternion); trail[i].rotateZ(this.world.time*4+i); }
          if (artFamily(style) === 'photon') trail[i].scale.set(1.8*(1-i/8), 0.3, 0.3);
          (trail[i].material as THREE.MeshBasicMaterial).opacity = (s.spec.visual.trailOpacity ?? 0.3) * (1 - i / 8);
        }
      }
    });
  }

  private iceShard(s: IceShard): View {
    const group = new THREE.Group();
    const style = artStyle(this.options.artDirection);
    const area = ring(s.spec.aoe.radius, style?.ice ?? s.spec.visual.telegraphColor);
    const portal = ring(s.spec.aoe.radius * 0.4, style?.iceCore ?? s.spec.visual.portalColor);
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(22), glow(s.spec.visual.shardColor, 0.7));
    shard.scale.set(0.7, 3, 0.7);
    const revised = typeof this.options.spellReadability === 'string';
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(shard.geometry), new THREE.LineBasicMaterial({ color: 0x174b79 }));
    edge.scale.copy(shard.scale); edge.visible = revised && !style;
    shard.add(edge); edge.scale.setScalar(1);
    const areaBacking = ring(s.spec.aoe.radius * 1.025, 0x174b79, 0.45);
    areaBacking.visible = revised && !style;
    const artwork = style ? artShard(style) : undefined;
    if (artwork) { shard.material.visible = false; shard.add(artwork); artwork.scale.set(1/0.7, 1/3, 1/0.7); }
    group.add(areaBacking, area, portal, shard);
    return this.view(group, () => {
      group.position.set(s.impactPos.x, 0, s.impactPos.z);
      const progress = s.frozen ? Math.min(1, s.chargeAge / s.spec.chargeTime) : 1;
      // Outline always shows the full authoritative damage area; opacity encodes readiness.
      (area.material as THREE.MeshBasicMaterial).opacity = s.state === 'impacted' ? 0.4 * (1 - s.fadeAge / 0.6) : 0.25 + progress * 0.5;
      (areaBacking.material as THREE.MeshBasicMaterial).opacity = (area.material as THREE.MeshBasicMaterial).opacity * 0.65;
      portal.position.y = s.spec.portalHeight;
      portal.scale.setScalar(progress);
      portal.rotation.z = this.world.time * 0.6;
      portal.visible = s.state !== 'impacted';
      shard.visible = s.state === 'descending';
      shard.position.y = Math.max(0, s.spec.portalHeight - s.descentAge * s.spec.descentSpeed);
      shard.rotation.y = s.descentAge * 1.4;
    });
  }

  private field(s: ProjectileSlowField): View {
    const group = new THREE.Group();
    group.name = `field:${s.caster.id}`;
    const style = artStyle(this.options.artDirection);
    const area = ring(s.radius, style?.iceCore ?? 0x88ccff);
    area.name = 'area';
    const dome = new THREE.Mesh(new THREE.SphereGeometry(s.radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), glow(style?.ice ?? 0x66aaff, 0.18));
    dome.name = 'dome';
    dome.scale.y = s.height / s.radius;
    group.add(area, dome);
    return this.view(group, () => {
      group.visible = !s.frozen;
      group.position.set(s.position.x, 0, s.position.z);
      const fade = Math.min(1, s.age / 0.2, (s.duration - s.age) / 0.4);
      (area.material as THREE.MeshBasicMaterial).opacity = Math.max(0, fade) * 0.65;
      (dome.material as THREE.MeshBasicMaterial).opacity = Math.max(0, fade) * 0.18;
    });
  }

  private melee(s: MeleeAttack): View {
    const group = new THREE.Group();
    // Collision tests surface distance, so the displayed sector includes caster radius.
    const geometry = new THREE.RingGeometry(s.caster.radius, s.reach + s.caster.radius, 28, 1, -s.coneHalfAngle, s.coneHalfAngle * 2);
    geometry.rotateX(-Math.PI / 2);
    const arc = new THREE.Mesh(geometry, glow(0xb9e5ff, 0.5));
    const revised = typeof this.options.spellReadability === 'string';
    const style = artStyle(this.options.artDirection);
    const rimGeometry = new THREE.RingGeometry(s.reach + s.caster.radius - 4, s.reach + s.caster.radius, 28, 1, -s.coneHalfAngle, s.coneHalfAngle * 2);
    rimGeometry.rotateX(-Math.PI / 2);
    const rim = new THREE.Mesh(rimGeometry, glow(style?.fire ?? 0x8c341b));
    rim.position.y = 1;
    const pointer = preparationPointer(s.caster.color);
    group.add(pointer, rim);
    group.add(arc);
    return this.view(group, () => {
      group.position.set(s.caster.position.x, s.caster.position.y * 0.6, s.caster.position.z);
      group.rotation.y = -Math.atan2(s.aim.z, s.aim.x);
      arc.visible = !s.frozen && s.age < s.swingDuration;
      pointer.visible = this.options.spellReadability && this.options.effects && s.frozen;
      rim.visible = revised && arc.visible;
      (rim.material as THREE.MeshBasicMaterial).opacity = 0.9 * Math.sin(Math.PI * s.age / s.swingDuration);
      if (revised) (arc.material as THREE.MeshBasicMaterial).color.setHex(style?.fireCore ?? 0xffbc79);
      (arc.material as THREE.MeshBasicMaterial).opacity = 0.65 * Math.sin(Math.PI * s.age / s.swingDuration);
    });
  }

  private makeEffect(event: SimulationEvent): View {
    const group = new THREE.Group();
    const random = seededRandom((this.options.visualSeed ^ event.seq) >>> 0);
    const meta = event.meta;
    const isBlink = event.type === 'blink';
    const visual = meta.visual as { impact?: { explosionCoreColor?: number }; impactCoreColor?: number } | undefined;
    const style = artStyle(this.options.artDirection);
    const ice = String(meta.spell).toLowerCase().includes('ice');
    const color = style ? (isBlink ? style.accent : ice ? style.iceCore : style.fire) : isBlink ? 0xb69aff : visual?.impact?.explosionCoreColor ?? visual?.impactCoreColor ?? (String(meta.spell).toLowerCase().includes('ice') ? 0x99ddff : 0xff7722);
    const centers = isBlink ? [meta.from, meta.to] : [meta.position];
    const particles: Array<{ mesh: THREE.Mesh; x: number; y: number; z: number; vx: number; vy: number; vz: number }> = [];
    for (const center of centers) {
      const p = center as { x: number; y: number; z: number };
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) continue;
      for (let i = 0; i < 18; i++) {
        const angle = random() * Math.PI * 2;
        const speed = 40 + random() * Math.max(70, Number(meta.radius ?? 30) * 2);
        const mesh = new THREE.Mesh(artFamily(style) === 'paper' ? new THREE.BoxGeometry(5, 9, 1) : artFamily(style) === 'photon' ? new THREE.OctahedronGeometry(3) : new THREE.TetrahedronGeometry(2 + random() * 5), glow(color, 0.7));
        particles.push({ mesh, x: p.x, y: p.y ?? 8, z: p.z, vx: Math.cos(angle) * speed, vy: 40 + random() * 90, vz: Math.sin(angle) * speed });
        group.add(mesh);
      }
    }
    return this.view(group, () => {
      const age = this.world.time - event.t;
      for (const particle of particles) {
        particle.mesh.position.set(particle.x + particle.vx * age, Math.max(0, particle.y + particle.vy * age - 120 * age * age), particle.z + particle.vz * age);
        particle.mesh.rotation.set(age * 3, age * 5, age * 2);
        (particle.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * Math.max(0, 1 - age / EFFECT_LIFETIME);
      }
    });
  }
}
