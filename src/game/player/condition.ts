import { ATTR_KEYS } from "../core/data";
import { shuffle } from "../core/random";
import type { AttrKey, Attrs, Career } from "../core/types";
import { clamp } from "../core/util";

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

/** 화면에 99로 보이는(반올림해 최대치인) 능력치는 더 오르지 않아요. */
export const attrMaxed = (a: Attrs, k: AttrKey): boolean => Math.round(a[k]) >= ATTR_RANGE[1];

/** '무작위 능력치 n개 +1'로 올릴 능력치: 이미 99인 능력치는 빼고 무작위로 n개까지 골라요. */
export const randomGrowable = (a: Attrs, n: number): AttrKey[] => shuffle(ATTR_KEYS.filter((k) => !attrMaxed(a, k))).slice(0, n);

export function addHealth(c: Career, d: number): void {
  c.health = clamp(c.health + d, ...HEALTH_RANGE);
}
