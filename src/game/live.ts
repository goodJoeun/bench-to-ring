import { pick, random, ri, rnd, shuffle } from "./random";
import type { LiveGame, LivePlay } from "./types";

/*
 * 결승전 문자 중계. 최종 점수를 먼저 정한 뒤, 그 점수를 득점(1·2·3점) 단위로 쪼개
 * 경기 시간에 흩뿌려요. 그래서 중계가 어떻게 흘러가든 마지막 점수는 결과와 같아요.
 */

interface LiveInput {
  title: string;
  key: string;
  us: string;
  them: string;
  usColor: string;
  themColor: string;
  usScore: number;
  themScore: number;
  /** 쿼터 길이(분) */
  periodMin: number;
  player: string;
  /** 이 경기에서 넣을 득점·리바운드·어시스트 */
  mine: { pts: number; reb: number; ast: number };
}

/** 점수를 1·2·3점 득점으로 쪼개요. */
function split(total: number): number[] {
  const out: number[] = [];
  let left = total;
  while (left > 0) {
    const r = random();
    const v = left >= 3 && r < 0.3 ? 3 : left >= 2 && r < 0.88 ? 2 : 1;
    out.push(v);
    left -= v;
  }
  return out;
}

const MY_PLAY: Record<number, string[]> = {
  1: ["자유투 성공"],
  2: ["돌파 후 레이업", "미드레인지 점퍼", "플로터", "속공 덩크", "포스트업 훅슛", "앤드원 레이업"],
  3: ["3점슛!", "스텝백 3점슛!", "코너 3점슛!", "딥 3점슛!"],
};
const TEAM_PLAY: Record<number, string[]> = {
  1: ["자유투 성공"],
  2: ["골밑 득점", "속공 레이업", "미드레인지 점퍼", "풋백 득점", "컷인 레이업"],
  3: ["3점슛 성공", "코너 3점슛 성공", "속공 3점슛"],
};

function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function makeLiveGame(i: LiveInput): LiveGame {
  const periods = 4;
  const total = periods * i.periodMin * 60;
  const ours = split(i.usScore);
  const theirs = split(i.themScore);

  // 득점은 경기 내내 고르게 나눠 두고(구간마다 하나씩), 팀마다 초반에 몰아치거나 후반에 몰아치는 흐름만 살짝 줘요.
  // 그래야 한 쿼터에 40점이 나는 식의 비현실적인 흐름이 생기지 않아요.
  type Ev = { t: number; side: "us" | "them"; v: number; mine: boolean };
  const spread = (n: number, k: number, a: number) => {
    const x = (k + rnd(0.15, 0.85)) / n;
    return 4 + (total - 8) * (x + a * x * (1 - x));
  };
  const usFlow = rnd(-0.3, 0.3);
  const themFlow = rnd(-0.3, 0.3);
  const evs: Ev[] = [
    ...shuffle(ours).map((v, k) => ({ t: spread(ours.length, k, usFlow), side: "us" as const, v, mine: false })),
    ...theirs.map((v, k) => ({ t: spread(theirs.length, k, themFlow), side: "them" as const, v, mine: false })),
  ].sort((a, b) => a.t - b.t);

  // 내 득점: 우리 팀 득점 중 일부를 내 것으로 표시해요. 3점·2점을 섞어 목표 득점에 가깝게 맞춰요.
  let need = Math.min(i.mine.pts, i.usScore);
  for (const e of shuffle(evs.filter((x) => x.side === "us"))) {
    if (need <= 0) break;
    if (e.v <= need) {
      e.mine = true;
      need -= e.v;
    }
  }

  const plays: LivePlay[] = [];
  let us = 0;
  let them = 0;
  let q = 1;
  const endQuarter = (n: number) =>
    plays.push({ q: n, clock: "0:00", us, them, mark: true, text: n === periods ? "경기 종료" : `${n}쿼터 종료` });
  for (const e of evs) {
    while (e.t >= q * i.periodMin * 60 && q < periods) endQuarter(q++);
    if (e.side === "us") us += e.v;
    else them += e.v;
    const left = q * i.periodMin * 60 - e.t;
    const text =
      e.side === "us"
        ? e.mine
          ? `${i.player} ${pick(MY_PLAY[e.v])}`
          : `${i.us} ${pick(TEAM_PLAY[e.v])}`
        : `${i.them} ${pick(TEAM_PLAY[e.v])}`;
    plays.push({ q, clock: clock(left), us, them, text, mine: e.mine || undefined });
  }
  while (q < periods) endQuarter(q++);
  endQuarter(periods);
  return {
    title: i.title,
    key: i.key,
    us: i.us,
    them: i.them,
    usColor: i.usColor,
    themColor: i.themColor,
    periods,
    periodMin: i.periodMin,
    plays,
    win: i.usScore > i.themScore,
    mine: { pts: i.mine.pts - Math.max(0, need), reb: i.mine.reb, ast: i.mine.ast },
  };
}

/** 리그별 결승 한 경기 평균 득점 */
export const FINAL_SCORE: Record<string, number> = { nba: 108, gleague: 112, euro: 80, kbl: 80, ncaa: 72, kuniv: 76, hs: 66, fiba: 80 };

/** 평균 득점 기준으로 승패에 맞는 두 팀 점수를 만들어요. 결승답게 대체로 접전이에요. */
export function finalScore(avg: number, win: boolean): [number, number] {
  const loser = Math.round(avg + rnd(-10, 6));
  const margin = random() < 0.55 ? ri(1, 6) : ri(7, 16);
  return win ? [loser + margin, loser] : [loser, loser + margin];
}
