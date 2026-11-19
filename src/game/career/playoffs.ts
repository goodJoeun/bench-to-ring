import type { SeasonRecord } from "../core/types";

/*
 * 커리어의 플레이오프(아마추어는 전국대회 본선) 기록. 시즌마다의 기록은 SeasonRecord.po에 있고, 정하는 곳은 season.ts의 playoffRound예요.
 * 플레이오프 기록은 정규시즌 통산(sumSeasons)과 따로 세요. 랭킹 점수와 역대 기록 순위표는 정규시즌만 봐요.
 */

/** 여러 시즌의 플레이오프 기록을 더한 것. 경기 기록은 합계예요. */
export interface PlayoffTotals {
  /** 플레이오프 기록이 있는 시즌 (팀이 플레이오프에 오른 시즌) */
  seasons: number;
  /** 내가 뛴 플레이오프 경기 */
  gp: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  /** 팀의 플레이오프 승패 */
  w: number;
  l: number;
}

/**
 * 시즌들의 플레이오프 기록을 더해요. 시즌 기록의 플레이오프 기록은 경기당 평균이라 경기 수를 곱해 더해요.
 * 플레이오프 기록이 없는 시즌(못 올랐거나 이 기능 전에 치른 시즌)은 빼요.
 */
export function sumPlayoffs(rows: SeasonRecord[]): PlayoffTotals {
  const po = rows.flatMap((h) => (h.po ? [h.po] : []));
  const total = (f: "min" | "pts" | "reb" | "ast" | "stl" | "blk") => Math.round(po.reduce((t, p) => t + p[f] * p.gp, 0));
  return {
    seasons: po.length,
    gp: po.reduce((t, p) => t + p.gp, 0),
    min: total("min"),
    pts: total("pts"),
    reb: total("reb"),
    ast: total("ast"),
    stl: total("stl"),
    blk: total("blk"),
    w: po.reduce((t, p) => t + p.w, 0),
    l: po.reduce((t, p) => t + p.l, 0),
  };
}

/** 플레이오프에 오르지 못한 시즌의 성적 문구 */
const NO_PLAYOFFS = ["플레이오프 진출 실패", "전국대회 예선 탈락"];

/**
 * 팀이 플레이오프(전국대회 본선)에 오른 시즌인지. 성적 문구로도 봐서 플레이오프 기록이 생기기 전의 시즌도 알아봐요.
 * 군 복무·무소속 시즌은 아니에요.
 */
export const madePlayoffs = (h: SeasonRecord): boolean => !!h.po || (!!h.lg && !h.mil && !NO_PLAYOFFS.includes(h.result));

/** 팀이 플레이오프에 올랐는데 플레이오프 기록이 없는 시즌(이 기능 전에 치른 시즌) */
export const missingPlayoffs = (rows: SeasonRecord[]): SeasonRecord[] => rows.filter((h) => !h.po && madePlayoffs(h));
