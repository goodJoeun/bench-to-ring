import { TEAMS } from "./leagues";
import { pick, rnd } from "./random";
import type { AwardKey, Career, Cheer, LeagueKey, NewsType, SeasonRecord, Team } from "./types";

const NEWS_LIMIT = 90;

export function addNews(c: Career, when: string, type: NewsType, message: string): void {
  c.news.unshift({ w: when, t: type, m: message });
  if (c.news.length > NEWS_LIMIT) c.news.length = NEWS_LIMIT;
}

/**
 * 축하 팝업을 띄울 상: 각종 우승, 국가대표 금메달, 시즌 MVP(NBA MVP와 다른 리그의 정규리그 MVP), 파이널 MVP.
 * 시즌을 마치며 시즌 MVP → 우승 → 파이널 MVP 순으로 주니, 팝업도 그 순서로 한 장씩 떠요.
 */
const CHEER_KIND: Partial<Record<AwardKey, Cheer["kind"]>> = {
  ring: "title",
  title: "title",
  nat_gold: "gold",
  mvp_nba: "mvp",
  mvp: "mvp",
  fmvp: "fmvp",
};
/** 보여주지 않은 축하는 이만큼만 남겨요. 화면 없이 커리어를 돌리는 테스트에서 끝없이 쌓이지 않게요. */
const CHEER_LIMIT = 8;

function cheer(c: Career, x: Cheer): void {
  c.cheers.push(x);
  if (c.cheers.length > CHEER_LIMIT) c.cheers.splice(0, c.cheers.length - CHEER_LIMIT);
}

export function giveAward(c: Career, k: AwardKey, name: string, rec?: SeasonRecord): void {
  const year = rec ? rec.year : c.year - 1;
  c.awards[k] = (c.awards[k] ?? 0) + 1;
  c.awardLog.push({ y: year, k, n: name });
  if (rec) rec.awards.push(name);
  const kind = CHEER_KIND[k];
  if (!kind) return;
  let sub: string;
  if (kind === "gold") sub = `${c.p.nat} 대표팀 · ${year}년`;
  else if (!rec) sub = `${year} 시즌`;
  else if (kind === "title") sub = `${rec.team} · ${year} 시즌${rec.final?.series ? ` · 시리즈 ${rec.final.series}` : ""}`;
  else sub = `${rec.team} · ${year} 시즌 · 경기당 ${rec.pts}점 ${rec.reb}리바 ${rec.ast}어시`;
  cheer(c, { kind, title: name, sub, year, color: kind === "gold" ? null : (c.team?.color ?? null) });
}

export function pickTeam(lg: LeagueKey, used?: Set<string>): Team {
  const pool = TEAMS[lg].filter(([name]) => !used?.has(name));
  return makeTeam(pick(pool.length ? pool : TEAMS[lg]));
}

/** 팀 목록의 한 줄로 팀을 만들어요. 전력은 무작위예요. */
export const makeTeam = ([name, color]: readonly [string, string]): Team => ({ name, color, q: Math.round(rnd(0.32, 0.68) * 100) / 100 });

export function setTeam(c: Career, lg: LeagueKey, t: Team): void {
  c.team = { lg, name: t.name, color: t.color, q: t.q };
  // NBA 팀에 처음 들어가면 한 번만 축하해요. 드래프트·계약·영입 제안 어느 길로 와도 여기를 지나요.
  if (lg === "nba" && !c.milestones.includes("nba")) {
    c.milestones.push("nba");
    cheer(c, { kind: "nba", title: "NBA 입성!", sub: `${t.name} 유니폼을 입어요 · ${c.age}세`, year: c.year, color: t.color });
  }
}

/** 새 팀에 들어가요. 코치 신뢰는 처음부터 다시 쌓아요. */
export function joinTeam(c: Career, lg: LeagueKey, t: Team): void {
  setTeam(c, lg, t);
  c.trust = 0;
}

/** 소속팀과 계약 없이 무소속이 돼요. */
export function leaveTeam(c: Career): void {
  c.stage = "free";
  c.team = null;
  c.contract = null;
}

/** 결정 결과 소식에 붙는 꼬리표: 시즌 중이면 그 시즌, 아니면 지난 시즌의 오프시즌 */
export const decisionTag = (c: Career): string => (c.run ? `${c.run.year} 시즌` : `${c.year - 1} 오프시즌`);
