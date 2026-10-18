export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));
export const r1 = (v: number): number => Math.round(v * 10) / 10;

/** 받침에 맞는 조사를 붙여요. josa("중국", "을", "를") → "중국을", josa("미국", "와", "과")처럼 써요. */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const hasFinal = code >= 0 && code <= 11171 && code % 28 !== 0;
  return word + (hasFinal ? withFinal : withoutFinal);
}

/** 억 단위 금액을 읽기 좋게 바꿔요. 0.6 → "6,000만", 112 → "112억" */
export function money(x: number): string {
  if (x >= 10) return `${Math.round(x).toLocaleString("ko-KR")}억`;
  if (x >= 1) return `${r1(x)}억`;
  return `${Math.round(x * 10000).toLocaleString("ko-KR")}만`;
}

export const roundSalary = (x: number): number => (x >= 10 ? Math.round(x) : r1(x));
