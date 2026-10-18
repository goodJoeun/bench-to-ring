import { ATTRS, LEAGUES, POS } from "./data";
import type { AttrKey, Attrs, Career, LeagueKey, Player, PosKey, ProLeagueKey, Role } from "./types";
import { clamp } from "./util";

/** 포지션 가중평균 오버롤 (반올림 전) */
export function ovrOf(a: Attrs, pos: PosKey): number {
  const w = POS[pos].w;
  let s = 0;
  for (const [k] of ATTRS) s += a[k] * w[k];
  return s;
}

export const ovr = (p: Player): number => Math.round(ovrOf(p.attrs, p.pos));

/** 포지션 핵심 능력치: 오버롤 가중치가 큰 능력치 (화면에 ● 표시) */
export const isCoreAttr = (pos: PosKey, k: AttrKey): boolean => POS[pos].w[k] >= 0.18;

export function roleOf(min: number): Role {
  if (min >= 33) return "에이스";
  if (min >= 26) return "주전";
  if (min >= 20) return "식스맨";
  if (min >= 12) return "로테이션";
  if (min >= 5) return "벤치";
  return "엔드 오브 벤치";
}

/** 해당 리그에서 예상되는 경기당 출전 시간(분) */
export function expectedMinutes(c: Career, lg: LeagueKey, extra = 0): number {
  return clamp(18 + (ovrOf(c.p.attrs, c.p.pos) - LEAGUES[lg].avg + extra) * 1.7, 1.5, 38);
}

export function currentExpectedMinutes(c: Career): number {
  return c.team ? expectedMinutes(c, c.team.lg, c.trust) : 0;
}

/** 나이별 기본 성장량 (능력치당, 시즌당). 20대 초반을 조금 낮추고 26세까지 성장이 이어지게 했어요. */
export function ageBase(age: number): number {
  const t: Record<number, number> = {
    16: 3, 17: 3, 18: 3, 19: 2.4, 20: 2.2, 21: 2, 22: 1.9, 23: 1.9, 24: 1.9, 25: 1.9,
    26: 1.7, 27: 1, 28: 0.4, 29: 0, 30: -0.5, 31: -0.9, 32: -1.3, 33: -1.8, 34: -2.3,
  };
  if (age >= 35) return -3 - (age - 35) * 0.3;
  return t[age] ?? 3;
}

/** 리그별 연봉 (억 원). NBA 최저 연봉 ≈ 17억, 최고 ≈ 800억 */
const SALARY: Record<ProLeagueKey, (o: number) => number> = {
  nba: (o) => clamp(12 * Math.pow(1.25, o - 70), 17, 800),
  euro: (o) => clamp(2 * Math.pow(1.2, o - 64), 2, 55),
  kbl: (o) => clamp(1 * Math.pow(1.17, o - 60), 0.7, 9),
  gleague: () => 0.6,
};
export const salaryFor = (lg: ProLeagueKey, o: number): number => SALARY[lg](o);

/** 스카우트 잠재력 추정 범위. 나이가 들수록 좁아져요. */
export function potentialRange(c: Career): string {
  const p = c.p;
  const u = Math.max(1, Math.round(9 - (c.age - 16) * 1.1));
  const o = ovr(p);
  const lo = clamp(Math.round(p.pot - u + c.potOff), o, 99);
  const hi = clamp(Math.max(Math.round(p.pot + u + c.potOff), o), o, 99);
  return lo >= hi ? String(hi) : `${lo}–${hi}`;
}

export function stageLabel(c: Career): string {
  switch (c.stage) {
    case "hs":
      return c.schoolYear > 3 ? "고교 졸업" : `고${c.schoolYear}`;
    case "college":
      return `대학 ${Math.min(4, c.collegeYears + 1)}학년`;
    case "pro":
      return `프로 ${c.proSeasons + 1}년차`;
    case "free":
      return "무소속";
    case "military":
      return c.mil.kind === "sangmu" ? "상무 복무 중" : "현역 복무 중";
    default:
      return "";
  }
}
