import { chooseOption } from "./actions";
import { HEALTH_RANGE, addAttr, addHealth, clampTrust } from "./condition";
import { ATTRS, POS, ROLE_RANK } from "./data";
import { currentDecision } from "./decisions";
import { bigGameDecision, clutchDecision, injuryDecision, seasonEvent } from "./events";
import { LEAGUES, SCORING_TITLE, TEAMS } from "./leagues";
import { FINAL_SCORE, finalScore, gameScore, makeLiveGame } from "./live";
import { ALL_DEF_TIERS, ALL_LEAGUE_TIERS, awardName, conferenceFinalsMvpName } from "./awards";
import { addNews, giveAward, pickTeam } from "./log";
import { STUDENT_ALLOWANCE, investPerks, payInvestments, type InvestPerks } from "./invest";
import { serviceSeason } from "./military";
import { nationalCallUp } from "./national";
import { runOffseason } from "./offseason";
import { chance, pick, random, ri, rnd, shuffle } from "./random";
import { shopPerks } from "./shop";
import { BONUS_CAP, SPECIALTIES, combinedEffect, specialtiesOf } from "./specialty";
import { ageBase, ovr, ovrOf, roleOf } from "./ratings";
import type { AttrKey, AwardKey, Career, GameLine, InvestKey, LeagueKey, SeasonRecord, SeasonRun } from "./types";
import { clamp, josa, r1, sigmoid } from "./util";

/*
 * 시즌은 세 단계로 흘러가요.
 * startSeason: 투자 비용을 내고, 출전 시간·기록 평균·팀 승수처럼 밸런스를 좌우하는 값을 미리 정해요.
 * stepSeason: 한 칸씩 진행해요. 팀 시즌은 프리시즌 → 정규시즌 한 경기씩 → 플레이오프 한 라운드씩 → 결산이고,
 *             팀이 없는 시즌(무소속·군 복무)은 정해진 일정을 한 칸씩 지나요. 중간에 시즌 중 결정이 생기면 멈춰요.
 *             뛴 시간만큼 건강이 닳고, 부상은 경기마다 그때 건강으로 굴려요.
 * finishSeason: 기록을 합쳐 시상하고, 성장시키고, 오프시즌 결정을 만들어요.
 */

/**
 * MVP 문턱: 이 영향력(리그 평균 대비 오버롤 × 출전 비중)에서 수상 확률이 절반이에요.
 * NBA는 리그 평균이 워낙 높아 다른 리그와 같은 기준이면 오버롤 100을 훌쩍 넘어야 해서 평균 + 1로 낮췄어요.
 * 실제로는 아래 기록 문턱(MVP는 20점)이 더 빡빡해서, 커리어 100개 중 5개 정도에서 NBA MVP가 나와요.
 */
const MVP_AT = 15.5;
const NBA_MVP_AT = 1;
/** NBA 올스타·올-NBA를 뽑는 스타 지수의 기준 영향력. MVP 문턱과 따로 둬서 MVP만 쉬워지게 했어요. */
const NBA_STAR_AT = 3;
/** NBA 에이스 득점: 리그 평균 + NBA_ACE_FROM부터 1마다 득점이 NBA_ACE_STEP씩 늘어요. NBA_ACE_CAP까지예요. */
const NBA_ACE_FROM = 2;
const NBA_ACE_STEP = 0.06;
const NBA_ACE_CAP = 0.3;
/**
 * NBA 개인상의 기록 문턱 [경기당 득점, 득점 + 리바운드 + 어시스트]. 영향력이 넘어도 기록이 모자라면 받지 못하고,
 * 올-NBA는 기록이 닿는 팀으로 내려가요. 13점 8리바운드로 퍼스트팀에 들거나 14점으로 MVP를 받는 어색한 시즌을 막아요.
 * 파이널·컨퍼런스 파이널 MVP는 서드팀과 같은 문턱이에요.
 */
const NBA_STAT_FLOOR = { mvp: [20, 32], first: [20, 32], second: [19, 31], third: [17, 29], allstar: [15, 26] } as const;

/** 최근 경기 기록을 이만큼 남겨요. */
const LOG_LIMIT = 12;
/** 시즌 중 결정이 생길 확률 (확인 시점마다) */
const EVENT_CHANCE = 0.5;
/** 의료진이 이만큼 이상 쉬라고 하면 복귀 시점을 물어요. */
const ASK_RETURN_AT = 6;
/** 빅매치에서 출전 여부를 물을 확률 (확인 시점마다) */
const BIG_GAME_CHANCE = 0.6;
/** 에이스가 시즌에 클러치를 두 번 맞을 확률. 나머지는 한 번이고, 주전은 늘 한 번이에요. 주전(예상 26분) 이상일 때만 와요. */
const CLUTCH_TWICE = 0.5;
const STARTER_MIN = 26;
/** 결장하는 경기마다 돌아오는 건강 */
const REST_HEAL = 0.8;
/** 경기를 뛴 날 사이사이 돌아오는 건강 */
const GAME_DAY_HEAL = 0.12;

/**
 * 30분을 뛴 한 경기에서 닳는 건강. 경기가 많은 리그일수록 시즌 전체로는 더 지쳐요.
 * 36분 에이스면 한 시즌에 고교 약 30, KBL 약 41, NBA 약 51이 닳아요(경기 사이 회복 전).
 */
const fatigueOf = (games: number) => (18 + 0.3 * games) / games;

/**
 * NCAA 선수가 경기에 거의 못 나가도 받는 성장 몫(출전 시간 계수의 하한).
 * 강도 높은 팀 훈련과 연습 경기로 프로에서 경기당 11분쯤 뛴 만큼은 커요.
 */
const NCAA_PRACTICE = 0.75;

/** 빅매치 이름 */
const BIG_GAMES = ["라이벌전", "순위 싸움 빅매치", "전국 중계 경기", "연고지 더비"];

/**
 * 한 시즌 동안 다칠 위험. 건강이 낮을수록, 오래 뛸수록, 나이가 많을수록 커요.
 * 경기마다 이 값을 경기 수로 나눈 만큼 굴려서, 시즌 중 건강이 떨어지면 위험이 바로 커져요.
 */
function injuryRisk(c: Career, min: number, inv: InvestKey[]): number {
  const p = c.p;
  const risk =
    0.08 +
    (100 - c.health) / 300 +
    (p.trait === "유리몸" ? 0.12 : 0) -
    (p.trait === "강철몸" ? 0.05 : 0) +
    (min / 38) * 0.07 -
    (c.focus === "rest" ? 0.06 : 0) +
    (c.age > 30 ? (c.age - 30) * 0.012 : 0);
  return Math.max(0.02, risk * investPerks(inv).injury * shopPerks(c).injury);
}

/** 건강이 이보다 낮으면 큰 부상이 길어지고, CRITICAL_HEALTH 아래에서만 시즌 아웃급 부상이 나와요. */
const LOW_HEALTH = 50;
export const CRITICAL_HEALTH = 30;

/**
 * 다쳤을 때 얼마나 심한지: 이름, 결장하는 시즌 비율의 범위, 시즌 아웃급인지. r은 0~1 난수예요.
 * 건강할수록 가벼운 부상이 많고, 시즌 절반 넘게 빠지는 부상은 건강이 아주 낮을 때만 생겨요.
 */
export function injuryKind(health: number, r: number): { name: string; frac: [number, number]; severe: boolean } {
  const light = health < CRITICAL_HEALTH ? 0.45 : health < LOW_HEALTH ? 0.6 : 0.8;
  if (r < light) return { name: "가벼운 부상", frac: [0.03, 0.1], severe: false };
  if (health < CRITICAL_HEALTH && r >= 0.75) return { name: "시즌 아웃급 부상", frac: [0.5, 0.85], severe: true };
  return { name: "큰 부상", frac: [0.12, health < LOW_HEALTH ? 0.3 : 0.22], severe: false };
}

/** 건강이 60 아래로 떨어지면 경기력이 떨어져요 (0~1, 건강 15면 0.6) */
const wornOut = (health: number) => Math.max(0, (60 - health) / 75);

/** 팀 없이 보내는 시즌의 일정 */
const SOLO_PLAN = ["체력 훈련", "기술 훈련", "기술 훈련", "연습 경기", "연습 경기", "개인 훈련 마무리"];
const SANGMU_PLAN = ["기초군사훈련", "D리그 1라운드", "D리그 2라운드", "D리그 3라운드", "국군체육부대 대회", "전역 준비"];
const ARMY_PLAN = ["기초군사훈련", "자대 배치", "복무와 개인 운동", "복무와 개인 운동", "복무와 개인 운동", "전역 준비"];

/** 리그별 결승 이름 */
const FINAL_NAME: Record<LeagueKey, string> = {
  nba: "NBA 파이널",
  kbl: "KBL 챔피언결정전",
  euro: "유로리그 파이널 포 결승",
  gleague: "G리그 파이널",
  ncaa: "NCAA 토너먼트 결승",
  kuniv: "U-리그 챔피언결정전",
  hs: "전국대회 결승",
};

/**
 * 플레이오프 라운드 이름과, 그 라운드에서 졌을 때의 시즌 성적. NBA는 실제처럼 컨퍼런스를 거치는 4라운드예요.
 * lose의 마지막은 결승에서 진 경우예요.
 */
function playoffRounds(lg: LeagueKey): { names: string[]; lose: string[] } {
  if (lg === "nba")
    return {
      names: ["플레이오프 1라운드", "컨퍼런스 세미파이널", "컨퍼런스 파이널", FINAL_NAME.nba],
      lose: ["플레이오프 1라운드", "컨퍼런스 세미파이널", "컨퍼런스 파이널", "파이널 준우승"],
    };
  if (!LEAGUES[lg].pro)
    return { names: ["전국대회 8강", "전국대회 4강", FINAL_NAME[lg]], lose: ["전국대회 8강", "전국대회 4강", "전국대회 준우승"] };
  if (lg === "kbl")
    return { names: ["6강 플레이오프", "4강 플레이오프", FINAL_NAME.kbl], lose: ["6강 플레이오프", "4강 플레이오프", "챔피언결정전 준우승"] };
  return { names: ["플레이오프 1라운드", "플레이오프 4강", FINAL_NAME[lg]], lose: ["플레이오프 1라운드", "플레이오프 4강", "챔피언결정전 준우승"] };
}

/**
 * 우승하지 못한 팀이 몇 라운드에서 떨어지는지 정하는 누적 확률. 결승에서 질 확률(18%)은 리그마다 같고,
 * NBA는 3라운드제의 '4강'(32%)을 컨퍼런스 세미파이널(20%)과 컨퍼런스 파이널(12%)로 나눴어요.
 * 2라운드는 KBL 4강 직행 팀이에요. 6강을 통과한 팀과 같은 비율로 4강(64%)과 결승에서 떨어져요.
 */
const EXIT_AT: Record<number, number[]> = { 2: [0.64], 3: [0.5, 0.82], 4: [0.5, 0.7, 0.82] };

const seasonTag = (run: SeasonRun) => `${run.year} 시즌`;
/** 평균을 지키며 정수로 반올림해요. 0.3이면 30% 확률로 1이에요. */
const sround = (v: number) => Math.floor(v + random());

/** 시즌을 시작해요. 결정이 남았거나 이미 진행 중이면 아무것도 하지 않아요. */
export function startSeason(c: Career): void {
  if (c.run || c.queue.length || c.stage === "retired") return;
  const tag = `${c.year} 시즌`;
  // 시즌 투자는 시즌을 시작할 때 비용을 내고, 이번 시즌에만 효과가 나요.
  const inv = payInvestments(c, tag);
  const back = !!c.mil.back;
  c.mil.back = false;
  const run: SeasonRun = {
    year: c.year,
    phase: "pre",
    plan: [],
    step: 0,
    ovr0: ovrOf(c.p.attrs, c.p.pos),
    spec: [],
    bonus: 0,
    inv: [...inv],
    games: 0,
    g: 0,
    w: 0,
    l: 0,
    wins: 0,
    min: 0,
    rating: 5.5,
    mean: { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 },
    fg: 0,
    form: 0,
    out: 0,
    outWhy: "",
    checks: [],
    bigs: [],
    clutch: false,
    shots: [],
    forced: null,
    back,
    tot: { gp: 0, min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, rating: 0 },
    log: [],
    post: [],
    shown: 0,
    result: "",
    champ: false,
    final: null,
  };
  c.run = run;
  if (c.stage === "military") run.plan = [...(c.mil.kind === "sangmu" ? SANGMU_PLAN : ARMY_PLAN)];
  else if (c.stage === "free" || !c.team) run.plan = [...SOLO_PLAN];
  else {
    planTeamSeason(c, run);
    // 기부 보답으로 받은 경기력은 그 시즌 상점에 남아 있어요.
    const gift = c.shop?.year === c.year ? (c.shop.form ?? 0) : 0;
    run.form = clamp(shopPerks(c).form + investPerks(inv).form + gift, -2, 2);
  }
  if (run.plan.length) {
    // 팀이 없는 시즌은 프리시즌 없이 일정을 시작하고, 중반에 한 번 이벤트를 확인해요.
    run.phase = "reg";
    run.checks = [Math.floor(run.plan.length / 2)];
  }
}

/** 팀 시즌의 출전 시간, 경기당 기록, 팀 승수, 부상을 정해요. */
function planTeamSeason(c: Career, run: SeasonRun): void {
  const p = c.p;
  const team = c.team!;
  const L = LEAGUES[team.lg];
  // 히든 스탯: 평가 오버롤에 보너스를 더하고, 히든 스탯마다 기록에 작은 효과가 나요.
  const hits = specialtiesOf(p.attrs);
  const fx = combinedEffect(hits);
  run.spec = hits.map((h) => h.spec.key);
  run.bonus = Math.min(BONUS_CAP, hits.reduce((t, h) => t + h.bonus, 0));
  const ovr0 = run.ovr0 + run.bonus;
  const posMid = (POS[p.pos].h[0] + POS[p.pos].h[1]) / 2;
  const heightEdge = clamp((p.h + p.wsd * 0.4 - posMid) / 5, -2, 2);
  const rel = ovr0 - L.avg + c.trust + heightEdge;
  const min = clamp(18 + rel * 1.7 + rnd(-3, 3), 1.5, 38);

  // 전역 후 첫 시즌은 시즌 중반에 합류해요. 부상은 경기마다 굴려요(playGame).
  const gp = Math.round(L.games * (run.back ? 0.6 : 1));
  run.out = L.games - gp;
  run.outWhy = run.out ? "합류 전" : "";

  // 기록: 리그 평균 대비 능력치(e)로 36분당 기록을 만든 뒤 출전 시간만큼 줄여요.
  const e = {} as Record<AttrKey, number>;
  for (const [k] of ATTRS) e[k] = p.attrs[k] - L.avg + 50;
  const hd = p.h - 198;
  const wsd = p.wsd;
  const f = min / 36;
  const vr = p.trait === "꾸준함" ? 0.05 : 0.1;
  const st = (v: number) => Math.max(0, v * f * rnd(1 - vr, 1 + vr));
  // 에이스 몫: NBA에서 리그 평균보다 크게 앞선 선수는 공격을 더 맡아 슛을 더 많이 쏴요.
  const ace = team.lg === "nba" ? 1 + clamp((ovr0 - L.avg - NBA_ACE_FROM) * NBA_ACE_STEP, 0, NBA_ACE_CAP) : 1;
  run.mean = {
    pts: st(2 + 0.38 * (e.sht - 25) + 0.16 * (e.ath - 25) + 0.1 * (e.hdl - 25)) * fx.pts * ace,
    // 리바운드는 따로 능력치가 없어요. 키·윙스팬이 가장 크고, 운동능력·수비(박스아웃)·BQ(자리 잡기)가 더해요.
    reb: st(1 + 0.3 * hd + 0.1 * wsd + 0.08 * (e.ath - 25) + 0.07 * (e.def - 25) + 0.04 * (e.iq - 25)) * fx.reb,
    ast: st(0.5 + 0.2 * (e.pas - 25) + 0.04 * (e.hdl - 25) + 0.06 * (e.iq - 25)) * fx.ast,
    stl: st(0.4 + 0.035 * (e.def - 25) + 0.02 * (e.ath - 25) + 0.02 * wsd) * fx.stl,
    blk: st(0.1 + 0.03 * (e.def - 25) + 0.05 * Math.max(0, hd + wsd * 0.5)) * fx.blk,
  };
  run.fg = r1(clamp(0.4 + 0.003 * (e.sht - 50) + 0.004 * Math.max(0, hd) + rnd(-0.02, 0.02), 0.33, 0.64) * 100 + fx.fg);
  run.rating = clamp(6.2 + (ovr0 - L.avg) / 4.5 + fx.rating + rnd(-0.7, 0.7) + (min < 8 ? -0.4 : 0), 3.5, 9.9);
  run.min = min;

  // 팀 성적: 승수를 먼저 정하고, 경기마다 남은 승수를 나눠 줘요.
  team.q = clamp(team.q + rnd(-0.06, 0.06), 0.2, 0.8);
  const contrib = (ovr0 - L.avg) * 0.011 * clamp(min / 30, 0, 1.2) * (gp / L.games) * (ovr0 > L.avg ? fx.team : 1);
  run.games = L.games;
  run.wins = Math.round(L.games * clamp(team.q + contrib + rnd(-0.06, 0.06), 0.1, 0.9));
  // 시즌 중 결정은 정규시즌 초중반과 후반에 한 번씩 생길 수 있어요.
  run.checks = [Math.round(L.games * rnd(0.25, 0.4)), Math.round(L.games * rnd(0.6, 0.8))];
  // 빅매치는 시즌 중반과 막판 순위 싸움에 한 번씩 올 수 있어요.
  run.bigs = [Math.round(L.games * rnd(0.42, 0.55)), Math.round(L.games * rnd(0.85, 0.95))];
  // 클러치 상황은 주전이면 시즌마다 한 번, 에이스면 한 번이나 두 번 와요. 두 번이면 초중반과 중후반에 한 번씩이에요.
  run.shots = roleOf(min) === "에이스" && chance(CLUTCH_TWICE)
    ? [Math.round(L.games * rnd(0.3, 0.5)), Math.round(L.games * rnd(0.65, 0.8))]
    : [Math.round(L.games * rnd(0.3, 0.8))];
}

/** 한 칸 진행한 결과. final이면 결승 중계를, done이면 시즌 결산을 보여줄 차례예요. */
export type SeasonStep = "step" | "final" | "done";

/** 시즌을 한 칸 진행해요. 진행 중인 시즌이 없거나 결정이 남았으면 null이에요. */
export function stepSeason(c: Career): SeasonStep | null {
  const run = c.run;
  if (!run || c.queue.length) return null;
  const tag = seasonTag(run);
  if (run.phase === "end") {
    finishSeason(c);
    return "done";
  }
  if (run.plan.length) {
    run.step++;
    if (run.checks.includes(run.step)) checkEvent(c, 0.4);
    if (run.step >= run.plan.length) run.phase = "end";
    return "step";
  }
  if (run.phase === "pre") {
    run.phase = "reg";
    return "step";
  }
  if (run.phase === "reg") {
    playGame(c, run, tag);
    if (run.g >= run.games) endRegularSeason(c, run, tag);
    return "step";
  }
  // 플레이오프: 한 라운드씩 공개해요. 결승은 문자 중계로 보여줘요.
  const finalNext = !!run.final && run.shown === run.post.length - 1;
  // 결승 직전에는 몸 상태를 보고 출전을 강행할지 물어요. 고르고 나면 같은 칸을 다시 진행해요.
  if (finalNext && !run.clutch && run.tot.gp > 0 && run.out === 0) {
    run.clutch = true;
    c.queue.push(bigGameDecision(c, `${FINAL_NAME[c.team!.lg]}을 앞두고`, true));
    return "step";
  }
  const round = run.post[run.shown++];
  const last = run.shown >= run.post.length;
  if (last) run.phase = "end";
  // 내가 뛴 경기가 있고 다치지 않았어야 결승 중계를 보여줘요.
  if (last && run.final && run.tot.gp > 0) {
    if (run.out === 0) {
      playFinal(c, run);
      return "final";
    }
    addNews(c, tag, "bad", `${run.outWhy === "부상" ? "부상으로" : "몸 상태 때문에"} ${round.name}에 나서지 못했어요.`);
  }
  // 라운드 하나는 여러 경기라 결장도 몇 경기씩 지나가요.
  if (run.out > 0) run.out = Math.max(0, run.out - 3);
  addNews(c, tag, round.win ? "good" : "info", `${round.name} · ${round.opp} 상대 ${round.score} ${round.win ? "승리" : "패배"}`);
  return "step";
}

/**
 * 정규시즌 다음 상대. 실제 일정처럼 한 바퀴에 다른 팀을 모두 한 번씩 무작위 순서로 만나요.
 * 바퀴가 바뀔 때 같은 팀과 백투백으로 붙을 수는 있지만, 한 바퀴 안에서는 모두 달라서 세 번 연속은 없어요.
 */
function nextOpponent(run: SeasonRun, lg: LeagueKey, me: string): readonly [string, string] {
  const pool = TEAMS[lg].filter(([name]) => name !== me);
  let queue = (run.opps ?? []).filter((name) => pool.some(([p]) => p === name));
  if (!queue.length) queue = shuffle(pool.map(([name]) => name));
  const name = queue.shift()!;
  run.opps = queue;
  return pool.find(([p]) => p === name) ?? pick(pool);
}

/** 정규시즌 한 경기 */
function playGame(c: Career, run: SeasonRun, tag: string): void {
  const team = c.team!;
  const lg = team.lg;
  if (run.out === 0 && chance(injuryRisk(c, run.min, run.inv) / run.games)) startInjury(c, run, tag);
  let win = random() < (run.wins - run.w) / (run.games - run.g);
  // 클러치 결과로 정해진 경기: 정해 둔 시즌 승수를 하나 옮겨서라도 결과를 맞춰요.
  const forced = run.forced;
  run.forced = null;
  if (forced) {
    if (forced === "win" && !win && run.wins - run.w <= 0) run.wins++;
    if (forced === "loss" && win && run.games - run.g - (run.wins - run.w) <= 0) run.wins--;
    win = forced === "win";
  }
  const n = ++run.g;
  if (win) run.w++;
  else run.l++;
  // 클러치가 걸린 경기는 전광판에 띄운 상대·동점에서 마지막 플레이로 2점 차가 나요.
  const next = run.next;
  run.next = null;
  const [us, them] = next && forced ? (win ? [next.tie + 2, next.tie] : [next.tie, next.tie + 2]) : gameScore(FINAL_SCORE[lg], win);
  const line: GameLine = { n, opp: next?.opp ?? nextOpponent(run, lg, team.name)[0], us, them, win };
  if (forced) line.clutch = forced;
  if (run.out > 0) {
    line.out = run.outWhy;
    addHealth(c, REST_HEAL);
    if (--run.out === 0) {
      if (run.outWhy === "부상") addNews(c, tag, "good", "부상에서 회복해 코트로 돌아왔어요.");
      if (run.outWhy === "합류 전") addNews(c, tag, "info", "전역 후 시즌 중반부터 팀에 합류했어요.");
    }
  } else line.me = playMinutes(c, run);
  run.log.unshift(line);
  if (run.log.length > LOG_LIMIT) run.log.length = LOG_LIMIT;
  // 이벤트로 오른(내린) 경기력은 경기를 치를수록 평소대로 돌아와요.
  run.form *= 0.97;
  if (run.checks.includes(n)) checkEvent(c, EVENT_CHANCE);
  // 빅매치: 다음 경기에 몸을 던질지 고르게 해요. 로테이션 이상이고 뛸 수 있을 때만이에요.
  else if (run.bigs.includes(n) && run.out === 0 && run.min >= 10 && n < run.games && chance(BIG_GAME_CHANCE))
    c.queue.push(bigGameDecision(c, pick(BIG_GAMES), false));
  // 클러치: 주전 이상이 다음 경기의 마지막 플레이를 맡아요. 정해 둔 경기에 다른 결정이 겹치거나 결장 중이면 다음 경기로 미뤄요.
  else if (run.shots.length > 0 && n >= run.shots[0] && run.out === 0 && run.min >= STARTER_MIN && n < run.games) {
    run.shots.shift();
    // 다음 경기 상대와 4쿼터 막판 동점 점수를 미리 정해 전광판에 띄워요.
    const [oppName, oppColor] = nextOpponent(run, lg, team.name);
    const board = { lg, team: team.name, teamColor: team.color, opp: oppName, oppColor, tie: gameScore(FINAL_SCORE[lg], true)[1] };
    run.next = board;
    c.queue.push(clutchDecision(c, pick(BIG_GAMES), LEAGUES[lg].avg, board));
  }
}

/**
 * 내가 뛴 한 경기 기록. 시즌 평균을 중심으로 흔들리고, 경기력(폼)만큼 오르내려요.
 * 지친 몸(낮은 건강)은 기록과 평점을 깎고, 뛴 시간만큼 건강이 닳아요.
 */
function playMinutes(c: Career, run: SeasonRun): NonNullable<GameLine["me"]> {
  const tired = wornOut(c.health);
  const m = clamp(run.min * rnd(0.8, 1.2), 1, 44);
  const k = (m / run.min) * (1 + run.form * 0.08) * (1 - tired * 0.25);
  const one = (v: number) => sround(v * k * rnd(0.5, 1.5));
  const pts = one(run.mean.pts);
  const reb = one(run.mean.reb);
  const ast = one(run.mean.ast);
  const stl = one(run.mean.stl);
  const blk = one(run.mean.blk);
  const rating = r1(clamp(run.rating + run.form * 0.35 - tired * 1.2 + rnd(-1.2, 1.2), 1, 10));
  addHealth(c, GAME_DAY_HEAL - fatigueOf(run.games) * (m / 30) * shopPerks(c).fatigue * investPerks(run.inv).fatigue);
  const t = run.tot;
  t.gp++;
  t.min += m;
  t.pts += pts;
  t.reb += reb;
  t.ast += ast;
  t.stl += stl;
  t.blk += blk;
  t.rating += rating;
  return { min: Math.round(m), pts, reb, ast, rating };
}

/** 이번 경기 직전에 다쳐요. 그때 건강이 낮을수록 심하고, 시즌 아웃급이면 운동능력도 떨어져요. */
function startInjury(c: Career, run: SeasonRun, tag: string): void {
  const { name, frac: range, severe } = injuryKind(c.health, random());
  const frac = rnd(...range);
  const out = Math.max(1, Math.round(run.games * frac * shopPerks(c).rehab * investPerks(run.inv).rehab));
  run.out = out;
  run.outWhy = "부상";
  addHealth(c, -Math.round(frac * 20) - (severe ? 12 : 0));
  if (severe) addAttr(c.p.attrs, "ath", -ri(2, 4));
  addNews(c, tag, "bad", `${run.g + 1}번째 경기를 앞두고 ${name}을 당했어요. ${out}경기쯤 결장할 것 같아요.`);
  if (out >= ASK_RETURN_AT) c.queue.push(injuryDecision(out));
}

function checkEvent(c: Career, p: number): void {
  if (!chance(p)) return;
  const ev = seasonEvent(c);
  if (ev) c.queue.push(ev);
}

/** 정규시즌 성적으로 플레이오프(전국대회) 진출과 최종 성적을 정하고 라운드를 만들어요. */
function endRegularSeason(c: Career, run: SeasonRun, tag: string): void {
  const team = c.team!;
  const lg = team.lg;
  const amateur = !LEAGUES[lg].pro;
  const wp = run.w / run.games;
  const playoffs = wp >= 0.55 || (wp >= 0.47 && chance(0.4));
  const champ = playoffs && chance(sigmoid((wp - 0.63) / 0.05) * 0.6 + (c.p.trait === "승부사" ? 0.06 : 0));
  // KBL은 정규리그 1·2위가 6강을 건너뛰고 4강으로 직행해요. 54경기에서 1·2위는 대개 승률 6할 5푼 안팎이에요.
  const bye = playoffs && lg === "kbl" && (wp >= 0.65 || (wp >= 0.59 && chance(0.4)));
  // 몇 라운드를 치르는지: 우승이면 결승까지 모두, 아니면 진 라운드까지
  const all = playoffRounds(lg);
  const names = bye ? all.names.slice(1) : all.names;
  const lose = bye ? all.lose.slice(1) : all.lose;
  const total = names.length;
  let rounds = 0;
  if (champ) {
    rounds = total;
    run.result = amateur ? "전국대회 우승" : "리그 우승";
  } else if (playoffs) {
    const r = random();
    const cut = EXIT_AT[total].findIndex((p) => r < p);
    rounds = cut < 0 ? total : cut + 1;
    run.result = lose[rounds - 1];
  } else run.result = amateur ? "전국대회 예선 탈락" : "플레이오프 진출 실패";
  run.champ = champ;

  const stage = amateur ? "전국대회 본선" : "플레이오프";
  if (!playoffs) {
    run.phase = "end";
    addNews(c, tag, "info", `정규시즌 ${run.w}승 ${run.l}패 · ${stage}에 오르지 못했어요.`);
    return;
  }
  addNews(c, tag, "good", `정규시즌 ${run.w}승 ${run.l}패 · ${bye ? "정규리그 2위 안에 들어 4강 플레이오프 직행!" : `${stage} 진출!`}`);
  // NBA·KBL은 7전 4선승제 시리즈, 나머지는 단판이에요.
  const best7 = lg === "nba" || lg === "kbl";
  const used = new Set([team.name]);
  for (let i = 0; i < rounds; i++) {
    const win = champ || i < rounds - 1;
    const opp = pickTeam(lg, used);
    used.add(opp.name);
    const other = ri(0, 3);
    const series = best7 ? (win ? `4-${other}` : `${other}-4`) : undefined;
    const isFinal = i === total - 1;
    const [us, them] = isFinal ? finalScore(FINAL_SCORE[lg], win) : gameScore(FINAL_SCORE[lg], win);
    run.post.push({ name: names[i], opp: opp.name, color: opp.color, win, score: series ?? `${us}-${them}` });
    if (isFinal) run.final = { opp: opp.name, us, them, win, series };
  }
  run.phase = "post";
}

/** 결승 마지막 경기를 문자 중계로 만들어요. */
function playFinal(c: Career, run: SeasonRun): void {
  const team = c.team!;
  const lg = team.lg;
  const f = run.final!;
  const games = f.series ? f.series.split("-").map(Number).reduce((a, b) => a + b, 0) : 0;
  const t = run.tot;
  const vary = (v: number) => Math.max(0, Math.round((v / t.gp) * rnd(0.75, 1.35)));
  c.live = makeLiveGame({
    title: `${run.year} ${FINAL_NAME[lg]}${games ? ` ${games}차전` : ""}`,
    key: `league-${run.year}`,
    us: team.name,
    them: f.opp,
    usColor: team.color,
    themColor: run.post[run.post.length - 1].color,
    usScore: f.us,
    themScore: f.them,
    periodMin: lg === "nba" ? 12 : 10,
    player: c.p.name,
    mine: { pts: vary(t.pts), reb: vary(t.reb), ast: vary(t.ast) },
  });
}

/** 시즌을 결산해요: 기록을 합쳐 시상하고, 성장시키고, 국가대표 발탁과 오프시즌 결정을 만들어요. */
function finishSeason(c: Career): SeasonRecord {
  const run = c.run!;
  const p = c.p;
  const yr = run.year;
  const tag = seasonTag(run);
  const ov0 = Math.round(run.ovr0);
  const inv = investPerks(run.inv);
  let rec: SeasonRecord;
  let min = 0;
  let rating = 6;
  let played = 0;
  let growNormally = true;

  if (c.stage === "military") {
    const s = serviceSeason(c, yr, ov0, tag);
    rec = s.rec;
    min = s.min;
    rating = s.rating;
    played = s.rec.gp;
    growNormally = s.grow;
  } else if (!run.games) {
    rec = {
      year: yr, age: c.age, team: "무소속", lg: null, pro: false, role: "-", gp: 0, min: 0,
      pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fg: 0, rating: 0, w: 0, l: 0,
      result: "개인 훈련", ovr0: ov0, ovr1: ov0, awards: [],
    };
    addNews(c, tag, "info", "소속팀 없이 개인 훈련으로 한 시즌을 보냈어요.");
  } else {
    rec = teamSeasonRecord(c, run, tag);
    min = run.min;
    rating = rec.gp ? rec.rating : 5.5;
    played = rec.gp;
  }

  c.run = null;
  const specBefore = specialtiesOf(p.attrs).map((h) => h.spec.name);
  if (growNormally) grow(c, min, rating, tag, inv);
  for (const h of specialtiesOf(p.attrs))
    if (!specBefore.includes(h.spec.name)) addNews(c, tag, "big", `히든 스탯 발견 · ${h.spec.name}! ${h.spec.desc} (평가 +${h.bonus})`);
  for (const name of specBefore)
    if (!specialtiesOf(p.attrs).some((h) => h.spec.name === name)) addNews(c, tag, "info", `히든 스탯 ${josa(name, "을", "를")} 잃었어요.`);
  if (run.inv.length) rec.invest = [...run.inv];
  rec.ovr1 = ovr(p);
  // 시즌이 끝난 여름의 국가대표 대회. 성장까지 반영한 오버롤로 발탁해요.
  const call = nationalCallUp(c, rec.ovr1, played, yr);
  c.peakOvr = Math.max(c.peakOvr, rec.ovr1);
  c.trust = c.team ? clampTrust((rating - 6.3) * 1.4 + inv.trust) : 0;
  if (c.contract) c.earnings += c.contract.salary;
  if (c.stage === "hs" || c.stage === "college") c.earnings += STUDENT_ALLOWANCE;
  c.hist.push(rec);
  c.last = rec;
  c.age++;
  c.year++;
  runOffseason(c, yr, call);
  return rec;
}

/** 팀 시즌의 경기 기록을 합치고 시상해요. */
/**
 * 경기당 3점슛 성공. 득점 가운데 3점으로 넣은 몫을 슛 능력과 키로 정해요. 운은 쓰지 않아서 시즌 진행의 난수 흐름은 그대로예요.
 * 슛 70인 190cm 가드가 20점을 넣으면 1.9개, 슛 50인 212cm 센터는 거의 없어요. 많아도 득점의 36%까지예요.
 */
function threesPerGame(pts: number, p: Career["p"]): number {
  const share = clamp(0.1 + (p.attrs.sht - 50) * 0.009 - Math.max(0, p.h - 200) * 0.012, 0.02, 0.36);
  return r1((pts * share) / 3);
}

function teamSeasonRecord(c: Career, run: SeasonRun, tag: string): SeasonRecord {
  const p = c.p;
  const team = c.team!;
  const lg = team.lg;
  const L = LEAGUES[lg];
  // 시상은 히든 스탯까지 반영한 평가 오버롤로, 기록에 남는 오버롤은 그대로예요.
  const ovr0 = run.ovr0 + run.bonus;
  const ov0 = Math.round(run.ovr0);
  const fx = combinedEffect(SPECIALTIES.filter((s) => run.spec.includes(s.key)).map((spec) => ({ spec, bonus: 0 })));
  const t = run.tot;
  const gp = t.gp;
  const avg = (v: number) => (gp ? r1(v / gp) : 0);
  const min = run.min;
  const W = run.w;
  const wp = W / run.games;
  const role = roleOf(min);
  const champ = run.champ;
  const rec: SeasonRecord = {
    year: run.year, age: c.age, team: team.name, lg, pro: L.pro, role, gp, min: avg(t.min),
    pts: avg(t.pts), reb: avg(t.reb), ast: avg(t.ast), stl: avg(t.stl), blk: avg(t.blk), fg: gp ? run.fg : 0,
    rating: gp ? r1(clamp(t.rating / gp, 3.5, 9.9)) : 5.5, w: W, l: run.l, result: run.result, ovr0: ov0, ovr1: ov0, awards: [],
  };
  if (gp > 0 && run.final) rec.final = run.final;
  if (gp > 0) rec.tpm = threesPerGame(rec.pts, p);

  // 시상: 리그마다 실제 이름으로 줘요(awards.ts). 베스트 팀·올-디펜시브는 활약에 따라 퍼스트·세컨드·서드로 나눠요.
  const sh = L.short;
  const give = (k: AwardKey, tier = 1) => giveAward(c, k, awardName(lg, k, tier), rec);
  // 영향력 = 실력 몫(core) + 운(noise)
  const core = (ovr0 - L.avg + (p.trait === "승부사" ? 1 : 0)) * clamp(min / 30, 0, 1.15);
  const noise = rnd(-2.5, 2.5);
  const impact = core + noise;
  const rookie = L.pro && c.proSeasons === 0;
  const nba = lg === "nba";
  const pra = rec.pts + rec.reb + rec.ast;
  const statsOk = (k: keyof typeof NBA_STAT_FLOOR) => !nba || (rec.pts >= NBA_STAT_FLOOR[k][0] && pra >= NBA_STAT_FLOOR[k][1]);
  if (gp >= L.games * 0.6) {
    const mvpAt = nba ? NBA_MVP_AT : MVP_AT;
    // 팀 성적이 아쉬우면 MVP가 어려워요. NBA는 기록 문턱이 있어서 다른 리그보다 덜 깎아요.
    const mvp = statsOk("mvp") && impact >= mvpAt - 2.5 && chance(sigmoid((impact - mvpAt) / 1.2) * (wp >= 0.55 ? 1 : nba ? 0.6 : 0.3));
    if (mvp) give(nba ? "mvp_nba" : "mvp");
    // 스타 지수: MVP 문턱에 맞춘 영향력. NBA는 리그 평균에 가까운 NBA_STAR_AT을 MVP 문턱 자리에 두고 선수 간 차이가 좁아서,
    // 실력 몫만 펼치고 운은 그대로 더해요. 그래서 올스타·베스트 팀이 리그마다 MVP와 같은 눈높이로 뽑혀요.
    const star = nba ? MVP_AT + (core - NBA_STAR_AT) * 5.5 + noise : impact;
    if (L.pro && (mvp || (statsOk("allstar") && star >= 5 && chance(sigmoid((star - 7) / 1.4))))) give("allstar");
    // 베스트 팀: 베스트5 하나뿐인 리그는 예전 기준 그대로, 여러 팀이 있으면 기준을 낮추고 활약에 따라 팀을 나눠요. MVP는 늘 퍼스트팀이에요.
    const tiers = ALL_LEAGUE_TIERS[lg];
    if (mvp) give("allleague");
    else if (tiers === 1) {
      if (star >= 9 && chance(sigmoid((star - 11.5) / 1.3))) give("allleague");
    } else if (statsOk("third") && star >= 7 && chance(sigmoid((star - 10) / 1.3))) {
      const tier = star >= 11.5 && statsOk("first") ? 1 : tiers === 3 && (star < 9.5 || !statsOk("second")) ? 3 : 2;
      give(tier === 1 ? "allleague" : "allleague2", tier);
    }
    // 수비: 올해의 수비수는 예전 기준 그대로, 올-디펜시브는 그보다 조금 낮은 수비수까지 뽑혀요.
    const defEdge = p.attrs.def - L.avg + fx.dpoy;
    const dpoy = defEdge >= 13 && min >= 24 && chance(0.45);
    if (dpoy) give("dpoy");
    if (dpoy || (defEdge >= 9 && min >= 22 && chance(sigmoid((defEdge - 11) / 1.5))))
      give("alldef", dpoy || ALL_DEF_TIERS[lg] === 1 || defEdge >= 12.5 ? 1 : 2);
    if (rookie && impact >= 0 && chance(sigmoid((impact - 2.5) / 1.5))) give("roy");
    if (rookie && nba && impact >= -2 && chance(sigmoid((impact - 0.5) / 1.5))) give("allrookie");
    if (rec.pts >= SCORING_TITLE[lg] && chance(0.6)) give("scoring");
    if (L.pro && min >= 18 && min < 26 && impact >= 3 && chance(0.4)) give("sixth");
  }
  // NBA 파이널에 올랐으면 컨퍼런스 파이널을 이긴 거예요. 그 시리즈를 이끈 선수에게 컨퍼런스 파이널 MVP를 줘요.
  const wonConference = nba && run.post.some((r) => r.name === FINAL_NAME.nba);
  if (wonConference && gp > 0 && min >= 26 && impact >= 5 && statsOk("third") && chance(p.trait === "승부사" ? 0.8: 0.55))
    giveAward(c, "cfmvp", conferenceFinalsMvpName(team.name), rec);
  if (champ) {
    giveAward(c, L.pro ? "ring" : "title", L.pro ? `${sh} 우승` : `${sh} 전국대회 우승`, rec);
    if (min >= 26 && impact >= 5 && statsOk("third") && chance(p.trait === "승부사" ? 0.85 : 0.6)) give("fmvp");
  }
  const prev = c.hist.length ? c.hist[c.hist.length - 1] : null;
  if (L.pro && prev && ov0 - prev.ovr0 >= 6 && chance(0.5)) give("mip");

  // 소식
  if (L.pro && c.proSeasons === 0) addNews(c, tag, "big", `프로 데뷔 시즌! ${team.name}에서 ${gp}경기를 뛰었어요.`);
  addNews(c, tag, champ ? "award" : "info", `${team.name} ${W}승 ${run.l}패 · ${rec.result}`);
  if (rec.final)
    addNews(c, tag, rec.final.win ? "award" : "info", `${FINAL_NAME[lg]} 상대 ${rec.final.opp} · ${rec.final.series ? `시리즈 ${rec.final.series} · ` : ""}마지막 경기 ${rec.final.us}-${rec.final.them}`);
  if (prev && prev.team === rec.team && prev.role !== "-" && ROLE_RANK[role] > ROLE_RANK[prev.role])
    addNews(c, tag, "good", `팀 내 역할이 ${role}(으)로 올라섰어요.`);
  rec.awards.forEach((n) => addNews(c, tag, "award", `수상 · ${n}`));
  if (L.pro) c.proSeasons++;
  return rec;
}

/**
 * 시즌을 처음부터 끝까지 한 번에 진행해요. 시즌 중 결정은 무작위로 골라요.
 * 테스트와 밸런스 측정처럼 화면 없이 커리어를 돌릴 때 써요.
 */
export function simulateSeason(c: Career): SeasonRecord {
  startSeason(c);
  while (c.run) {
    const d = currentDecision(c);
    if (d) chooseOption(c, ri(0, d.opts.length - 1));
    else stepSeason(c);
  }
  return c.last!;
}

/** 진행 막대에 보여줄 지금 단계와 진행률 (0~1) */
export function seasonProgress(run: SeasonRun): { label: string; pct: number } {
  if (run.plan.length) {
    const i = Math.min(run.step, run.plan.length - 1);
    return { label: run.phase === "end" ? "시즌 결산" : run.plan[i], pct: run.step / run.plan.length };
  }
  // 프리시즌 1칸 + 정규시즌 + 플레이오프 라운드(정해지기 전에는 3칸으로 셈) + 결산 1칸
  const rounds = run.phase === "pre" || run.phase === "reg" ? 3 : run.post.length;
  const pct = ((run.phase === "pre" ? 0 : 1) + run.g + run.shown) / (run.games + rounds + 2);
  const label =
    run.phase === "pre"
      ? "프리시즌"
      : run.phase === "reg"
        ? `정규시즌 ${run.g}/${run.games}경기`
        : run.phase === "post"
          ? run.post[run.shown].name
          : "시즌 결산";
  return { label, pct };
}

function grow(c: Career, min: number, rating: number, tag: string, inv: InvestPerks): void {
  const p = c.p;
  const age = c.age;
  const base = ageBase(age);
  const t = p.trait;
  const ov = ovrOf(p.attrs, p.pos);
  let tf = 1;
  if (base > 0) {
    if (t === "조기성장") tf = age < 20 ? 1.25 : age >= 24 ? 0.7 : 1;
    if (t === "대기만성") tf = age < 20 ? 0.8 : age >= 22 && age <= 28 ? 1.35 : 1;
    if (t === "꾸준함") tf = 1.05;
  } else {
    if (t === "대기만성" && age <= 32) tf = 0.5;
    if (t === "강철몸") tf = 0.7;
  }
  // 잠재력까지 남은 여유가 클수록 빨리 커요. 잠재력에 가까워져도 0.3배는 남겨요.
  // 27세까지는 잠재력에 닿아도 0.45배로 조금씩 더 커서, 20대 중반에도 성장이 이어져요. 그 뒤로는 거의 멈춰요.
  const gap = p.pot - ov;
  const headroom = base <= 0 ? 1 : gap <= 0 ? (age <= 27 ? 0.45 : 0.05) : clamp(0.3 + gap / 8, 0.3, 1.7);
  // 출전 시간: 10대는 영향이 작고, 성인은 크게 받아요. 주전급(28분)이어야 제대로 커요.
  // NCAA 선수는 벤치에 있어도 팀 훈련으로 크고(NCAA_PRACTICE), 성장 한계도 깎이지 않아요(아래).
  const ncaa = c.stage === "college" && c.team?.lg === "ncaa";
  const played = age < 19 ? 0.75 + 0.25 * Math.min(1, min / 20) : Math.min(1.05, 0.35 + 0.7 * Math.min(1, min / 28));
  const minutesFactor = ncaa ? Math.max(played, NCAA_PRACTICE) : played;
  const perf = rating >= 7.5 ? 1.1 : 1;
  const decline: Record<AttrKey, number> = { ath: 1.6, sht: 0.7, iq: 0.25, hdl: 0.9, pas: 0.5, def: 1.1 };
  const gear = shopPerks(c);
  const delta: Partial<Record<AttrKey, number>> = {};
  for (const [k] of ATTRS) {
    // 균형은 모든 능력치가 1.1배, 집중은 고른 능력치만 1.5배로 커요.
    const focus = c.focus === "bal" ? 1.1 : c.focus === "rest" ? 0.6 : c.focus === k ? 1.5 : 1;
    let g: number;
    if (base > 0) g = base * headroom * minutesFactor * tf * perf * focus * rnd(0.55, 1.4);
    else {
      g = base * tf * decline[k] * rnd(0.6, 1.4);
      if (c.focus === k) g *= 0.6;
    }
    // 전담 트레이너: 맡은 능력치는 조금 더 크고, 노화로 떨어질 때는 덜 떨어져요.
    if (c.perks.trainer === k) g *= g > 0 ? 1.15 : 0.8;
    // 시즌 투자와 산 장비
    g *= g > 0 ? inv.growth[k] * gear.growth[k] : inv.decline[k] * gear.decline;
    if (k === "iq" && age >= 24 && age <= 33) g += 0.5;
    delta[k] = addAttr(p.attrs, k, g);
  }
  c.lastDelta = delta;
  if (age >= 19 && min < 15 && base > 0 && c.stage !== "hs" && !ncaa) {
    const before = p.pot;
    p.pot = Math.max(Math.round(ovrOf(p.attrs, p.pos)) + 1, p.pot - ri(1, min < 8 ? 3 : 2));
    if (p.pot < before) addNews(c, tag, "bad", "출전 시간이 부족해 성장 한계가 조금 낮아졌어요.");
  }
  recover(c, inv);
}

/**
 * 시즌이 끝난 뒤 쉬며 회복해요. 많이 닳았을수록 많이 돌아오지만 다 채우지는 못해서,
 * 해마다 오래 뛰는 선수는 건강이 낮은 채로 다음 시즌을 시작해요. 시즌에 D만큼 닳는 선수는 대략 112 - D에서 시작해요.
 */
function recover(c: Career, inv: InvestPerks): void {
  const rest = c.focus === "rest";
  const care = inv.heal + shopPerks(c).heal;
  const heal = (100 - c.health) * (rest ? 0.65 : 0.5) + (rest ? 10 : 6) + care;
  c.health = clamp(c.health + heal - (c.age > 28 ? (c.age - 28) * 1.6 : 0), ...HEALTH_RANGE);
}
