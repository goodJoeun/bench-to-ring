export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));
export const r1 = (v: number): number => Math.round(v * 10) / 10;
export const round2 = (v: number): number => Math.round(v * 100) / 100;

/** 천 단위 쉼표를 넣어요. 12345 → "12,345" */
export const fmtNum = (v: number): string => v.toLocaleString("ko-KR");

/** 이름 앞에 붙은 연도를 떼요. "2028 올림픽 금메달" → "올림픽 금메달" */
export const stripYear = (name: string): string => name.replace(/^\d{4} /, "");

/** '(으)로'를 받침에 맞게 붙여요. ㄹ 받침은 '로'예요. ro("서울") → "서울로", ro("휘문고") → "휘문고로" */
export function ro(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const fin = code >= 0 && code <= 11171 ? code % 28 : 0;
  return word + (fin === 0 || fin === 8 ? "로" : "으로");
}

/** 받침에 맞는 조사를 붙여요. josa("중국", "을", "를") → "중국을", josa("미국", "와", "과")처럼 써요. */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const hasFinal = code >= 0 && code <= 11171 && code % 28 !== 0;
  return word + (hasFinal ? withFinal : withoutFinal);
}

/** 억 단위 금액을 읽기 좋게 바꿔요. 0.6 → "6,000만", 112 → "112억" */
export function money(x: number): string {
  if (x >= 10) return `${fmtNum(Math.round(x))}억`;
  if (x >= 1) return `${r1(x)}억`;
  return `${fmtNum(Math.round(x * 10000))}만`;
}

export const roundSalary = (x: number): number => (x >= 10 ? Math.round(x) : r1(x));
