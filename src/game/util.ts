export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));
export const r1 = (v: number): number => Math.round(v * 10) / 10;

/** 억 단위 금액을 읽기 좋게 바꿔요. 0.6 → "6,000만", 112 → "112억" */
export function money(x: number): string {
  if (x >= 10) return `${Math.round(x).toLocaleString("ko-KR")}억`;
  if (x >= 1) return `${r1(x)}억`;
  return `${Math.round(x * 10000).toLocaleString("ko-KR")}만`;
}

export const roundSalary = (x: number): number => (x >= 10 ? Math.round(x) : r1(x));
