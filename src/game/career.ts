import { AWARDS, PERSONAL_AWARDS, RULESET_VERSION } from "./data";
import { LEAGUES, teamColor } from "./leagues";
import { militaryUnit } from "./military";
import { natColor } from "./national";
import { playerLook } from "./players";
import { ownedItems } from "./shop";
import type { AwardKey, Career, CareerSummary, LeagueKey, LeagueShare, NbaShare, SeasonRecord } from "./types";
import { stripYear } from "./util";

export interface CareerTotals {
  gp: number;
  pts: number;
  reb: number;
  ast: number;
}

/** 통산 기록에 스틸·블록·3점슛까지 */
export interface SeasonTotals extends CareerTotals {
  stl: number;
  blk: number;
  tpm: number;
}

/** 시즌 기록을 더한 통산 기록. 시즌 기록은 경기당 평균이라 경기 수를 곱해 더해요. 3점슛이 없는 예전 시즌은 0으로 쳐요. */
export function sumSeasons(rows: SeasonRecord[]): SeasonTotals {
  const total = (f: "pts" | "reb" | "ast" | "stl" | "blk" | "tpm") => Math.round(rows.reduce((t, h) => t + (h[f] ?? 0) * h.gp, 0));
  return {
    gp: rows.reduce((t, h) => t + h.gp, 0),
    pts: total("pts"),
    reb: total("reb"),
    ast: total("ast"),
    stl: total("stl"),
    blk: total("blk"),
    tpm: total("tpm"),
  };
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

/** 같은 이름으로 받은 수상을 묶은 것: 'KBL 우승' 3회 */
export interface AwardCount {
  name: string;
  count: number;
}

/** 커리어 수상을 팀(우승), 개인(MVP·베스트 팀…), 국가대표(메달)로 나눈 것 */
export interface AwardGroups {
  team: AwardCount[];
  personal: AwardCount[];
  nat: AwardCount[];
}

/** 개인상은 MVP부터 보여줘요. 나머지는 AWARDS 순서예요. */
const PERSONAL_ORDER: AwardKey[] = ["mvp_nba", "mvp", "fmvp", "cfmvp", ...PERSONAL_AWARDS.filter((k) => !["mvp_nba", "mvp", "fmvp", "cfmvp"].includes(k))];
/** 수상을 보여줄 리그 순서: 프로는 리그 수준(평균 오버롤) 순, 그다음 아마추어 */
const LEAGUE_ORDER: LeagueKey[] = ["nba", "euro", "gleague", "kbl", "ncaa", "kuniv", "hs"];

/**
 * 커리어 수상을 리그·대회 이름 그대로 세어 팀·개인·국가대표로 나눠요. 'KBL 우승'과 'NBA 우승'은 따로 세요.
 * 팀·개인은 리그 수준 순(NBA → 유로리그 → G리그 → KBL → NCAA → U-리그 → 고교)이고, 같은 리그 안에서는 상의 순서(개인상은 MVP부터)예요.
 * 리그는 그 상을 받은 해의 시즌 기록에서 찾아요. 국가대표 메달 이름에 붙은 연도는 떼고 세요.
 */
export function awardGroups(c: Career): AwardGroups {
  const leagueRank = (y: number) => {
    const lg = c.hist.find((h) => h.year === y)?.lg;
    return lg ? LEAGUE_ORDER.indexOf(lg) : LEAGUE_ORDER.length;
  };
  const count = (keys: AwardKey[], byLeague: boolean): AwardCount[] => {
    const out: (AwardCount & { order: number[] })[] = [];
    for (const a of [...c.awardLog].sort((x, y) => x.y - y.y)) {
      const kind = keys.indexOf(a.k);
      if (kind < 0) continue;
      const name = stripYear(a.n);
      const hit = out.find((x) => x.name === name);
      if (hit) hit.count++;
      else out.push({ name, count: 1, order: [byLeague ? leagueRank(a.y) : 0, kind, a.y] });
    }
    out.sort((x, y) => x.order[0] - y.order[0] || x.order[1] - y.order[1] || x.order[2] - y.order[2]);
    return out.map(({ name, count }) => ({ name, count }));
  };
  return {
    team: count(["ring", "title"], true),
    personal: count(PERSONAL_ORDER, true),
    nat: count(["nat_gold", "nat_silver", "nat_bronze"], false),
  };
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

/**
 * 그해 칸에 담는 순서: MVP → 우승 → MVP를 뺀 개인 수상 → 국가대표 메달. 맨 앞이 칸의 제목이 돼요.
 * 메달은 소속팀 시즌과 따로 열리는 대회라 맨 뒤에 둬서, 상 없이 메달만 딴 해에만 제목이 돼요.
 */
const MVP_KEYS: AwardKey[] = ["mvp_nba", "mvp", "fmvp", "cfmvp"];
const WIN_KEYS: AwardKey[] = ["ring", "title"];
const MOMENT_ORDER: AwardKey[] = [
  ...MVP_KEYS,
  ...WIN_KEYS,
  ...AWARDS.map(([k]) => k).filter((k) => !MVP_KEYS.includes(k) && !WIN_KEYS.includes(k)),
];
const SHINING: AwardKey[] = ["mvp_nba", "ring", "fmvp", "mvp", "title"];

/**
 * 은퇴 회고용으로 커리어의 굵직한 순간을 해마다 한 칸씩 골라요: 입단 → 우승·개인 수상, 메달, 드래프트가 있던 해 → 은퇴.
 * 한 해의 수상·메달·드래프트는 한 칸에 모두 담고, 아무 일도 없던 해는 칸을 만들지 않고 쌓인 경기·득점에만 더해요.
 * 첫해와 마지막 해의 순간은 입단·은퇴 칸에 함께 담아요. 화면은 이 목록을 한 칸씩 따라가며 보여줘요.
 */
export function careerJourney(c: Career): JourneyStep[] {
  const steps: JourneyStep[] = [];
  let gp = 0;
  let pts = 0;
  const trophiesBy = (y: number) => c.awardLog.filter((a) => a.y <= y).length;
  const first = c.hist[0];
  const last = c.hist.at(-1);
  /** 마지막 해의 순간은 은퇴 칸에 담아요. */
  let lastMoments: string[] = [];
  for (const h of c.hist) {
    gp += h.gp;
    pts += Math.round(h.pts * h.gp);
    const logs = c.awardLog.filter((a) => a.y === h.year);
    const awards = MOMENT_ORDER.flatMap((k) => logs.filter((a) => a.k === k));
    const medals = c.natLog.filter((t) => t.year === h.year && t.joined && t.medal);
    const d = c.draft?.year === h.year ? c.draft : null;
    // 메달은 시즌 수상 목록에도 같은 이름으로 들어 있어서 겹치지 않게 걸러요. 연도는 칸에 따로 보여줘요.
    const moments = [
      ...new Set([
        ...awards.map((a) => a.n),
        ...h.awards,
        ...medals.map((t) => `${t.name} ${t.medal}메달`),
        ...(d ? [`${d.lg} 드래프트 ${d.pick}순위`] : []),
      ].map(stripYear)),
    ];
    const big = logs.some((a) => SHINING.includes(a.k)) || medals.some((t) => t.medal === "금") || (d?.lg === "NBA" && d.round === 1);
    const stats = h.gp ? `${h.gp}경기 · ${h.pts}점 ${h.reb}리바 ${h.ast}어시 · ${h.w}승 ${h.l}패` : `${h.result} · 오버롤 ${h.ovr1}`;
    const base = { year: h.year, age: h.age, gp, pts, trophies: trophiesBy(h.year), big };
    if (h === first)
      steps.push({
        ...base, team: h.team, color: teamColor(h.team), title: "벤치에서 시작",
        detail: `${h.team} 농구부 입단`, awards: moments,
      });
    else if (h === last) {
      lastMoments = moments;
    } else if (awards.some((a) => !a.k.startsWith("nat_")))
      steps.push({
        ...base, team: h.team, color: h.mil ? militaryUnit(h.mil).color : teamColor(h.team), title: moments[0],
        detail: stats, awards: moments.slice(1),
      });
    // 상 없이 메달만 딴 해는 대표팀 칸, 드래프트만 있던 해는 지명한 팀 칸이에요.
    else if (medals.length)
      steps.push({
        ...base, team: `${c.p.nat} 대표팀`, color: natColor(c.p.nat), title: moments[0], detail: medals[0].label,
        awards: moments.slice(1),
      });
    else if (d)
      steps.push({
        ...base, age: h.age + 1, team: d.team, color: teamColor(d.team), title: moments[0],
        detail: `${d.round}라운드 ${d.inRound}순위로 ${d.team}에 지명`, awards: moments.slice(1),
      });
  }
  const s = c.summary ?? careerSummary(c);
  steps.push({
    year: s.retYear, age: s.retAge, team: last?.team ?? "", color: last ? teamColor(last.team) : null, title: "은퇴",
    detail: `${c.hist.length}시즌 · ${s.teams.length}개 팀을 거쳐 코트를 떠나요`, awards: lastMoments, big: true, gp, pts,
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
  const { gp, pts, reb, ast } = sumSeasons(rows);
  return { seasons: years.size, gp, pts, reb, ast, awards };
}

/** 리그마다 쌓은 시즌·기록과 그 시즌에 받은 상 (국가대표 메달은 빼요). 랭킹 점수가 리그 수준에 따라 다르게 쳐요. */
export function leagueShares(c: Career): Partial<Record<LeagueKey, LeagueShare>> {
  const out: Partial<Record<LeagueKey, LeagueShare>> = {};
  for (const lg of new Set(c.hist.map((h) => h.lg))) {
    if (!lg) continue;
    const rows = c.hist.filter((h) => h.lg === lg);
    const years = new Set(rows.map((h) => h.year));
    const awards: Partial<Record<AwardKey, number>> = {};
    for (const a of c.awardLog) if (years.has(a.y) && !a.k.startsWith("nat_")) awards[a.k] = (awards[a.k] ?? 0) + 1;
    out[lg] = { seasons: years.size, ...sumSeasons(rows), awards };
  }
  return out;
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
    stl: pro.stl,
    blk: pro.blk,
    tpm: pro.tpm,
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
    leagues: leagueShares(c),
    look: playerLook(c.p),
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
