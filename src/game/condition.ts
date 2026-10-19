import type { AttrKey, Attrs, Career } from "./types";
import { clamp } from "./util";

/* 선수 상태 값(능력치·건강·코치 신뢰)의 범위와, 범위를 지키며 바꾸는 함수 */

export const ATTR_RANGE = [20, 99] as const;
export const HEALTH_RANGE = [15, 100] as const;
export const TRUST_RANGE = [-3, 4] as const;

export const clampAttr = (v: number): number => clamp(v, ...ATTR_RANGE);
export const clampTrust = (v: number): number => clamp(v, ...TRUST_RANGE);

/** 능력치를 d만큼 바꾸고, 화면에 보이는(반올림한) 변화량을 돌려줘요. */
export function addAttr(a: Attrs, k: AttrKey, d: number): number {
  const old = a[k];
  a[k] = clampAttr(old + d);
  return Math.round(a[k]) - Math.round(old);
}

export function addHealth(c: Career, d: number): void {
  c.health = clamp(c.health + d, ...HEALTH_RANGE);
}
