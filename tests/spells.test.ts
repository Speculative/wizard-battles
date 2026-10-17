import assert from 'node:assert/strict';
import test from 'node:test';
import { World } from '../src/world';
import { Vector3 } from '../src/math';
import type { Contestant } from '../src/contestants/contestant';
import { Projectile } from '../src/spells/projectile';
import { FIREBALL_SPEC, FireballFactory } from '../src/spells/fireball';
import { Spread, Heavy } from '../src/spells/modifiers';
import { ProjectileSlowField } from '../src/spells/projectileSlowField';
import { IceShardFactory, IceShard, ICE_SHARD_SPEC } from '../src/spells/iceShard';
import { Blink } from '../src/spells/blink';
import { MeleeAttack } from '../src/spells/meleeAttack';

function actor(world: World, id: string, x = 0, z = 0): Contestant {
  const c: Contestant = { world, id, color: 0xffffff, position: new Vector3(x, 10, z),
    velocity: new Vector3(), facing: new Vector3(1, 0, 0), radius: 10, hp: 100,
    alive: true, update() {}, getComponent() { return undefined; }, addComponent() {}, removeComponent() {} };
  world.addContestant(c);
  return c;
}
function shot(c: Contestant, x = 0, y = 10) {
  return new Projectile(c, new Vector3(1, 0, 0), new Vector3(x, y, 0), FIREBALL_SPEC);
}

test('projectile frozen charge cannot damage; launch impacts once and world removes it', () => {
  const w = new World(); const c = actor(w, 'caster'); const target = actor(w, 'target', 20);
  const p = shot(c); p.frozen = true; w.addSpell(p); w.update(0.1);
  assert.equal(target.hp, 100); assert.equal(p.chargeAge, 0.1); assert.equal(p.position.x, 0);
  p.frozen = false; w.update(0.05);
  assert.equal(target.hp, 90); assert.equal(w.spells.length, 0);
  assert.equal(w.events.filter(e => e.type === 'spell_impact').length, 1);
});

test('instant spread emits every child in one update and cloned specs isolate mutations', () => {
  const w = new World(); const c = actor(w, 'caster');
  const spec = Spread.apply(FIREBALL_SPEC);
  const p = new Projectile(c, new Vector3(1, 0, 0), c.position, spec);
  p.setVelocityFromDirection(new Vector3(1, 0, 0)); w.addSpell(p); w.update(1 / 60);
  assert.equal(w.spells.length, spec.emission!.count); assert.ok(p.dead);
  p.spec.visual.trailColor = 0; assert.notEqual(FIREBALL_SPEC.visual.trailColor, 0);
});

test('heavy impact applies radial falloff once including the caster', () => {
  const w = new World(); const c = actor(w, 'caster'); const target = actor(w, 'target', 40);
  const p = new Projectile(c, new Vector3(1, 0, 0), new Vector3(30, 10, 0), Heavy.apply(FIREBALL_SPEC));
  w.addSpell(p); w.update(0.01);
  assert.ok(target.hp < 100); assert.ok(c.hp < 100);
  const hp = target.hp; w.update(0.01); assert.equal(target.hp, hp);
});

test('overlapping slow fields compose; expiry restores only that field and respects dome height', () => {
  const w = new World(); const c = actor(w, 'caster'); const p = shot(c);
  const high = shot(c, 0, 150); w.addSpell(p); w.addSpell(high);
  const a = new ProjectileSlowField(c, c.position), b = new ProjectileSlowField(c, c.position);
  a.update(0.1, w); b.update(0.1, w);
  assert.equal(p.velocity.x, FIREBALL_SPEC.speed * 0.25 ** 2);
  assert.equal(high.velocity.x, FIREBALL_SPEC.speed);
  a.update(4, w); assert.equal(p.velocity.x, FIREBALL_SPEC.speed * 0.25);
  b.update(4, w); assert.equal(p.velocity.x, FIREBALL_SPEC.speed);
  assert.equal(w.events.filter(e => e.type === 'field_enter').length, 2);
});

test('ice shard retains target area through channel and damages on descent completion', () => {
  const w = new World(); const c = actor(w, 'caster', -200); const target = actor(w, 'target');
  const shard = IceShardFactory.create(c, target, new Vector3(1, 0, 0)) as IceShard;
  shard.frozen = true; w.addSpell(shard); w.update(0.5); assert.equal(target.hp, 100);
  shard.frozen = false; w.update(0.6); assert.equal(target.hp, 75); assert.ok(shard.dead);
});

test('blink clamps to its own arena and emits origin/destination; melee hits its cone once', () => {
  const w = new World({ bounds: { width: 100, depth: 100, height: 200 } });
  const c = actor(w, 'caster'); new Blink(c, new Vector3(1, 0, 0)).update(0.01, w);
  assert.equal(c.position.x, 40); assert.equal(w.events.at(-1)?.type, 'blink');
  c.position.x = 0; const front = actor(w, 'front', 40), back = actor(w, 'back', -40);
  const melee = new MeleeAttack(c, new Vector3(1, 0, 0)); melee.update(0.05, w); melee.update(0.05, w);
  assert.equal(front.hp, 78); assert.equal(back.hp, 100);
});


test('ground-target projectile clamps impact to endpoint despite caster offset and tick overshoot', () => {
  const w = new World(); const c = actor(w, 'caster');
  const intervening = actor(w, 'intervening', 60);
  const p = new Projectile(c, new Vector3(1, 0, 0), new Vector3(24, 10, 0), Heavy.apply(FIREBALL_SPEC));
  p.setDetonationPoint(100, 35, 200); // obsolete caster-based distance must be ignored
  assert.equal(p.detonateAt!.dist, Math.hypot(76, 35));
  w.addSpell(p); w.update(0.1); assert.equal(intervening.hp, 100);
  w.update(0.5);
  const impact = w.events.find(e => e.type === 'spell_impact')!;
  assert.deepEqual(impact.meta.position, { x: 100, y: 10, z: 35 });
  assert.ok(p.dead); assert.equal(w.spells.length, 0);
});


test('default spell declarations reject nested mutation across worlds while instances remain independent', () => {
  const a = new World(), b = new World();
  const ca = actor(a, 'a'), cb = actor(b, 'b');
  const pa = FireballFactory.create(ca, null, new Vector3(1, 0, 0)) as Projectile;
  const pb = FireballFactory.create(cb, null, new Vector3(1, 0, 0)) as Projectile;
  const cooldown = FireballFactory.metadata.cooldown;
  assert.throws(() => { FireballFactory.metadata.cooldown = 999; }, TypeError);
  assert.throws(() => { FireballFactory.spec.visual.trailColor = 0; }, TypeError);
  assert.throws(() => { FIREBALL_SPEC.tags.push('mutated'); }, TypeError);
  assert.throws(() => { ICE_SHARD_SPEC.aoe.radius = 0; }, TypeError);
  assert.throws(() => { Spread.tags.push('mutated'); }, TypeError);
  pa.spec.visual.trailColor = 123;
  assert.equal(pb.metadata.cooldown, cooldown);
  assert.equal(pb.spec.visual.trailColor, FIREBALL_SPEC.visual.trailColor);
});
