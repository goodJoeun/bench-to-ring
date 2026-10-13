import { PERSONAL_AWARDS } from "./data";
import type { Career, CareerSummary } from "./types";

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
  if (score >= 160) return "역대 최고 논쟁의 주인공";
  if (score >= 95) return "명예의 전당 헌액";
  if (score >= 55) return "리그의 레전드";
  if (score >= 28) return "올스타급 커리어";
  if (o.seasons >= 10) return "오래 사랑받은 베테랑";
  return "프로의 꿈을 이룬 선수";
}

export function careerSummary(c: Career): CareerSummary {
  const pro = c.hist.filter((h) => h.pro);
  const total = (f: "pts" | "reb" | "ast") => Math.round(pro.reduce((t, h) => t + h[f] * h.gp, 0));
  const teams: string[] = [];
  for (const h of c.hist) if (h.team !== "무소속" && teams[teams.length - 1] !== h.team) teams.push(h.team);
  const base = {
    id: c.id,
    name: c.p.name,
    num: c.p.num,
    pos: c.p.pos,
    nat: c.p.nat,
    mvp: c.awards.mvp_gbl ?? 0,
    rings: c.awards.ring ?? 0,
    personal: PERSONAL_AWARDS.reduce((t, k) => t + (c.awards[k] ?? 0), 0),
    peak: c.peakOvr,
    pts: total("pts"),
    reb: total("reb"),
    ast: total("ast"),
    gp: pro.reduce((t, h) => t + h.gp, 0),
    seasons: c.proSeasons,
    retAge: c.age,
    retYear: c.year - 1,
    teams,
    earn: Math.round(c.earnings),
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
export const canRetire = (c: Career): boolean => c.age >= 30 && (c.stage === "pro" || c.stage === "free");
