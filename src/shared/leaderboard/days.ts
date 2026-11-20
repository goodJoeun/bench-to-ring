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

/** 그날에서 n일 뒤(음수면 앞)의 날짜 */
export const shiftDay = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** 챌린지 기록을 받는 기간: 시작한 날과 그 뒤 이만큼의 날(한국 시간)까지예요. 자정 무렵에 시작한 커리어도 끝까지 뛰고 올릴 수 있어요. */
export const CHALLENGE_GRACE_DAYS = 1;

/**
 * 그날 시작한 챌린지 기록을 지금 챌린지 순위표에 받는지. 아직 오지 않은 날과 접수 기간이 지난 날은 받지 않아요.
 * 받지 않는 기록도 일반 랭킹에는 그대로 올라가요.
 */
export function challengeOpen(day: string, now: number): boolean {
  const today = kstDay(now);
  return isDay(day) && day <= today && today <= shiftDay(day, CHALLENGE_GRACE_DAYS);
}
