import { ATTRS, POS } from "./data";
import { LEAGUES } from "./leagues";
import { specialtyBonus } from "./specialty";
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

/**
 * 평가 오버롤: 오버롤에 히든 스탯 보너스(specialty.ts)를 더한 값. 출전 시간·계약 제안·드래프트·연봉·시상처럼
 * 구단과 리그가 선수를 평가하는 곳에 써요. 화면과 기록에는 오버롤을 그대로 보여줘요.
 */
export const evalOvrOf = (a: Attrs, pos: PosKey): number => ovrOf(a, pos) + specialtyBonus(a);
export const evalOvr = (p: Player): number => Math.round(evalOvrOf(p.attrs, p.pos));

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
  return clamp(18 + (evalOvrOf(c.p.attrs, c.p.pos) - LEAGUES[lg].avg + extra) * 1.7, 1.5, 38);
}

export function currentExpectedMinutes(c: Career): number {
  return c.team ? expectedMinutes(c, c.team.lg, c.trust) : 0;
}

/**
 * 나이별 기본 성장량 (능력치당, 시즌당). 10대 후반에 가장 빨리 크고, 20대 중반에도 조금씩 커서
 * 평균 28세 무렵에 최고 오버롤에 닿아요. 30세부터 떨어지기 시작해요.
 */
export function ageBase(age: number): number {
  const t: Record<number, number> = {
    16: 3.2, 17: 3, 18: 3, 19: 2.75, 20: 2.55, 21: 2.3, 22: 2.2, 23: 2.1, 24: 2, 25: 1.95,
    26: 1.75, 27: 1.45, 28: 1.15, 29: 0.9, 30: 0, 31: -0.5, 32: -0.75, 33: -1.25, 34: -2,
  };
  if (age >= 35) return -2.5 - (age - 35) * 0.3;
  return t[age] ?? 3;
}

/**
 * 리그별 연봉 (억 원). NBA 최저 연봉 ≈ 17억, 최고 ≈ 800억
 * 리그 평균 대비 실력으로 정해서, 리그 평균을 바꿔도 그 리그 안의 연봉 수준은 그대로예요.
 */
const SALARY: Record<ProLeagueKey, (o: number) => number> = {
  nba: (o) => clamp(12 * Math.pow(1.25, o - (LEAGUES.nba.avg - 5)), 17, 800),
  euro: (o) => clamp(2 * Math.pow(1.2, o - (LEAGUES.euro.avg - 6)), 2, 55),
  kbl: (o) => clamp(1 * Math.pow(1.17, o - (LEAGUES.kbl.avg - 5)), 0.7, 9),
  gleague: () => 0.6,
};
export const salaryFor = (lg: ProLeagueKey, o: number): number => SALARY[lg](o);

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
