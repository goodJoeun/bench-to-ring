import { POS_KEYS, TEAMS } from "./data";
import { kblDraftScore, kblPick, nbaDraftScore, nbaPick, projectKbl, projectNba, undrafted } from "./decisions";
import { addNews, pickTeam, setTeam } from "./log";
import { chance, pick as pickOne, rnd, shuffle } from "./random";
import type { Career, DraftPick, DraftShow, Team } from "./types";
import { clamp, r1 } from "./util";

/** NBA 드래프트에 나오는 해외 유망주 국가 */
const ABROAD = ["프랑스", "세르비아", "스페인", "호주", "캐나다", "독일", "리투아니아", "일본"];

/** 다른 지명 선수 소개: "C · 듀크대" */
function prospect(draft: "nba" | "kbl"): string {
  const pos = pickOne(POS_KEYS);
  if (draft === "nba") return `${pos} · ${chance(0.25) ? `해외 · ${pickOne(ABROAD)}` : pickOne(TEAMS.ncaa)[0]}`;
  return `${pos} · ${chance(0.1) ? "고졸" : pickOne(TEAMS.kuniv)[0]}`;
}

/**
 * 드래프트 진행 화면에 보여줄 지명 순서를 만들어요. 라운드마다 모든 팀이 한 번씩 뽑고,
 * 내 선수를 뽑은 팀은 그 순위 자리에 들어가요. 미지명이면 끝까지 다른 선수만 불려요.
 */
export function draftBoard(c: Career, draft: "nba" | "kbl", mine: number | null, team: Team | null): DraftShow {
  const nba = draft === "nba";
  const size = nba ? 60 : 20;
  const roundSize = size / 2;
  const others = shuffle(TEAMS[draft].filter(([name]) => name !== team?.name));
  const slot = mine && team ? (mine - 1) % roundSize : -1;
  const order = slot < 0 ? others : [...others.slice(0, slot), [team!.name, team!.color] as const, ...others.slice(slot)];
  const picks: DraftPick[] = [];
  for (let no = 1; no <= size; no++) {
    const [name, color] = order[(no - 1) % roundSize];
    picks.push(no === mine ? { no, team: name, color, who: c.p.name, mine: true } : { no, team: name, color, who: prospect(draft) });
  }
  // 점수 잡음(±3)만큼 스카우트 예상 범위를 잡아요.
  const expected = nba ? nbaPick(nbaDraftScore(c, 0)) : kblPick(kblDraftScore(c, 0));
  const spread = nba ? 8 : 3;
  return {
    name: `${c.year - 1} ${nba ? "NBA 드래프트" : "KBL 신인드래프트"}`,
    mine,
    proj: nba ? projectNba(c) : projectKbl(c),
    range: [clamp(expected - spread, 1, size), clamp(expected + spread, 1, size)],
    roundSize,
    picks,
  };
}

/** 드래프트를 열어요. 지명되면 프로 계약, 아니면 미지명 결정을 대기열 맨 앞에 넣어요. */
export function runDraft(c: Career, draft: "nba" | "kbl"): void {
  const yr = c.year - 1;
  const nba = draft === "nba";
  const draftName = nba ? "NBA 드래프트" : "KBL 신인드래프트";
  const tag = `${yr} ${draftName}`;
  const pick = nba ? nbaPick(nbaDraftScore(c, rnd(-3, 3))) : kblPick(kblDraftScore(c, rnd(-3, 3)));
  const size = nba ? 60 : 20;
  const roundSize = size / 2;

  if (pick > size) {
    c.draftShow = draftBoard(c, draft, null, null);
    addNews(c, tag, "bad", `${draftName}에서 이름이 불리지 않았어요.`);
    c.stage = "free";
    c.team = null;
    c.contract = null;
    c.queue.unshift(undrafted(c));
    return;
  }

  const t = pickTeam(draft);
  // 내 선수를 뽑을 팀이 정해진 뒤에 지명 순서를 만들어요.
  c.draftShow = draftBoard(c, draft, pick, t);
  // 상위 지명일수록 약팀에 가요.
  t.q = clamp((nba ? 0.26 : 0.28) + (pick / size) * (nba ? 0.34 : 0.3) + rnd(-0.05, 0.05), 0.2, 0.75);
  const firstRound = pick <= roundSize;
  const inRound = firstRound ? pick : pick - roundSize;
  c.stage = "pro";
  // NBA 1라운드는 루키 스케일 4년(1순위 약 150억), 2라운드는 최저 연봉 2년이에요.
  c.contract = nba
    ? { years: firstRound ? 4 : 2, salary: firstRound ? Math.round(30 + (30 - pick) * 4.2) : 17 }
    : { years: 3, salary: firstRound ? r1(1.2 - (pick - 1) * 0.05) : 0.7 };
  setTeam(c, draft, t);
  c.trust = 0;
  c.draft = { lg: nba ? "NBA" : "KBL", pick, round: firstRound ? 1 : 2, inRound, team: t.name, year: yr };
  addNews(c, tag, "big", `${draftName} ${firstRound ? 1 : 2}라운드 ${inRound}순위로 ${t.name}에 지명됐어요!`);
}
