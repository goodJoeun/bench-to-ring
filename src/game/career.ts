import { AWARDS, PERSONAL_AWARDS, RULESET_VERSION } from "./data";
import { LEAGUES, teamColor } from "./leagues";
import { militaryUnit } from "./military";
import { natColor } from "./national";
import { ownedItems } from "./shop";
import type { AwardKey, Career, CareerSummary, NbaShare, SeasonRecord } from "./types";
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

/* ---------- 은퇴 회고 ---------- */

/** 은퇴 회고 화면에서 한 칸씩 따라가는 커리어의 순간 */
export interface JourneyStep {
  year: number;
  age: number;
  /** 그때 소속 (팀, 부대, 대표팀) */
  team: string;
  /** 유니폼 색. 모르는 팀이면 null */
  color: string | null;
  /** 큰 글씨 한 줄: 수상, 우승, 역할 */
  title: string;
  /** 작은 글씨 한 줄: 시즌 기록 */
  detail: string;
  /** 이 시즌에 받은 상 */
  awards: string[];
  /** 우승·MVP·금메달처럼 빛나는 순간이라 조금 더 오래 보여줘요. */
  big: boolean;
  /** 이 순간까지 쌓인 출전 경기, 득점, 트로피(수상·우승·메달) */
  gp: number;
  pts: number;
  trophies: number;
}

/** 시즌 제목으로 고를 상의 순서: AWARDS 순서(MVP → 우승 → 파이널 MVP …), 메달은 따로 보여줘요. */
const HEADLINE_ORDER: AwardKey[] = AWARDS.map(([k]) => k).filter((k) => !k.startsWith("nat_"));
const SHINING: AwardKey[] = ["mvp_nba", "ring", "fmvp", "mvp", "title"];

/**
 * 은퇴 회고용으로 커리어를 순서대로 펼쳐요: 입단 → 시즌마다 한 칸(그해 메달과 드래프트는 바로 뒤에) → 은퇴.
 * 화면은 이 목록을 한 칸씩 따라가며 보여줘요.
 */
export function careerJourney(c: Career): JourneyStep[] {
  const steps: JourneyStep[] = [];
  let gp = 0;
  let pts = 0;
  const trophiesBy = (y: number) => c.awardLog.filter((a) => a.y <= y).length;
  const first = c.hist[0];
  if (first)
    steps.push({
      year: first.year, age: first.age, team: first.team, color: teamColor(first.team), title: "벤치에서 시작",
      detail: `${first.team} 농구부 입단 · 오버롤 ${first.ovr0}`, awards: [], big: false, gp: 0, pts: 0, trophies: 0,
    });
  for (const h of c.hist) {
    gp += h.gp;
    pts += Math.round(h.pts * h.gp);
    const logs = c.awardLog.filter((a) => a.y === h.year);
    const top = HEADLINE_ORDER.map((k) => logs.find((a) => a.k === k)).find(Boolean);
    const title = top
      ? top.n
      : h.mil
        ? h.mil === "sangmu" ? "상무에서 군 복무" : "현역으로 군 복무"
        : !h.lg ? "무소속 · 개인 훈련" : h.result;
    steps.push({
      year: h.year,
      age: h.age,
      team: h.team,
      color: h.mil ? militaryUnit(h.mil).color : teamColor(h.team),
      title,
      detail: h.gp ? `${h.gp}경기 · ${h.pts}점 ${h.reb}리바 ${h.ast}어시 · ${h.w}승 ${h.l}패` : `${h.result} · 오버롤 ${h.ovr1}`,
      awards: h.awards.filter((a) => a !== top?.n),
      big: logs.some((a) => SHINING.includes(a.k)),
      gp, pts, trophies: trophiesBy(h.year),
    });
    for (const t of c.natLog.filter((t) => t.year === h.year && t.joined && t.medal))
      steps.push({
        year: t.year, age: h.age, team: `${c.p.nat} 대표팀`, color: natColor(c.p.nat), title: `${t.name} ${t.medal}메달`,
        detail: t.label, awards: [], big: t.medal === "금", gp, pts, trophies: trophiesBy(h.year),
      });
    const d = c.draft;
    if (d && d.year === h.year)
      steps.push({
        year: d.year, age: h.age + 1, team: d.team, color: teamColor(d.team), title: `${d.lg} 드래프트 ${d.pick}순위`,
        detail: `${d.round}라운드 ${d.inRound}순위로 ${d.team}에 지명`, awards: [], big: d.lg === "NBA" && d.round === 1,
        gp, pts, trophies: trophiesBy(h.year),
      });
  }
  const s = c.summary ?? careerSummary(c);
  const last = c.hist.at(-1);
  steps.push({
    year: s.retYear, age: s.retAge, team: last?.team ?? "", color: last ? teamColor(last.team) : null, title: "은퇴",
    detail: `${c.hist.length}시즌 · ${s.teams.length}개 팀을 거쳐 코트를 떠나요`, awards: [], big: true, gp, pts,
    trophies: c.awardLog.length,
  });
  return steps;
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

/** NBA 시즌의 통산 기록과, 그 시즌에 받은 상 (국가대표 메달은 빼요) */
export function nbaShare(c: Career): NbaShare {
  const rows = c.hist.filter((h) => h.pro && h.lg === "nba");
  const years = new Set(rows.map((h) => h.year));
  const awards: Partial<Record<AwardKey, number>> = {};
  for (const a of c.awardLog) if (years.has(a.y) && !a.k.startsWith("nat_")) awards[a.k] = (awards[a.k] ?? 0) + 1;
  return { seasons: years.size, ...sumSeasons(rows), awards };
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
    donated: c.donated,
    legacyItems: ownedItems(c).filter((i) => i.legacy).map((i) => i.name),
    ruleset: RULESET_VERSION,
    nba: nbaShare(c),
    look: { skin: c.p.skin, hair: c.p.hair },
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
