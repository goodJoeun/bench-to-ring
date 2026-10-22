import { PERSONAL_AWARDS } from "./data";
import { LEAGUES } from "./leagues";
import type { Career, CareerSummary, SeasonRecord } from "./types";
import { stripYear } from "./util";

export interface CareerTotals {
  gp: number;
  pts: number;
  reb: number;
  ast: number;
}

/** 시즌 기록을 더한 통산 기록. 시즌 기록은 경기당 평균이라 경기 수를 곱해 더해요. */
export function sumSeasons(rows: SeasonRecord[]): CareerTotals {
  const total = (f: "pts" | "reb" | "ast") => Math.round(rows.reduce((t, h) => t + h[f] * h.gp, 0));
  return { gp: rows.reduce((t, h) => t + h.gp, 0), pts: total("pts"), reb: total("reb"), ast: total("ast") };
}

export interface TitleEntry {
  year: number;
  age: number | null;
  /** 대회 이름: NBA 우승, 고교 전국대회 우승, 아시안게임 금메달… */
  name: string;
  /** 우승한 팀: 소속팀 또는 국가대표팀 */
  team: string;
  /** 리그 이름 (국가대표는 null) */
  league: string | null;
  kind: "pro" | "amateur" | "nat";
  fmvp: boolean;
}

/** 우승 기록을 연도순으로. 어느 팀에서, 어느 리그에서 우승했는지 시즌 기록과 맞춰 찾아요. */
export function titleHistory(c: Career): TitleEntry[] {
  const fmvpYears = new Set(c.awardLog.filter((a) => a.k === "fmvp").map((a) => a.y));
  return c.awardLog
    .filter((a) => a.k === "ring" || a.k === "title" || a.k === "nat_gold")
    .map((a) => {
      const rec = c.hist.find((h) => h.year === a.y);
      const nat = a.k === "nat_gold";
      return {
        year: a.y,
        age: rec?.age ?? null,
        // 국가대표 메달 이름엔 연도가 붙어 있어서 떼어내요. 연도는 따로 보여줘요.
        name: nat ? stripYear(a.n) : a.n,
        team: nat ? `${c.p.nat} 대표팀` : rec?.team ?? "-",
        league: !nat && rec?.lg ? LEAGUES[rec.lg].name : null,
        kind: nat ? "nat" : a.k === "ring" ? "pro" : "amateur",
        fmvp: !nat && fmvpYears.has(a.y),
      } satisfies TitleEntry;
    })
    .sort((x, y) => x.year - y.year);
}

export function legacyOf(o: Omit<CareerSummary, "legacy">): string {
  const a = o.awards;
  const score =
    o.mvp * 30 +
    o.rings * 8 +
    (a.fmvp ?? 0) * 8 +
    (a.allleague ?? 0) * 6 +
    (a.mvp ?? 0) * 5 +
    (a.allstar ?? 0) * 3 +
    o.personal +
    Math.max(0, o.peak - 70) * 2 +
    o.pts / 1500;
  if (!o.seasons) return "코트를 사랑한 선수";
  if (score >= 200 && o.mvp >= 3) return "역대 최고 논쟁의 주인공";
  if (score >= 95) return "명예의 전당 헌액";
  if (score >= 55) return "리그의 레전드";
  if (score >= 28) return "올스타급 커리어";
  if (o.seasons >= 10) return "오래 사랑받은 베테랑";
  return "프로의 꿈을 이룬 선수";
}

export function careerSummary(c: Career): CareerSummary {
  const pro = sumSeasons(c.hist.filter((h) => h.pro));
  const teams: string[] = [];
  for (const h of c.hist) if (h.team !== "무소속" && teams[teams.length - 1] !== h.team) teams.push(h.team);
  const base = {
    id: c.id,
    name: c.p.name,
    num: c.p.num,
    pos: c.p.pos,
    nat: c.p.nat,
    mvp: c.awards.mvp_nba ?? 0,
    rings: c.awards.ring ?? 0,
    personal: PERSONAL_AWARDS.reduce((t, k) => t + (c.awards[k] ?? 0), 0),
    peak: c.peakOvr,
    pts: pro.pts,
    reb: pro.reb,
    ast: pro.ast,
    gp: pro.gp,
    seasons: c.proSeasons,
    retAge: c.age,
    retYear: c.year - 1,
    teams,
    // 지금 가진 돈에 투자로 쓴 돈을 더해 벌어들인 돈을 보여줘요.
    earn: Math.round(c.earnings + (c.spent ?? 0)),
    caps: c.nat.caps,
    awards: { ...c.awards },
    draft: c.draft,
  };
  return { ...base, legacy: legacyOf(base) };
}

export function retire(c: Career): CareerSummary {
  const s = careerSummary(c);
  c.stage = "retired";
  c.summary = s;
  c.queue = [];
  return s;
}

/** 은퇴를 직접 선언할 수 있는지 */
export const canRetire = (c: Career): boolean => !c.run && c.age >= 30 && (c.stage === "pro" || c.stage === "free");
