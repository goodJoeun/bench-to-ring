import { TEAMS } from "./data";
import { pick, rnd } from "./random";
import type { AwardKey, Career, LeagueKey, NewsType, SeasonRecord, Team } from "./types";

const NEWS_LIMIT = 90;

export function addNews(c: Career, when: string, type: NewsType, message: string): void {
  c.news.unshift({ w: when, t: type, m: message });
  if (c.news.length > NEWS_LIMIT) c.news.length = NEWS_LIMIT;
}

export function giveAward(c: Career, k: AwardKey, name: string, rec?: SeasonRecord): void {
  c.awards[k] = (c.awards[k] ?? 0) + 1;
  c.awardLog.push({ y: rec ? rec.year : c.year - 1, k, n: name });
  if (rec) rec.awards.push(name);
}

export function pickTeam(lg: LeagueKey, used?: Set<string>): Team {
  const pool = TEAMS[lg].filter(([name]) => !used?.has(name));
  return makeTeam(pick(pool.length ? pool : TEAMS[lg]));
}

/** 팀 목록의 한 줄로 팀을 만들어요. 전력은 무작위예요. */
export const makeTeam = ([name, color]: readonly [string, string]): Team => ({ name, color, q: Math.round(rnd(0.32, 0.68) * 100) / 100 });

export function setTeam(c: Career, lg: LeagueKey, t: Team): void {
  c.team = { lg, name: t.name, color: t.color, q: t.q };
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

/** 지난 시즌 오프시즌 소식에 붙는 꼬리표 */
export const offseasonTag = (c: Career): string => `${c.year - 1} 오프시즌`;
