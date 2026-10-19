import { POS_KEYS, TEAMS } from "./data";
import { kblDraftScore, kblPick, nbaDraftScore, nbaPick, projectKbl, projectNba, undrafted } from "./decisions";
import { addNews, joinTeam, leaveTeam, pickTeam } from "./log";
import { chance, pick as pickOne, rnd, shuffle } from "./random";
import type { Career, Contract, DraftKey, DraftPick, DraftShow, Team } from "./types";
import { clamp, r1 } from "./util";

interface DraftRule {
  name: string;
  /** 커리어 기록(c.draft)에 남기는 리그 이름 */
  lg: string;
  /** 전체 지명 수. 두 라운드로 나눠요. */
  size: number;
  /** 스카우트 예상 범위의 반폭. 점수 잡음(±3)만큼 잡아요. */
  spread: number;
  /** 드래프트 점수에 잡음을 더해 정한 전체 순위. size보다 크면 미지명이에요. */
  pick: (c: Career, noise: number) => number;
  project: (c: Career) => string;
  /** 뽑은 팀 전력 = base + (순위 / 지명 수) × slope. 상위 지명일수록 약팀이에요. */
  teamQ: { base: number; slope: number };
  contract: (pick: number, firstRound: boolean) => Contract;
}

const DRAFTS: Record<DraftKey, DraftRule> = {
  nba: {
    name: "NBA 드래프트",
    lg: "NBA",
    size: 60,
    spread: 8,
    pick: (c, noise) => nbaPick(nbaDraftScore(c, noise)),
    project: projectNba,
    teamQ: { base: 0.26, slope: 0.34 },
    // 1라운드는 루키 스케일 4년(1순위 약 150억), 2라운드는 최저 연봉 2년이에요.
    contract: (pick, first) => ({ years: first ? 4 : 2, salary: first ? Math.round(30 + (30 - pick) * 4.2) : 17 }),
  },
  kbl: {
    name: "KBL 신인드래프트",
    lg: "KBL",
    size: 20,
    spread: 3,
    pick: (c, noise) => kblPick(kblDraftScore(c, noise)),
    project: projectKbl,
    teamQ: { base: 0.28, slope: 0.3 },
    contract: (pick, first) => ({ years: 3, salary: first ? r1(1.2 - (pick - 1) * 0.05) : 0.7 }),
  },
};

/** 전체 순위를 라운드와 라운드 안 순위로 바꿔요. 31순위 → 2라운드 1순위 (한 라운드 30명) */
export const draftSlot = (no: number, roundSize: number): { round: number; inRound: number } => ({
  round: no <= roundSize ? 1 : 2,
  inRound: ((no - 1) % roundSize) + 1,
});

/** NBA 드래프트에 나오는 해외 유망주 국가 */
const ABROAD = ["프랑스", "세르비아", "스페인", "호주", "캐나다", "독일", "리투아니아", "일본"];

/** 다른 지명 선수 소개: "C · 듀크대" */
function prospect(draft: DraftKey): string {
  const pos = pickOne(POS_KEYS);
  if (draft === "nba") return `${pos} · ${chance(0.25) ? `해외 · ${pickOne(ABROAD)}` : pickOne(TEAMS.ncaa)[0]}`;
  return `${pos} · ${chance(0.1) ? "고졸" : pickOne(TEAMS.kuniv)[0]}`;
}

/**
 * 드래프트 진행 화면에 보여줄 지명 순서를 만들어요. 라운드마다 모든 팀이 한 번씩 뽑고,
 * 내 선수를 뽑은 팀은 그 순위 자리에 들어가요. 미지명이면 끝까지 다른 선수만 불려요.
 */
export function draftBoard(c: Career, draft: DraftKey, mine: number | null, team: Team | null): DraftShow {
  const rule = DRAFTS[draft];
  const roundSize = rule.size / 2;
  const others = shuffle(TEAMS[draft].filter(([name]) => name !== team?.name));
  const slot = mine && team ? (mine - 1) % roundSize : -1;
  const order = slot < 0 ? others : [...others.slice(0, slot), [team!.name, team!.color] as const, ...others.slice(slot)];
  const picks: DraftPick[] = [];
  for (let no = 1; no <= rule.size; no++) {
    const [name, color] = order[(no - 1) % roundSize];
    picks.push(no === mine ? { no, team: name, color, who: c.p.name, mine: true } : { no, team: name, color, who: prospect(draft) });
  }
  const expected = rule.pick(c, 0);
  return {
    name: `${c.year - 1} ${rule.name}`,
    mine,
    proj: rule.project(c),
    range: [clamp(expected - rule.spread, 1, rule.size), clamp(expected + rule.spread, 1, rule.size)],
    roundSize,
    picks,
  };
}

/** 드래프트를 열어요. 지명되면 프로 계약, 아니면 미지명 결정을 대기열 맨 앞에 넣어요. */
export function runDraft(c: Career, draft: DraftKey): void {
  const rule = DRAFTS[draft];
  const yr = c.year - 1;
  const tag = `${yr} ${rule.name}`;
  const pick = rule.pick(c, rnd(-3, 3));

  if (pick > rule.size) {
    c.draftShow = draftBoard(c, draft, null, null);
    addNews(c, tag, "bad", `${rule.name}에서 이름이 불리지 않았어요.`);
    leaveTeam(c);
    c.queue.unshift(undrafted(c));
    return;
  }

  const t = pickTeam(draft);
  // 내 선수를 뽑을 팀이 정해진 뒤에 지명 순서를 만들어요.
  c.draftShow = draftBoard(c, draft, pick, t);
  t.q = clamp(rule.teamQ.base + (pick / rule.size) * rule.teamQ.slope + rnd(-0.05, 0.05), 0.2, 0.75);
  const { round, inRound } = draftSlot(pick, rule.size / 2);
  c.stage = "pro";
  c.contract = rule.contract(pick, round === 1);
  joinTeam(c, draft, t);
  c.draft = { lg: rule.lg, pick, round, inRound, team: t.name, year: yr };
  addNews(c, tag, "big", `${rule.name} ${round}라운드 ${inRound}순위로 ${t.name}에 지명됐어요!`);
}
