import type { Career, LeagueKey, SeasonRecord } from "../core/types";
import { playoffLines, sumShooting, type ShootingLine } from "../season/shooting";
import { sumSeasons } from "./career";
import { sumPlayoffs, type PlayoffTotals } from "./playoffs";

/*
 * 커리어 기록을 리그별, 그 안에서 팀별로 나눠 더해요. 기록 탭과 은퇴 화면의 시즌별 기록이 써요.
 * 같은 이름의 팀이라도 리그가 다르면 따로 세고, 팀을 떠났다가 돌아오면 한 팀으로 합쳐요.
 */

/** 리그 묶음의 키. 상무처럼 리그 없이 경기를 뛴 군 복무 시즌은 "mil"이에요. */
export type SplitKey = LeagueKey | "mil";

/** 한 묶음(리그 또는 팀)의 기록 */
export interface RecordSplit {
  /** 이 묶음의 시즌, 치른 순서대로 */
  rows: SeasonRecord[];
  /** 정규시즌 합계. seasons는 시즌 수, w·l은 팀의 정규시즌 승패예요. */
  regular: PlayoffTotals;
  /** 플레이오프(아마추어는 전국대회 본선) 합계 */
  playoffs: PlayoffTotals;
  /** 정규시즌 야투율·3점 성공률·자유투율·경기당 턴오버 */
  regularShot: ShootingLine;
  /** 플레이오프 야투율·3점 성공률·자유투율·경기당 턴오버 */
  playoffShot: ShootingLine;
  /** 이 묶음에서 우승한 시즌 수 (국가대표 메달은 빼요) */
  titles: number;
  from: number;
  to: number;
}

export interface TeamSplit extends RecordSplit {
  team: string;
}

export interface LeagueSplit extends RecordSplit {
  key: SplitKey;
  /** 이 리그에서 뛴 팀, 처음 뛴 순서대로 */
  teams: TeamSplit[];
}

/** 시즌의 리그 묶음. 현역 복무나 무소속처럼 경기를 뛰지 않은 시즌은 어느 리그에도 넣지 않아요. */
const splitKey = (h: SeasonRecord): SplitKey | null => h.lg ?? (h.mil && h.gp > 0 ? "mil" : null);

function regularTotals(rows: SeasonRecord[]): PlayoffTotals {
  const { gp, pts, reb, ast, stl, blk } = sumSeasons(rows);
  return {
    seasons: rows.length,
    gp,
    min: Math.round(rows.reduce((t, h) => t + h.min * h.gp, 0)),
    pts,
    reb,
    ast,
    stl,
    blk,
    w: rows.reduce((t, h) => t + h.w, 0),
    l: rows.reduce((t, h) => t + h.l, 0),
  };
}

function toSplit(c: Career, rows: SeasonRecord[]): RecordSplit {
  const years = new Set(rows.map((h) => h.year));
  const titleYears = new Set(c.awardLog.filter((a) => (a.k === "ring" || a.k === "title") && years.has(a.y)).map((a) => a.y));
  return {
    rows,
    regular: regularTotals(rows),
    playoffs: sumPlayoffs(rows),
    regularShot: sumShooting(rows),
    playoffShot: sumShooting(playoffLines(rows)),
    titles: titleYears.size,
    from: rows[0].year,
    to: rows[rows.length - 1].year,
  };
}

/** 커리어를 리그별·팀별로 나눠요. 리그와 팀 모두 처음 뛴 순서대로예요. */
export function careerSplits(c: Career): LeagueSplit[] {
  const leagues = new Map<SplitKey, Map<string, SeasonRecord[]>>();
  for (const h of c.hist) {
    const key = splitKey(h);
    if (!key) continue;
    const teams = leagues.get(key) ?? new Map<string, SeasonRecord[]>();
    leagues.set(key, teams);
    teams.set(h.team, [...(teams.get(h.team) ?? []), h]);
  }
  return [...leagues].map(([key, teams]) => {
    const rows = c.hist.filter((h) => splitKey(h) === key);
    return {
      key,
      ...toSplit(c, rows),
      teams: [...teams].map(([team, teamRows]) => ({ team, ...toSplit(c, teamRows) })),
    };
  });
}
