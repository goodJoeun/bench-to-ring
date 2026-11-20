import { POS_KEYS } from "../core/data";
import { TEAMS } from "./leagues";
import { PRO_DRAFT_MARK, homeDraftScore, homeDraftSize, homePick, nbaDraftScore, nbaPick, projectHome, projectNba, undrafted, type HomeDraft } from "../season/decisions";
import { DRAFT_NAMES } from "./paths";
import { addNews, joinTeam, leaveTeam, pickTeam } from "../career/log";
import { chance, pick as pickOne, rnd, shuffle } from "../core/random";
import type { Career, Contract, DraftKey, DraftPick, DraftShow, LeagueKey, Team } from "../core/types";
import { clamp, r1 } from "../core/util";

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

/**
 * 자국 프로 리그 신인드래프트. 두 라운드 동안 모든 구단이 한 번씩 뽑고, 신인 계약은 리그마다 정해진 조건이에요.
 * first는 1라운드 1순위 연봉(억)과 순위마다 줄어드는 폭, second는 2라운드 연봉이에요.
 */
function homeDraft(d: HomeDraft, lg: string, years: number, first: [number, number], second: number): DraftRule {
  const size = homeDraftSize(d);
  return {
    name: DRAFT_NAMES[d],
    lg,
    size,
    // 스카우트 예상 범위는 점수 잡음(±3)이 순위로 옮겨지는 만큼이에요 (KBL 20순위에서 3).
    spread: Math.max(3, Math.round(size * 0.15)),
    pick: (c, noise) => homePick(d, homeDraftScore(c, noise)),
    project: (c) => projectHome(c, d),
    teamQ: { base: 0.28, slope: 0.3 },
    contract: (pick, firstRound) => ({ years, salary: firstRound ? r1(first[0] - (pick - 1) * first[1]) : second }),
  };
}

const DRAFTS: Record<DraftKey, DraftRule> = {
  nba: {
    name: DRAFT_NAMES.nba,
    lg: "NBA",
    size: 60,
    spread: 8,
    pick: (c, noise) => nbaPick(nbaDraftScore(c, noise)),
    project: projectNba,
    teamQ: { base: 0.26, slope: 0.34 },
    // 1라운드는 루키 스케일 4년(1순위 약 150억), 2라운드는 최저 연봉 2년이에요.
    contract: (pick, first) => ({ years: first ? 4 : 2, salary: first ? Math.round(30 + (30 - pick) * 4.2) : 17 }),
  },
  // KBL: 3년, 1라운드 1순위 1.2억부터 순위마다 500만 원씩 줄고 2라운드는 7,000만 원이에요.
  kbl: homeDraft("kbl", "KBL", 3, [1.2, 0.05], 0.7),
  // B.리그: 신인 연봉 상한이 있어요(1순위 약 1.3억).
  bleague: homeDraft("bleague", "B.리그", 3, [1.3, 0.02], 0.6),
  // PBA: 신인 계약은 길어야 3년이고 연봉 상한이 낮아요.
  pba: homeDraft("pba", "PBA", 3, [0.9, 0.04], 0.3),
  // CBA: 신인은 2년짜리 신인 계약으로 시작해요.
  cba: homeDraft("cba", "CBA", 2, [1, 0.02], 0.5),
};

/** 자국 드래프트에 나오는 다른 선수의 출신: 그 나라 대학 리그, 그리고 가끔 나오는 대학 밖 출신과 그 비율 */
const DRAFT_POOL: Record<HomeDraft, { college: LeagueKey; other: string; share: number }> = {
  kbl: { college: "kuniv", other: "고졸", share: 0.1 },
  bleague: { college: "juniv", other: "고졸", share: 0.15 },
  pba: { college: "uaap", other: "해외 대학", share: 0.15 },
  // CBA 드래프트는 구단 청소년팀과 하부 리그(NBL) 출신도 절반 가까이 나와요.
  cba: { college: "cubal", other: "구단 청소년팀", share: 0.4 },
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
  const pool = DRAFT_POOL[draft];
  return `${pos} · ${chance(pool.share) ? pool.other : pickOne(TEAMS[pool.college])[0]}`;
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

  // 프로에서 뛰다가 NBA 드래프트에 나선 선수는 한 번만 신청할 수 있어요.
  const fromPro = c.stage === "pro" && !!c.team;
  if (fromPro && !c.milestones.includes(PRO_DRAFT_MARK)) c.milestones.push(PRO_DRAFT_MARK);

  if (pick > rule.size) {
    c.draftShow = draftBoard(c, draft, null, null);
    addNews(c, tag, "bad", `${rule.name}에서 이름이 불리지 않았어요.`);
    // 계약이 남은 프로 선수는 소속팀에 그대로 남아요.
    if (fromPro && c.contract && c.contract.years > 0) {
      addNews(c, tag, "info", `${c.team!.name}에서 계속 뛰어요. 실력으로 다시 증명할 차례예요.`);
      return;
    }
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
