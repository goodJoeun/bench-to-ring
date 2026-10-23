import { chooseOption } from "./actions";
import { HEALTH_RANGE, addAttr, addHealth, clampTrust } from "./condition";
import { ATTRS, POS, ROLE_RANK } from "./data";
import { currentDecision } from "./decisions";
import { bigGameDecision, injuryDecision, seasonEvent } from "./events";
import { LEAGUES, SCORING_TITLE } from "./leagues";
import { FINAL_SCORE, finalScore, gameScore, makeLiveGame } from "./live";
import { addNews, giveAward, pickTeam } from "./log";
import { STUDENT_ALLOWANCE, payInvestments } from "./invest";
import { serviceSeason } from "./military";
import { nationalCallUp } from "./national";
import { runOffseason } from "./offseason";
import { chance, pick, random, ri, rnd } from "./random";
import { shopPerks } from "./shop";
import { BONUS_CAP, SPECIALTIES, combinedEffect, specialtiesOf } from "./specialty";
import { ageBase, ovr, ovrOf, roleOf } from "./ratings";
import type { AttrKey, Career, GameLine, InvestKey, LeagueKey, SeasonRecord, SeasonRun } from "./types";
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
 * NBA는 리그 평균이 워낙 높아 다른 리그와 같은 기준이면 오버롤 100을 훌쩍 넘어야 해서 평균 + 3으로 낮췄어요.
 * NBA까지 가는 선수 자체가 드물어서, 커리어 100개 중 1개 정도에서 NBA MVP가 나와요.
 */
const MVP_AT = 15.5;
const NBA_MVP_AT = 3;

/** 최근 경기 기록을 이만큼 남겨요. */
const LOG_LIMIT = 12;
/** 시즌 중 결정이 생길 확률 (확인 시점마다) */
const EVENT_CHANCE = 0.5;
/** 의료진이 이만큼 이상 쉬라고 하면 복귀 시점을 물어요. */
const ASK_RETURN_AT = 6;
/** 빅매치에서 출전 여부를 물을 확률 (확인 시점마다) */
const BIG_GAME_CHANCE = 0.6;
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
  return Math.max(0.02, risk * (inv.includes("rehab") ? 0.8 : 1) * shopPerks(c).injury);
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
    run.form = shopPerks(c).form;
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
  run.mean = {
    pts: st(2 + 0.38 * (e.sht - 25) + 0.16 * (e.ath - 25) + 0.1 * (e.hdl - 25)) * fx.pts,
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

/** 정규시즌 한 경기 */
function playGame(c: Career, run: SeasonRun, tag: string): void {
  const team = c.team!;
  const lg = team.lg;
  if (run.out === 0 && chance(injuryRisk(c, run.min, run.inv) / run.games)) startInjury(c, run, tag);
  const win = random() < (run.wins - run.w) / (run.games - run.g);
  const n = ++run.g;
  if (win) run.w++;
  else run.l++;
  const [us, them] = gameScore(FINAL_SCORE[lg], win);
  const line: GameLine = { n, opp: pickTeam(lg, new Set([team.name])).name, us, them, win };
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
  addHealth(c, GAME_DAY_HEAL - fatigueOf(run.games) * (m / 30) * shopPerks(c).fatigue);
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
  const out = Math.max(1, Math.round(run.games * frac * shopPerks(c).rehab));
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
  // 몇 라운드를 치르는지: 우승이면 결승까지 모두, 아니면 진 라운드까지
  let rounds = 0;
  if (champ) {
    rounds = 3;
    run.result = amateur ? "전국대회 우승" : "리그 우승";
  } else if (playoffs) {
    const r = random();
    rounds = r < 0.5 ? 1 : r < 0.82 ? 2 : 3;
    run.result = amateur
      ? ["전국대회 8강", "전국대회 4강", "전국대회 준우승"][rounds - 1]
      : ["플레이오프 1라운드", "플레이오프 4강", "챔피언결정전 준우승"][rounds - 1];
  } else run.result = amateur ? "전국대회 예선 탈락" : "플레이오프 진출 실패";
  run.champ = champ;

  const stage = amateur ? "전국대회 본선" : "플레이오프";
  if (!playoffs) {
    run.phase = "end";
    addNews(c, tag, "info", `정규시즌 ${run.w}승 ${run.l}패 · ${stage}에 오르지 못했어요.`);
    return;
  }
  addNews(c, tag, "good", `정규시즌 ${run.w}승 ${run.l}패 · ${stage} 진출!`);
  const names = amateur ? ["전국대회 8강", "전국대회 4강", FINAL_NAME[lg]] : ["플레이오프 1라운드", "플레이오프 4강", FINAL_NAME[lg]];
  // NBA·KBL은 7전 4선승제 시리즈, 나머지는 단판이에요.
  const best7 = lg === "nba" || lg === "kbl";
  const used = new Set([team.name]);
  for (let i = 0; i < rounds; i++) {
    const win = champ || i < rounds - 1;
    const opp = pickTeam(lg, used);
    used.add(opp.name);
    const other = ri(0, 3);
    const series = best7 ? (win ? `4-${other}` : `${other}-4`) : undefined;
    const [us, them] = i === 2 ? finalScore(FINAL_SCORE[lg], win) : gameScore(FINAL_SCORE[lg], win);
    run.post.push({ name: names[i], opp: opp.name, color: opp.color, win, score: series ?? `${us}-${them}` });
    if (i === 2) run.final = { opp: opp.name, us, them, win, series };
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
  const inv = new Set<InvestKey>(run.inv);
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
  if (inv.size) rec.invest = [...inv];
  rec.ovr1 = ovr(p);
  // 시즌이 끝난 여름의 국가대표 대회. 성장까지 반영한 오버롤로 발탁해요.
  const call = nationalCallUp(c, rec.ovr1, played, yr);
  c.peakOvr = Math.max(c.peakOvr, rec.ovr1);
  c.trust = c.team ? clampTrust((rating - 6.3) * 1.4 + (inv.has("video") ? 0.5 : 0)) : 0;
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

  // 시상
  const sh = L.short;
  const impact = (ovr0 - L.avg + (p.trait === "승부사" ? 1 : 0)) * clamp(min / 30, 0, 1.15) + rnd(-2.5, 2.5);
  if (gp >= L.games * 0.6) {
    const mvpAt = lg === "nba" ? NBA_MVP_AT : MVP_AT;
    if (impact >= mvpAt - 2.5 && chance(sigmoid((impact - mvpAt) / 1.2) * (wp >= 0.55 ? 1 : 0.3)))
      giveAward(c, lg === "nba" ? "mvp_nba" : "mvp", `${sh} MVP`, rec);
    if (L.pro && impact >= 5 && chance(sigmoid((impact - 7) / 1.4))) giveAward(c, "allstar", `${sh} 올스타`, rec);
    if (impact >= 9 && chance(sigmoid((impact - 11.5) / 1.3)))
      giveAward(c, "allleague", lg === "nba" ? "올-NBA 퍼스트팀" : `${sh} 베스트5`, rec);
    if (L.pro && c.proSeasons === 0 && impact >= 0 && chance(sigmoid((impact - 2.5) / 1.5)))
      giveAward(c, "roy", lg === "nba" ? "NBA 올해의 신인" : `${sh} 신인왕`, rec);
    if (p.attrs.def - L.avg >= 13 - fx.dpoy && min >= 24 && chance(0.45)) giveAward(c, "dpoy", `${sh} 올해의 수비수`, rec);
    if (rec.pts >= SCORING_TITLE[lg] && chance(0.6)) giveAward(c, "scoring", `${sh} 득점왕`, rec);
    if (L.pro && min >= 18 && min < 26 && impact >= 3 && chance(0.4)) giveAward(c, "sixth", `${sh} 식스맨상`, rec);
  }
  if (champ) {
    giveAward(c, L.pro ? "ring" : "title", L.pro ? `${sh} 우승` : `${sh} 전국대회 우승`, rec);
    if (min >= 26 && impact >= 5 && chance(p.trait === "승부사" ? 0.85 : 0.6)) giveAward(c, "fmvp", `${sh} 파이널 MVP`, rec);
  }
  const prev = c.hist.length ? c.hist[c.hist.length - 1] : null;
  if (L.pro && prev && ov0 - prev.ovr0 >= 6 && chance(0.5)) giveAward(c, "mip", `${sh} 기량발전상`, rec);

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

function grow(c: Career, min: number, rating: number, tag: string, inv: Set<InvestKey>): void {
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
  // 잠재력까지 남은 여유가 클수록 빨리 커요. 잠재력에 가까워져도 0.3배는 남겨 20대 중반까지 조금씩 크고,
  // 잠재력에 닿으면 거의 멈춰요.
  const gap = p.pot - ov;
  const headroom = base <= 0 ? 1 : gap <= 0 ? 0.05 : clamp(0.3 + gap / 8, 0.3, 1.7);
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
    const focus = c.focus === "bal" ? 1 : c.focus === "rest" ? 0.6 : c.focus === k ? 1.5 : 0.85;
    let g: number;
    if (base > 0) g = base * headroom * minutesFactor * tf * perf * focus * rnd(0.55, 1.4);
    else {
      g = base * tf * decline[k] * rnd(0.6, 1.4);
      if (c.focus === k) g *= 0.6;
    }
    // 전담 트레이너: 맡은 능력치는 조금 더 크고, 노화로 떨어질 때는 덜 떨어져요.
    if (c.perks.trainer === k) g *= g > 0 ? 1.15 : 0.8;
    // 시즌 투자와 산 장비
    if (g > 0) {
      if (inv.has("coach")) g *= 1.05;
      g *= gear.growth[k];
      if (k === "ath" && inv.has("gym")) g *= 1.2;
      if (k === "iq" && inv.has("video")) g *= 1.25;
    } else {
      if (k === "ath" && inv.has("gym")) g *= 0.75;
      if (inv.has("diet")) g *= 0.9;
      g *= gear.decline;
    }
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
function recover(c: Career, inv: Set<InvestKey>): void {
  const rest = c.focus === "rest";
  const care = (inv.has("rehab") ? 8 : 0) + (inv.has("diet") ? 6 : 0) + shopPerks(c).heal;
  const heal = (100 - c.health) * (rest ? 0.65 : 0.5) + (rest ? 10 : 6) + care;
  c.health = clamp(c.health + heal - (c.age > 28 ? (c.age - 28) * 1.6 : 0), ...HEALTH_RANGE);
}
