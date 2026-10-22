import { chooseOption } from "./actions";
import { HEALTH_RANGE, addAttr, addHealth, clampTrust } from "./condition";
import { ATTRS, POS, ROLE_RANK } from "./data";
import { currentDecision } from "./decisions";
import { injuryDecision, seasonEvent } from "./events";
import { LEAGUES, SCORING_TITLE } from "./leagues";
import { FINAL_SCORE, finalScore, gameScore, makeLiveGame } from "./live";
import { addNews, giveAward, pickTeam } from "./log";
import { STUDENT_ALLOWANCE, payInvestments } from "./invest";
import { serviceSeason } from "./military";
import { nationalCallUp } from "./national";
import { runOffseason } from "./offseason";
import { chance, random, ri, rnd } from "./random";
import { ageBase, ovr, ovrOf, roleOf } from "./ratings";
import type { AttrKey, Career, GameLine, InvestKey, LeagueKey, SeasonRecord, SeasonRun } from "./types";
import { clamp, r1, sigmoid } from "./util";

/*
 * 시즌은 세 단계로 흘러가요.
 * startSeason: 투자 비용을 내고, 출전 시간·기록 평균·팀 승수·부상처럼 밸런스를 좌우하는 값을 미리 정해요.
 * stepSeason: 한 칸씩 진행해요. 팀 시즌은 프리시즌 → 정규시즌 한 경기씩 → 플레이오프 한 라운드씩 → 결산이고,
 *             팀이 없는 시즌(무소속·군 복무)은 정해진 일정을 한 칸씩 지나요. 중간에 시즌 중 결정이 생기면 멈춰요.
 * finishSeason: 기록을 합쳐 시상하고, 성장시키고, 오프시즌 결정을 만들어요.
 */

/** MVP 문턱: 이 영향력에서 수상 확률이 절반이에요. NBA는 시작 능력치가 고르게 바뀐 뒤 예전 수상 빈도에 맞춰 올렸어요. */
const MVP_AT = 15.5;
const NBA_MVP_AT = 16.5;

/** 최근 경기 기록을 이만큼 남겨요. */
const LOG_LIMIT = 12;
/** 시즌 중 결정이 생길 확률 (확인 시점마다) */
const EVENT_CHANCE = 0.5;
/** 의료진이 이만큼 이상 쉬라고 하면 복귀 시점을 물어요. */
const ASK_RETURN_AT = 6;

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
    injury: null,
    checks: [],
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
  else planTeamSeason(c, run);
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
  const ovr0 = run.ovr0;
  const posMid = (POS[p.pos].h[0] + POS[p.pos].h[1]) / 2;
  const heightEdge = clamp((p.h + p.wsd * 0.4 - posMid) / 5, -2, 2);
  const rel = ovr0 - L.avg + c.trust + heightEdge;
  const min = clamp(18 + rel * 1.7 + rnd(-3, 3), 1.5, 38);

  // 부상: 다칠지, 얼마나 쉴지, 시즌 중 언제 다칠지까지 미리 정해요.
  let injFrac = 0;
  let injury: { name: string; hp: number; ath: number } | null = null;
  const injuryRisk =
    0.08 +
    (100 - c.health) / 300 +
    (p.trait === "유리몸" ? 0.12 : 0) -
    (p.trait === "강철몸" ? 0.05 : 0) +
    (min / 38) * 0.07 -
    (c.focus === "rest" ? 0.06 : 0) +
    (c.age > 30 ? (c.age - 30) * 0.012 : 0);
  if (chance(injuryRisk * (run.inv.includes("rehab") ? 0.8 : 1))) {
    const r = random();
    if (r < 0.6) {
      injFrac = rnd(0.05, 0.15);
      injury = { name: "가벼운 부상", hp: 0, ath: 0 };
    } else if (r < 0.9) {
      injFrac = rnd(0.2, 0.4);
      injury = { name: "큰 부상", hp: 0, ath: 0 };
    } else {
      injFrac = rnd(0.5, 0.85);
      injury = { name: "시즌 아웃급 부상", hp: 12, ath: ri(2, 4) };
    }
    injury.hp += Math.round(injFrac * 20);
  }
  // 전역 후 첫 시즌은 시즌 중반에 합류해요.
  const avail = Math.round(L.games * (run.back ? 0.6 : 1));
  const gp = Math.max(0, Math.round(L.games * (1 - injFrac) * (run.back ? 0.6 : 1)));
  const late = L.games - avail;
  run.out = late;
  run.outWhy = late ? "합류 전" : "";
  if (injury) {
    const out = Math.max(1, avail - gp);
    run.injury = { ...injury, out, at: ri(late, Math.max(late, L.games - out)) };
  }

  // 기록: 리그 평균 대비 능력치(e)로 36분당 기록을 만든 뒤 출전 시간만큼 줄여요.
  const e = {} as Record<AttrKey, number>;
  for (const [k] of ATTRS) e[k] = p.attrs[k] - L.avg + 50;
  const hd = p.h - 198;
  const wsd = p.wsd;
  const f = min / 36;
  const vr = p.trait === "꾸준함" ? 0.05 : 0.1;
  const st = (v: number) => Math.max(0, v * f * rnd(1 - vr, 1 + vr));
  run.mean = {
    pts: st(2 + 0.38 * (e.sht - 25) + 0.16 * (e.ath - 25) + 0.1 * (e.hdl - 25)),
    // 리바운드는 따로 능력치가 없어요. 키·윙스팬이 가장 크고, 운동능력·수비(박스아웃)·BQ(자리 잡기)가 더해요.
    reb: st(1 + 0.3 * hd + 0.1 * wsd + 0.08 * (e.ath - 25) + 0.07 * (e.def - 25) + 0.04 * (e.iq - 25)),
    ast: st(0.5 + 0.2 * (e.pas - 25) + 0.04 * (e.hdl - 25) + 0.06 * (e.iq - 25)),
    stl: st(0.4 + 0.035 * (e.def - 25) + 0.02 * (e.ath - 25) + 0.02 * wsd),
    blk: st(0.1 + 0.03 * (e.def - 25) + 0.05 * Math.max(0, hd + wsd * 0.5)),
  };
  run.fg = r1(clamp(0.4 + 0.003 * (e.sht - 50) + 0.004 * Math.max(0, hd) + rnd(-0.02, 0.02), 0.33, 0.64) * 100);
  run.rating = clamp(6.2 + (ovr0 - L.avg) / 4.5 + rnd(-0.7, 0.7) + (min < 8 ? -0.4 : 0), 3.5, 9.9);
  run.min = min;

  // 팀 성적: 승수를 먼저 정하고, 경기마다 남은 승수를 나눠 줘요.
  team.q = clamp(team.q + rnd(-0.06, 0.06), 0.2, 0.8);
  const contrib = (ovr0 - L.avg) * 0.011 * clamp(min / 30, 0, 1.2) * (gp / L.games);
  run.games = L.games;
  run.wins = Math.round(L.games * clamp(team.q + contrib + rnd(-0.06, 0.06), 0.1, 0.9));
  // 시즌 중 결정은 정규시즌 초중반과 후반에 한 번씩 생길 수 있어요.
  run.checks = [Math.round(L.games * rnd(0.25, 0.4)), Math.round(L.games * rnd(0.6, 0.8))];
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
  const round = run.post[run.shown++];
  const last = run.shown >= run.post.length;
  if (last) run.phase = "end";
  // 내가 뛴 경기가 있어야 결승 중계를 보여줘요.
  if (last && run.final && run.tot.gp > 0) {
    playFinal(c, run);
    return "final";
  }
  addNews(c, tag, round.win ? "good" : "info", `${round.name} · ${round.opp} 상대 ${round.score} ${round.win ? "승리" : "패배"}`);
  return "step";
}

/** 정규시즌 한 경기 */
function playGame(c: Career, run: SeasonRun, tag: string): void {
  const team = c.team!;
  const lg = team.lg;
  if (run.injury && run.g === run.injury.at) startInjury(c, run, tag);
  const win = random() < (run.wins - run.w) / (run.games - run.g);
  const n = ++run.g;
  if (win) run.w++;
  else run.l++;
  const [us, them] = gameScore(FINAL_SCORE[lg], win);
  const line: GameLine = { n, opp: pickTeam(lg, new Set([team.name])).name, us, them, win };
  if (run.out > 0) {
    line.out = run.outWhy;
    if (--run.out === 0) {
      if (run.outWhy === "부상") addNews(c, tag, "good", "부상에서 회복해 코트로 돌아왔어요.");
      if (run.outWhy === "합류 전") addNews(c, tag, "info", "전역 후 시즌 중반부터 팀에 합류했어요.");
    }
  } else line.me = playMinutes(run);
  run.log.unshift(line);
  if (run.log.length > LOG_LIMIT) run.log.length = LOG_LIMIT;
  // 이벤트로 오른(내린) 경기력은 경기를 치를수록 평소대로 돌아와요.
  run.form *= 0.97;
  if (run.checks.includes(n)) checkEvent(c, EVENT_CHANCE);
}

/** 내가 뛴 한 경기 기록. 시즌 평균을 중심으로 흔들리고, 경기력(폼)만큼 오르내려요. */
function playMinutes(run: SeasonRun): NonNullable<GameLine["me"]> {
  const m = clamp(run.min * rnd(0.8, 1.2), 1, 44);
  const k = (m / run.min) * (1 + run.form * 0.08);
  const one = (v: number) => sround(v * k * rnd(0.5, 1.5));
  const pts = one(run.mean.pts);
  const reb = one(run.mean.reb);
  const ast = one(run.mean.ast);
  const stl = one(run.mean.stl);
  const blk = one(run.mean.blk);
  const rating = r1(clamp(run.rating + run.form * 0.35 + rnd(-1.2, 1.2), 1, 10));
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

function startInjury(c: Career, run: SeasonRun, tag: string): void {
  const inj = run.injury!;
  run.injury = null;
  run.out += inj.out;
  run.outWhy = "부상";
  addHealth(c, -inj.hp);
  if (inj.ath) addAttr(c.p.attrs, "ath", -inj.ath);
  addNews(c, tag, "bad", `${run.g + 1}번째 경기에서 ${inj.name}을 당했어요. ${inj.out}경기쯤 결장할 것 같아요.`);
  if (inj.out >= ASK_RETURN_AT) c.queue.push(injuryDecision(inj.out));
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
  if (growNormally) grow(c, min, rating, tag, inv);
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
  const ovr0 = run.ovr0;
  const ov0 = Math.round(ovr0);
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
    if (p.attrs.def - L.avg >= 13 && min >= 24 && chance(0.45)) giveAward(c, "dpoy", `${sh} 올해의 수비수`, rec);
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
  const minutesFactor =
    age < 19 ? 0.75 + 0.25 * Math.min(1, min / 20) : Math.min(1.05, 0.35 + 0.7 * Math.min(1, min / 28));
  const perf = rating >= 7.5 ? 1.1 : 1;
  const decline: Record<AttrKey, number> = { ath: 1.6, sht: 0.7, iq: 0.25, hdl: 0.9, pas: 0.5, def: 1.1 };
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
    // 시즌 투자
    if (g > 0) {
      if (inv.has("coach")) g *= 1.05;
      if (k === "ath" && inv.has("gym")) g *= 1.2;
      if (k === "iq" && inv.has("video")) g *= 1.25;
    } else {
      if (k === "ath" && inv.has("gym")) g *= 0.75;
      if (inv.has("diet")) g *= 0.9;
    }
    if (k === "iq" && age >= 24 && age <= 33) g += 0.5;
    delta[k] = addAttr(p.attrs, k, g);
  }
  c.lastDelta = delta;
  if (age >= 19 && min < 15 && base > 0 && c.stage !== "hs") {
    const before = p.pot;
    p.pot = Math.max(Math.round(ovrOf(p.attrs, p.pos)) + 1, p.pot - ri(1, min < 8 ? 3 : 2));
    if (p.pot < before) addNews(c, tag, "bad", "출전 시간이 부족해 성장 한계가 조금 낮아졌어요.");
  }
  const care = (inv.has("rehab") ? 8 : 0) + (inv.has("diet") ? 6 : 0);
  c.health = clamp(c.health + (c.focus === "rest" ? 15 : 8) + care - (age > 28 ? (age - 28) * 1.6 : 0), ...HEALTH_RANGE);
}
