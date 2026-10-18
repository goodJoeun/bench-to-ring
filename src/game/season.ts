import { ATTRS, LEAGUES, POS, ROLE_RANK, SCORING_TITLE } from "./data";
import { FINAL_SCORE, finalScore, makeLiveGame } from "./live";
import { addNews, giveAward, pickTeam } from "./log";
import { serviceSeason } from "./military";
import { nationalCallUp } from "./national";
import { runOffseason } from "./offseason";
import { chance, random, ri, rnd } from "./random";
import { ageBase, ovr, ovrOf, roleOf } from "./ratings";
import type { AttrKey, Career, LeagueKey, SeasonRecord } from "./types";
import { clamp, r1, sigmoid } from "./util";

/** 한 시즌을 치르고, 성장시키고, 오프시즌 결정까지 만들어요. */
export function simulateSeason(c: Career): SeasonRecord {
  const p = c.p;
  const yr = c.year;
  const tag = `${yr} 시즌`;
  const ovr0 = ovrOf(p.attrs, p.pos);
  const ov0 = Math.round(ovr0);
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
  } else if (c.stage === "free" || !c.team) {
    rec = {
      year: yr, age: c.age, team: "무소속", lg: null, pro: false, role: "-", gp: 0, min: 0,
      pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fg: 0, rating: 0, w: 0, l: 0,
      result: "개인 훈련", ovr0: ov0, ovr1: ov0, awards: [],
    };
    addNews(c, tag, "info", "소속팀 없이 개인 훈련으로 한 시즌을 보냈어요.");
  } else {
    const lg = c.team.lg;
    const L = LEAGUES[lg];
    const posMid = (POS[p.pos].h[0] + POS[p.pos].h[1]) / 2;
    const heightEdge = clamp((p.h + p.wsd * 0.4 - posMid) / 5, -2, 2);
    const rel = ovr0 - L.avg + c.trust + heightEdge;
    min = clamp(18 + rel * 1.7 + rnd(-3, 3), 1.5, 38);

    // 부상
    let injury: string | null = null;
    let injFrac = 0;
    const injuryRisk =
      0.08 +
      (100 - c.health) / 300 +
      (p.trait === "유리몸" ? 0.12 : 0) -
      (p.trait === "강철몸" ? 0.05 : 0) +
      (min / 38) * 0.07 -
      (c.focus === "rest" ? 0.06 : 0) +
      (c.age > 30 ? (c.age - 30) * 0.012 : 0);
    if (chance(injuryRisk)) {
      const r = random();
      if (r < 0.6) {
        injFrac = rnd(0.05, 0.15);
        injury = "가벼운 부상";
      } else if (r < 0.9) {
        injFrac = rnd(0.2, 0.4);
        injury = "큰 부상";
      } else {
        injFrac = rnd(0.5, 0.85);
        injury = "시즌 아웃급 부상";
        p.attrs.ath = Math.max(20, p.attrs.ath - ri(2, 4));
        c.health -= 12;
      }
      c.health = Math.max(15, c.health - Math.round(injFrac * 20));
    }
    // 전역 후 첫 시즌은 시즌 중반에 합류해요.
    const back = !!c.mil.back;
    c.mil.back = false;
    const gp = Math.max(0, Math.round(L.games * (1 - injFrac) * (back ? 0.6 : 1)));

    // 스탯: 리그 평균 대비 능력치(e)로 36분당 기록을 만든 뒤 출전 시간만큼 줄여요.
    const e = {} as Record<AttrKey, number>;
    for (const [k] of ATTRS) e[k] = p.attrs[k] - L.avg + 50;
    const hd = p.h - 198;
    const wsd = p.wsd;
    const f = min / 36;
    const vr = p.trait === "꾸준함" ? 0.05 : 0.1;
    const st = (v: number) => (gp ? r1(Math.max(0, v * f * rnd(1 - vr, 1 + vr))) : 0);
    const pts = st(2 + 0.38 * (e.sht - 25) + 0.16 * (e.ath - 25) + 0.1 * (e.hdl - 25));
    const reb = st(1 + 0.22 * (e.reb - 25) + 0.15 * hd + 0.05 * (e.ath - 25) + 0.05 * wsd);
    const ast = st(0.5 + 0.22 * (e.hdl - 25) + 0.06 * (e.iq - 25));
    const stl = st(0.4 + 0.035 * (e.def - 25) + 0.02 * (e.ath - 25) + 0.02 * wsd);
    const blk = st(0.1 + 0.03 * (e.def - 25) + 0.05 * Math.max(0, hd + wsd * 0.5));
    const fg = gp ? r1(clamp(0.4 + 0.003 * (e.sht - 50) + 0.004 * Math.max(0, hd) + rnd(-0.02, 0.02), 0.33, 0.64) * 100) : 0;
    rating = gp ? r1(clamp(6.2 + (ovr0 - L.avg) / 4.5 + rnd(-0.7, 0.7) + (min < 8 ? -0.4 : 0), 3.5, 9.9)) : 5.5;

    // 팀 성적
    c.team.q = clamp(c.team.q + rnd(-0.06, 0.06), 0.2, 0.8);
    const contrib = (ovr0 - L.avg) * 0.011 * clamp(min / 30, 0, 1.2) * (gp / L.games);
    const W = Math.round(L.games * clamp(c.team.q + contrib + rnd(-0.06, 0.06), 0.1, 0.9));
    const Lo = L.games - W;
    const wp = W / L.games;
    const playoffs = wp >= 0.55 || (wp >= 0.47 && chance(0.4));
    const champ = playoffs && chance(sigmoid((wp - 0.63) / 0.05) * 0.6 + (p.trait === "승부사" ? 0.06 : 0));
    const amateur = !L.pro;
    let result: string;
    if (champ) result = amateur ? "전국대회 우승" : "리그 우승";
    else if (playoffs) {
      const r = random();
      result = amateur
        ? r < 0.5 ? "전국대회 8강" : r < 0.82 ? "전국대회 4강" : "전국대회 준우승"
        : r < 0.5 ? "플레이오프 1라운드" : r < 0.82 ? "플레이오프 4강" : "챔피언결정전 준우승";
    } else result = amateur ? "전국대회 예선 탈락" : "플레이오프 진출 실패";

    const role = roleOf(min);
    rec = {
      year: yr, age: c.age, team: c.team.name, lg, pro: L.pro, role, gp, min: r1(min),
      pts, reb, ast, stl, blk, fg, rating, w: W, l: Lo, result, ovr0: ov0, ovr1: ov0, awards: [],
    };

    // 결승(챔피언결정전)에 오르면 마지막 경기를 문자 중계로 남겨요.
    if (gp > 0 && (champ || result.endsWith("준우승"))) playFinal(c, rec, lg, champ);

    // 시상
    const sh = L.short;
    const impact = (ovr0 - L.avg + (p.trait === "승부사" ? 1 : 0)) * clamp(min / 30, 0, 1.15) + rnd(-2.5, 2.5);
    if (gp >= L.games * 0.6) {
      if (impact >= 13 && chance(sigmoid((impact - 15.5) / 1.2) * (wp >= 0.55 ? 1 : 0.3)))
        giveAward(c, lg === "nba" ? "mvp_nba" : "mvp", `${sh} MVP`, rec);
      if (L.pro && impact >= 5 && chance(sigmoid((impact - 7) / 1.4))) giveAward(c, "allstar", `${sh} 올스타`, rec);
      if (impact >= 9 && chance(sigmoid((impact - 11.5) / 1.3)))
        giveAward(c, "allleague", lg === "nba" ? "올-NBA 퍼스트팀" : `${sh} 베스트5`, rec);
      if (L.pro && c.proSeasons === 0 && impact >= 0 && chance(sigmoid((impact - 2.5) / 1.5)))
        giveAward(c, "roy", lg === "nba" ? "NBA 올해의 신인" : `${sh} 신인왕`, rec);
      if (p.attrs.def - L.avg >= 13 && min >= 24 && chance(0.45)) giveAward(c, "dpoy", `${sh} 올해의 수비수`, rec);
      if (pts >= SCORING_TITLE[lg] && chance(0.6)) giveAward(c, "scoring", `${sh} 득점왕`, rec);
      if (L.pro && min >= 18 && min < 26 && impact >= 3 && chance(0.4)) giveAward(c, "sixth", `${sh} 식스맨상`, rec);
    }
    if (champ) {
      giveAward(c, L.pro ? "ring" : "title", L.pro ? `${sh} 우승` : `${sh} 전국대회 우승`, rec);
      if (min >= 26 && impact >= 5 && chance(p.trait === "승부사" ? 0.85 : 0.6)) giveAward(c, "fmvp", `${sh} 파이널 MVP`, rec);
    }
    const prev = c.hist.length ? c.hist[c.hist.length - 1] : null;
    if (L.pro && prev && ov0 - prev.ovr0 >= 6 && chance(0.5)) giveAward(c, "mip", `${sh} 기량발전상`, rec);

    // 소식
    if (L.pro && c.proSeasons === 0) addNews(c, tag, "big", `프로 데뷔 시즌! ${c.team.name}에서 ${gp}경기를 뛰었어요.`);
    addNews(c, tag, champ ? "award" : "info", `${c.team.name} ${W}승 ${Lo}패 · ${result}`);
    if (rec.final)
      addNews(c, tag, rec.final.win ? "award" : "info", `${FINAL_NAME[lg]} 상대 ${rec.final.opp} · ${rec.final.series ? `시리즈 ${rec.final.series} · ` : ""}마지막 경기 ${rec.final.us}-${rec.final.them}`);
    if (back) addNews(c, tag, "info", "전역 후 시즌 중반부터 팀에 합류했어요.");
    if (injury) addNews(c, tag, "bad", `${injury}으로 ${Math.round(L.games * (back ? 0.6 : 1)) - gp}경기 결장했어요.`);
    if (prev && prev.team === rec.team && prev.role !== "-" && ROLE_RANK[role] > ROLE_RANK[prev.role])
      addNews(c, tag, "good", `팀 내 역할이 ${role}(으)로 올라섰어요.`);
    rec.awards.forEach((n) => addNews(c, tag, "award", `수상 · ${n}`));
    played = gp;
    if (L.pro) c.proSeasons++;
  }

  if (growNormally) grow(c, min, rating, tag);
  rec.ovr1 = ovr(p);
  // 시즌이 끝난 여름의 국가대표 대회. 성장까지 반영한 오버롤로 발탁해요.
  const call = nationalCallUp(c, rec.ovr1, played, yr);
  c.peakOvr = Math.max(c.peakOvr, rec.ovr1);
  c.trust = c.team ? clamp((rating - 6.3) * 1.4, -3, 4) : 0;
  if (c.contract) c.earnings += c.contract.salary;
  c.hist.push(rec);
  c.last = rec;
  c.age++;
  c.year++;
  runOffseason(c, yr, call);
  return rec;
}

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

/** 결승 상대와 점수를 정하고 마지막 경기 중계를 만들어요. NBA·KBL은 7전 4선승제예요. */
function playFinal(c: Career, rec: SeasonRecord, lg: LeagueKey, win: boolean): void {
  const team = c.team!;
  const opp = pickTeam(lg, new Set([team.name]));
  const best7 = lg === "nba" || lg === "kbl";
  const other = ri(0, 3);
  const series = best7 ? (win ? `4-${other}` : `${other}-4`) : undefined;
  const [us, them] = finalScore(FINAL_SCORE[lg], win);
  const vary = (v: number) => Math.max(0, Math.round(v * rnd(0.75, 1.35)));
  rec.final = { opp: opp.name, us, them, win, series };
  c.live = makeLiveGame({
    title: `${rec.year} ${FINAL_NAME[lg]}${best7 ? ` ${4 + other}차전` : ""}`,
    key: `league-${rec.year}`,
    us: team.name,
    them: opp.name,
    usColor: team.color,
    themColor: opp.color,
    usScore: us,
    themScore: them,
    periodMin: lg === "nba" ? 12 : 10,
    player: c.p.name,
    mine: { pts: vary(rec.pts), reb: vary(rec.reb), ast: vary(rec.ast) },
  });
}

function grow(c: Career, min: number, rating: number, tag: string): void {
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
  const decline: Record<AttrKey, number> = { ath: 1.6, sht: 0.7, iq: 0.25, hdl: 0.9, def: 1.1, reb: 1 };
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
    if (k === "iq" && age >= 24 && age <= 33) g += 0.5;
    const old = p.attrs[k];
    p.attrs[k] = clamp(old + g, 20, 99);
    delta[k] = Math.round(p.attrs[k]) - Math.round(old);
  }
  c.lastDelta = delta;
  if (age >= 19 && min < 15 && base > 0 && c.stage !== "hs") {
    const before = p.pot;
    p.pot = Math.max(Math.round(ovrOf(p.attrs, p.pos)) + 1, p.pot - ri(1, min < 8 ? 3 : 2));
    if (p.pot < before) addNews(c, tag, "bad", "출전 시간이 부족해 성장 한계가 조금 낮아졌어요.");
  }
  c.health = clamp(c.health + (c.focus === "rest" ? 15 : 8) - (age > 28 ? (age - 28) * 1.6 : 0), 15, 100);
}
