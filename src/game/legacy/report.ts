import { sumSeasons } from "../career/career";
import type { AwardEntry, Career, CareerSummary, LeagueKey, SeasonRecord } from "../core/types";
import { RECORD_BOARDS, type RecordGroup, type RecordStat } from "./records";

/*
 * 시즌 결산 리포트: 시즌이 끝나고 뜨는 순위표 팝업의 '리포트' 탭.
 * 이 시즌의 개인 스탯과 커리어 하이, 누적 기록으로 넘은 선수(실제 역대 순위표, 이 브라우저의 명예의 전당)와 통산 이정표, 개인 수상을 모아요.
 */

export type ReportStat = "pts" | "reb" | "ast" | "stl" | "blk";

export const REPORT_STAT_NAME: Record<ReportStat, { name: string; unit: string }> = {
  pts: { name: "득점", unit: "점" },
  reb: { name: "리바운드", unit: "개" },
  ast: { name: "어시스트", unit: "개" },
  stl: { name: "스틸", unit: "개" },
  blk: { name: "블록", unit: "개" },
};

/** 실제 역대 순위표에서 이번 시즌에 넘은 선수 */
export interface PassedReal {
  group: RecordGroup;
  stat: RecordStat;
  name: string;
  v: number;
  /** 넘고 나서 내 역대 순위 */
  rank: number;
}

/** 명예의 전당(이 브라우저에서 은퇴한 다른 커리어)에서 이번 시즌에 넘은 선수 */
export interface PassedHall {
  stat: "pts" | "reb" | "ast";
  name: string;
  v: number;
  retYear: number;
}

/** 이번 시즌에 넘은 통산 이정표 (프로 통산) */
export interface Milestone {
  stat: "pts" | "reb" | "ast";
  at: number;
}

/** 아직 못 넘은 가장 가까운 실제 역대 순위표 선수 */
export interface NextTarget {
  group: RecordGroup;
  stat: RecordStat;
  name: string;
  rank: number;
  /** 그 선수의 기록과, 거기까지 남은 차이 */
  v: number;
  gap: number;
}

export interface SeasonReport {
  rec: SeasonRecord;
  /** 같은 무대(프로·아마추어) 지난 시즌보다 높은 경기당 기록. 10경기 넘게 뛴 시즌끼리 비교해요. */
  highs: ReportStat[];
  /** 이 시즌까지의 프로 통산과, 이 시즌에 더한 몫 */
  totals: { pts: number; reb: number; ast: number; gp: number } | null;
  added: { pts: number; reb: number; ast: number };
  passedReal: PassedReal[];
  passedHall: PassedHall[];
  milestones: Milestone[];
  next: NextTarget | null;
  /** 이 시즌에 받은 개인상과 팀 성적 */
  awards: AwardEntry[];
}

const MILESTONES: Record<Milestone["stat"], number[]> = {
  pts: [1000, 2000, 3000, 5000, 7500, 10000, 12500, 15000, 20000, 25000, 30000, 35000, 40000],
  reb: [1000, 2500, 5000, 7500, 10000, 12500, 15000, 20000],
  ast: [1000, 2500, 5000, 7500, 10000, 12500, 15000],
};

/** 다음 목표는 그 기록의 이만큼은 쌓았을 때만 보여줘요. 신인에게 수만 점 차이를 보여주지 않게요. */
const NEXT_REACH = 0.45;

type Totals = Record<ReportStat, number>;
const leagueTotals = (rows: SeasonRecord[], lg: LeagueKey): Totals => {
  const { pts, reb, ast, stl, blk } = sumSeasons(rows.filter((h) => h.lg === lg));
  return { pts, reb, ast, stl, blk };
};

/** 시즌 기록(rec)의 결산 리포트. hall은 이 브라우저의 명예의 전당이에요. 같은 커리어의 기록은 빼고 비교해요. */
export function seasonReport(c: Career, rec: SeasonRecord, hall: CareerSummary[] = []): SeasonReport {
  // 저장을 다시 불러오면 c.last와 c.hist의 시즌은 다른 객체라서 연도로 찾아요.
  const at = c.hist.findIndex((h) => h === rec || (h.year === rec.year && h.lg === rec.lg && h.team === rec.team));
  const upto = at >= 0 ? c.hist.slice(0, at + 1) : [...c.hist, rec];
  const before = upto.slice(0, -1);

  const stats: ReportStat[] = ["pts", "reb", "ast", "stl", "blk"];
  const peers = before.filter((h) => h.pro === rec.pro && h.gp >= 10);
  const highs = rec.gp >= 10 && peers.length ? stats.filter((k) => rec[k] > 0 && peers.every((h) => rec[k] > h[k])) : [];

  // 프로 통산: 이정표와 명예의 전당 비교에 써요(명예의 전당 기록도 프로 통산이에요).
  const proNow = sumSeasons(upto.filter((h) => h.pro));
  const proWas = sumSeasons(before.filter((h) => h.pro));
  const added = { pts: proNow.pts - proWas.pts, reb: proNow.reb - proWas.reb, ast: proNow.ast - proWas.ast };
  const milestones: Milestone[] = rec.pro
    ? (["pts", "reb", "ast"] as const).flatMap((k) => MILESTONES[k].filter((m) => proWas[k] < m && proNow[k] >= m).map((m) => ({ stat: k, at: m })))
    : [];
  const passedHall: PassedHall[] = rec.pro
    ? (["pts", "reb", "ast"] as const).flatMap((k) =>
        hall
          .filter((h) => h.id !== c.id && h[k] > proWas[k] && h[k] <= proNow[k])
          .sort((a, b) => b[k] - a[k])
          .slice(0, 3)
          .map((h) => ({ stat: k, name: h.name, v: h[k], retYear: h.retYear })),
      )
    : [];

  // 실제 역대 순위표(NBA·KBL 정규리그): 이 시즌 리그의 통산으로만 비교해요.
  const passedReal: PassedReal[] = [];
  let next: NextTarget | null = null;
  if (rec.lg === "nba" || rec.lg === "kbl") {
    const group = rec.lg;
    const now = leagueTotals(upto, group);
    const was = leagueTotals(before, group);
    for (const b of RECORD_BOARDS.filter((x) => x.group === group)) {
      const mine = now[b.stat];
      for (const e of b.entries.filter((x) => x.v > was[b.stat] && x.v <= mine))
        passedReal.push({ group, stat: b.stat, name: e.name, v: e.v, rank: b.entries.filter((x) => x.v > mine).length + 1 });
      const above = b.entries.filter((x) => x.v > mine);
      const target = above[above.length - 1];
      if (target && mine >= target.v * NEXT_REACH) {
        const gap = target.v - mine;
        // 여러 기록 가운데 남은 비율이 가장 작은 목표 하나만 보여줘요.
        if (!next || gap / target.v < next.gap / next.v) next = { group, stat: b.stat, name: target.name, rank: above.length, v: target.v, gap };
      }
    }
    // 같은 순위표에서 여러 명을 넘었으면 가장 높은 기록의 선수부터 보여줘요.
    passedReal.sort((a, b) => b.v - a.v);
  }

  return {
    rec,
    highs,
    totals: rec.pro ? { pts: proNow.pts, reb: proNow.reb, ast: proNow.ast, gp: proNow.gp } : null,
    added,
    passedReal,
    passedHall,
    milestones,
    next,
    awards: c.awardLog.filter((a) => a.y === rec.year),
  };
}

