/**
 * 게임의 모든 무작위 값은 여기를 거쳐요.
 * 테스트에서는 setRandom으로 시드 고정 난수를 넣을 수 있어요.
 */
let source: () => number = Math.random;

export function setRandom(fn: () => number): void {
  source = fn;
}

export function resetRandom(): void {
  source = Math.random;
}

/** 시드 고정 난수 (mulberry32) */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 문자열로 정하는 난수: 같은 커리어·같은 시즌이면 언제나 같은 상점 진열·특별 투자가 나와요.
 * 게임 난수 흐름은 건드리지 않아요.
 */
export function seededPick(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export const random = (): number => source();
export const rnd = (a: number, b: number): number => a + source() * (b - a);
export const ri = (a: number, b: number): number => Math.floor(rnd(a, b + 1));
export const chance = (p: number): boolean => source() < p;

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(source() * arr.length)];
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(source() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 삼각분포: a~b 사이, c 근처가 가장 자주 나와요. */
export function triangular(a: number, b: number, c: number): number {
  const u = source();
  const f = (c - a) / (b - a);
  return u < f ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
}
