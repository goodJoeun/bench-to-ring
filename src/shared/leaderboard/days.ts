// 날짜별 순위표의 날짜. 하루는 한국 시간 0시에 바뀌어요.

/** 날짜별 순위표로 고를 수 있는 날 수 (오늘 포함) */
export const DAY_COUNT = 7;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
/** 한국 시간은 UTC+9이고 서머타임이 없어요. */
const KST_OFFSET_MS = 9 * 3_600_000;

/** 그 시각의 한국 날짜 `YYYY-MM-DD` */
export const kstDay = (at: number): string => new Date(at + KST_OFFSET_MS).toISOString().slice(0, 10);

/** 그날부터 거꾸로 DAY_COUNT일. 첫째가 그날이에요. */
export const daysBack = (day: string): string[] =>
  Array.from({ length: DAY_COUNT }, (_, i) => new Date(Date.parse(`${day}T00:00:00Z`) - i * DAY_MS).toISOString().slice(0, 10));

/** 달력에 있는 `YYYY-MM-DD`인지 */
export function isDay(s: string): boolean {
  if (!DAY_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
