import type { Contestant } from "../contestants/contestant";
import type { SpellFactory, SpellKind } from "./spell";

export interface SelectionContext {
  self: Contestant;
  target: Contestant;
  distToTarget: number;
  readyAt: Map<SpellFactory, number>;
  nowSeconds: number;
}

export type SpellSelector = (
  spellbook: readonly SpellFactory[],
  ctx: SelectionContext
) => SpellFactory | null;

export function byTag(tag: string) {
  return (f: SpellFactory): boolean => f.metadata.tags.includes(tag);
}

export function byAnyTag(...tags: string[]) {
  return (f: SpellFactory): boolean =>
    tags.some((t) => f.metadata.tags.includes(t));
}

export function byAllTags(...tags: string[]) {
  return (f: SpellFactory): boolean =>
    tags.every((t) => f.metadata.tags.includes(t));
}

export function byKind(kind: SpellKind) {
  return (f: SpellFactory): boolean => f.metadata.kind === kind;
}

export function byElement(element: string) {
  return (f: SpellFactory): boolean => f.metadata.element === element;
}

export function inRange(distance: number) {
  return (f: SpellFactory): boolean =>
    distance >= f.metadata.range.min && distance <= f.metadata.range.max;
}

export function byReady(ctx: SelectionContext) {
  return (f: SpellFactory): boolean => {
    const ready = ctx.readyAt.get(f);
    return ready === undefined || ready <= ctx.nowSeconds;
  };
}

export function preferLongestRange(
  a: SpellFactory,
  b: SpellFactory
): number {
  return b.metadata.range.max - a.metadata.range.max;
}

export function preferShortestCooldown(
  a: SpellFactory,
  b: SpellFactory
): number {
  return a.metadata.cooldown - b.metadata.cooldown;
}

export function preferShortestCharge(
  a: SpellFactory,
  b: SpellFactory
): number {
  return a.metadata.chargeTime - b.metadata.chargeTime;
}

/** Default selector: first in-range, ready spell from the book. */
export const defaultSelector: SpellSelector = (book, ctx) => {
  return (
    book.filter(byReady(ctx)).find(inRange(ctx.distToTarget)) ?? null
  );
};
