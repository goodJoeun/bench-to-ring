import { clampTrust } from "../player/condition";
import { LEAGUES, TEAMS, ncaaTies } from "../world/leagues";
import { DRAFT_NAMES, pathOf } from "../world/paths";
import { addNews, pickTeam } from "../career/log";
import { scoutTeam } from "../world/team-form";
import { chance, ri, rnd } from "../core/random";
import { currentExpectedMinutes, evalOvr, evalOvrOf, expectedMinutes, ovr, roleOf, salaryFor } from "../player/ratings";
import type { Action, Career, CurrentTeam, Decision, DecisionOption, DraftKey, LeagueKey, ProLeagueKey, Team } from "../core/types";
import { clamp, money, roundSalary } from "../core/util";

/*
 * 진로·계약 기준은 모두 그 리그 평균 오버롤에서 얼마나 떨어져 있는지로 정해요.
 * 리그 평균(leagues.ts)을 바꾸면 드래프트·계약 제안·진학 기준이 같이 움직여서,
 * 어느 리그든 들어갔을 때의 출전 시간은 비슷하고 들어가기 어려운 정도만 달라져요.
 */
const avg = (lg: LeagueKey) => LEAGUES[lg].avg;

/* ---------- 드래프트 평가 ---------- */

/**
 * NCAA 선수는 NBA 스카우트가 매 경기 지켜봐서 드래프트 평가가 이만큼 올라가요(1점 ≈ 3.6순위).
 * 같은 선수라면 U-리그보다 NCAA를 거쳐야 NBA에 지명되기 쉬워요.
 */
const NCAA_EXPOSURE = 4;
/**
 * 호주 NBL은 Next Stars 프로그램으로 NBA 스카우트가 어린 선수를 꾸준히 지켜봐서(조시 기디 6순위 등),
 * NEXT_STARS_AGE 이하 NBL 선수는 드래프트 평가가 이만큼 올라가요. NCAA보다는 조금 덜해요.
 * 유럽 프로 리그(LNB·ACB·ABA·유로리그)의 어린 선수도 해마다 NBA 드래프트에 지명돼서(웸반야마, 요키치, 돈치치) 같아요.
 */
const NBL_EXPOSURE = 3;
const NEXT_STARS_AGE = 21;
const SCOUTED: (LeagueKey | undefined)[] = ["nbl", "lnb", "acb", "aba", "euro"];

/** NBA 스카우트가 지켜보는 어린 해외 프로 선수인지 */
const nextStar = (c: Career): boolean => SCOUTED.includes(c.team?.lg) && c.age <= NEXT_STARS_AGE;

export function nbaDraftScore(c: Career, noise: number): number {
  const o = evalOvrOf(c.p.attrs, c.p.pos);
  const exposure = c.team?.lg === "ncaa" ? NCAA_EXPOSURE : nextStar(c) ? NBL_EXPOSURE : 0;
  return o + (c.p.pot - o) * 0.35 + (22 - c.age) * 1.2 + c.p.wsd * 0.2 + exposure + noise;
}

/** 자국 프로 리그(KBL·B.리그·PBA·CBA) 신인드래프트 */
export type HomeDraft = Exclude<DraftKey, "nba">;

export function homeDraftScore(c: Career, noise: number): number {
  const o = evalOvrOf(c.p.attrs, c.p.pos);
  return o + (c.p.pot - o) * 0.25 + (21 - c.age) * 0.6 + noise;
}

/** NBA 드래프트 로터리 순위. 이 순위부터 위로는 평가 점수 1점마다 순위가 NBA_LOTTERY_STEP배 빨리 올라가요. */
const NBA_LOTTERY = 14;
/**
 * 로터리 안에서 순위가 올라가는 배수. 순위를 점수에 그대로 비례시키면 최상위 유망주도 7순위 언저리에서 멈춰서
 * 1순위(1순위의 무게)가 나오지 않았어요. 로터리 안만 가파르게 해서, 예전 10순위쯤 되는 유망주가 1순위에 닿아요.
 * 15순위 아래(1라운드 중후반·2라운드·미지명)는 그대로예요.
 */
const NBA_LOTTERY_STEP = 3;

/**
 * NBA 드래프트: 2라운드 전체 1~60순위, 61 이상이면 미지명. 평가 점수가 NBA 평균 - 4이면 60순위이고, 1점마다 3.6순위씩 올라가요.
 * 로터리(14순위)부터는 NBA_LOTTERY_STEP배로 올라가요.
 */
export const nbaPick = (score: number): number => {
  const linear = 60 - (score - (avg("nba") - 4)) * 3.6;
  const pick = linear >= NBA_LOTTERY ? linear : NBA_LOTTERY - (NBA_LOTTERY - linear) * NBA_LOTTERY_STEP;
  return Math.max(1, Math.round(pick));
};
/** 자국 신인드래프트의 전체 지명 수: 두 라운드 동안 모든 구단이 한 번씩 뽑아요 (KBL 20, B.리그 52, PBA 24, CBA 40). */
export const homeDraftSize = (d: HomeDraft): number => TEAMS[d].length * 2;
/**
 * 자국 신인드래프트 순위. 마지막 순위보다 크면 미지명이에요. 평가 점수가 그 리그 평균 - 11이면 마지막 순위이고,
 * 거기서 15점쯤 높으면 1순위예요(KBL은 1점마다 1.3순위). 리그가 달라도 평균 대비 같은 실력이면 같은 라운드에 뽑혀요.
 */
export const homePick = (d: HomeDraft, score: number): number => {
  const size = homeDraftSize(d);
  return Math.max(1, Math.round(size - (score - (avg(d) - 11)) * size * 0.065));
};

/** 예상 지명 순위를 스카우트 문구로 바꿔요. tiers는 [이 순위까지, 문구] 목록이에요. */
const projection = (pick: number, tiers: [number, string][]): string => tiers.find(([n]) => pick <= n)?.[1] ?? "지명 불확실";

export const projectNba = (c: Career): string =>
  projection(nbaPick(nbaDraftScore(c, 0)), [
    [3, "1라운드 최상위"],
    [12, "1라운드 상위"],
    [30, "1라운드 중후반"],
    [60, "2라운드"],
  ]);

export const projectHome = (c: Career, d: HomeDraft): string =>
  projection(homePick(d, homeDraftScore(c, 0)), [
    [3, "1라운드 최상위"],
    [homeDraftSize(d) / 2, "1라운드"],
    [homeDraftSize(d), "2라운드"],
  ]);

/* ---------- 진로 결정 ---------- */

/**
 * 해외 경로 고교 졸업생의 NCAA 기준: 평균에서 이만큼 아래부터 장학생, 그 아래 NCAA_WALK_ON까지는 워크온이에요.
 * NCAA 평균을 65로 내린 뒤 예전 기준(장학생 - 8, 워크온 - 10)은 고교 졸업생 하위 1%(평가 오버롤 58)보다도 낮아서
 * 모두 장학생이 되고 워크온이 한 번도 나오지 않았어요(워크온의 기적을 딸 수 없었어요).
 * 받아 주는 기준(- 10)은 그대로 두고 장학생 기준만 - 5로 올려서, NCAA 제안을 받는 선수는 그대로이고
 * 해외 경로 졸업생 하위 5~10%쯤이 장학생 대신 워크온으로 들어가요.
 */
const NCAA_SCHOLARSHIP = 5;
const NCAA_WALK_ON = 10;
/** NCAA 제안이 그 나라 선수와 인연이 깊은 학교(leagues.ts의 NCAA_TIES)에서 올 확률 */
const NCAA_TIE_CHANCE = 0.5;
/** 자국 프로 리그의 계약 제안을 받는 오버롤: 리그 평균에서 이만큼 아래까지 */
const HOME_BELOW = 12;

/**
 * 신인드래프트가 없는 리그(호주 NBL, 유럽 LNB·ACB·ABA)는 고교(구단 유소년)를 마친 유망주와 구단이 바로 계약해요.
 * 리그 평균 - YOUTH_DEAL부터 육성 선수(유럽은 유스·에스푸아 계약)로 받아 주고, - NEXT_STARS부터는 1군 유망주 자리예요
 * (호주는 NBA 드래프트를 노리는 Next Stars 계약, 유럽은 프로 계약).
 */
const YOUTH_DEAL = 14;
const NEXT_STARS = 9;

/** 고졸 유망주 계약의 이름: [육성 계약, 1군 유망주 계약] */
const YOUTH_DEAL_NAMES: Partial<Record<ProLeagueKey, [string, string]>> = {
  nbl: ["육성 선수 계약", "Next Stars 계약"],
  lnb: ["에스푸아 계약", "프로 계약"],
  acb: ["유스 계약", "프로 계약"],
  aba: ["유스 계약", "프로 계약"],
};

/** 고졸 유망주의 프로 계약: 2년, 정해진 연봉이라 협상 없이 서명해요. */
function youthDeal(c: Career, lg: ProLeagueKey, o: number): DecisionOption {
  const t = pickTeam(lg);
  const stars = o >= avg(lg) - NEXT_STARS;
  const salary = stars ? 0.9 : 0.4;
  const [low, top] = YOUTH_DEAL_NAMES[lg] ?? ["육성 선수 계약", "프로 계약"];
  return {
    label: `${t.name} ${stars ? top : low}`,
    sub: `${LEAGUES[lg].name} · 2년 · 연봉 ${money(salary)} · 예상 역할 ${roleOf(expectedMinutes(c, lg))} · ${
      stars ? "NBA 스카우트가 지켜보는 유망주 자리예요" : lg === "nbl" ? "벤치에서 프로의 벽을 배워요" : "U21 팀에서 뛰며 1군 훈련에 함께해요"
    }`,
    tag: stars && lg === "nbl" ? "Next Stars" : LEAGUES[lg].short,
    act: { k: "sign", lg, team: t, years: 2, salary, deal: true },
  };
}

export function highSchoolGraduation(c: Career): Decision {
  // 진학·드래프트 기준은 히든 스탯까지 반영한 평가 오버롤로 봐요.
  const o = evalOvr(c.p);
  const path = pathOf(c.p.nat);
  const opts: DecisionOption[] = [];
  // NCAA 제안의 절반은 그 나라 선수가 많이 간 학교에서 와요.
  const ties = ncaaTies(c.p.nat);
  const uc = ties.length && chance(NCAA_TIE_CHANCE) ? pickTeam("ncaa", undefined, ties) : pickTeam("ncaa");
  const kc = path.college ? pickTeam(path.college) : null;
  const abroad = (walk: boolean): DecisionOption => ({
    label: `${uc.name} ${walk ? "워크온 입단" : "장학생 입학"}`,
    sub: `NCAA 디비전 I · 예상 역할 ${roleOf(expectedMinutes(c, "ncaa", walk ? -3 : 0))} · 벤치여도 팀 훈련으로 성장 · NBA 스카우트 주목${
      walk ? " · 장학금 없이 들어가 처음엔 기회가 적어요" : ""
    }`,
    tag: "NCAA",
    act: { k: "school", lg: "ncaa", team: uc, walk },
  });
  // NCAA: 해외 경로는 평균 - NCAA_SCHOLARSHIP부터 장학생, 그 아래 평균 - NCAA_WALK_ON까지는 워크온이고, 더 낮으면 받아 주는 학교가 없어요.
  // 미국 대학이 주된 진학로인 나라(미국·캐나다·호주·유럽)는 같은 기준으로 열리고, 워크온은 언제나 받아 줘요.
  // 국내 경로는 NCAA 평균 - 1은 돼야 스카우트가 찾아와요.
  if (c.p.path === "abroad" || path.ncaa) {
    if (path.ncaa || o >= avg("ncaa") - NCAA_WALK_ON) opts.push(abroad(o < avg("ncaa") - NCAA_SCHOLARSHIP));
  } else if (o >= avg("ncaa") - 1) opts.push({ ...abroad(false), label: `${uc.name} 스카우트 제안` });
  if (kc && path.college)
    opts.push({
      label: `${kc.name} 진학`,
      sub: `${LEAGUES[path.college].name} · 예상 역할 ${roleOf(expectedMinutes(c, path.college))}`,
      tag: LEAGUES[path.college].short,
      act: { k: "school", lg: path.college, team: kc },
    });
  if (path.draft) {
    if (o >= avg(path.pro) - 9)
      opts.push({
        label: `${DRAFT_NAMES[path.draft]} 고졸 참가`,
        sub: `대학을 건너뛰고 바로 프로에 도전해요 · 스카우트 예상 ${projectHome(c, path.draft)}`,
        tag: "드래프트",
        act: { k: "draft", d: path.draft },
      });
  } else if (YOUTH_DEAL_NAMES[path.pro] && o >= avg(path.pro) - YOUTH_DEAL) opts.push(youthDeal(c, path.pro, o));
  return { scene: "path", title: "고교 졸업, 진로 선택", body: `고교 3년 동안 오버롤 ${ovr(c.p)}까지 성장했어요. 다음 무대를 고르세요.`, opts };
}

export function collegeSeasonEnd(c: Career): Decision {
  const o = evalOvr(c.p);
  const lg = c.team?.lg;
  const years = c.collegeYears;
  const path = pathOf(c.p.nat);
  // 진로 표가 생기기 전에 U-리그에 들어간, 드래프트 없는 나라 선수는 KBL 드래프트로 프로에 가요.
  const draft = path.draft ?? (lg === "kuniv" ? "kbl" : null);
  const opts: DecisionOption[] = [];
  if (years < 4)
    opts.push({
      label: `${c.team?.name ?? "대학"}에서 ${years + 1}학년 시즌 뛰기`,
      sub: "대학에서 한 시즌 더 성장해요",
      tag: "잔류",
      act: { k: "stay" },
    });
  if (lg === "ncaa" || o >= avg("nba") - 7)
    opts.push({
      label: "NBA 드래프트 신청",
      sub: `세계 최고 리그 · 스카우트 예상 ${projectNba(c)}`,
      tag: "NBA",
      act: { k: "draft", d: "nba" },
    });
  if (draft)
    opts.push({
      label: `${DRAFT_NAMES[draft]} 신청`,
      sub: `${lg === "ncaa" ? "국내로 돌아와 " : ""}국내 프로리그 도전 · 스카우트 예상 ${projectHome(c, draft)}`,
      tag: LEAGUES[draft].short,
      act: { k: "draft", d: draft },
    });
  // 드래프트가 없는 나라는 자국 리그 구단과 바로 계약해요. 미국 선수는 NBA 드래프트를 거친 뒤에 G리그·해외 제안을 받아요.
  else if (path.pro !== "gleague" && o >= avg(path.pro) - HOME_BELOW)
    opts.push(signOption(c, path.pro, pickTeam(path.pro), 2, roundSalary(salaryFor(path.pro, o)), undefined, LEAGUES[path.pro].short));
  // 드래프트가 없는 나라의 자국 대학(U 스포츠) 졸업생이 자국 리그 기준에 못 미치면 팀 없이 시장에 나가요.
  if (!opts.length) opts.push(skipOption("졸업했지만 아직 부르는 팀이 없어요. 다음 시장을 노려요"));
  return {
    scene: years >= 4 ? "draft" : "path",
    title: years >= 4 ? "대학 졸업, 드래프트" : "대학 시즌 종료",
    body: years >= 4 ? "졸업 학년이에요. 드래프트에 나설 차례예요." : `대학 ${years}학년 시즌을 마쳤어요. 지금 오버롤은 ${ovr(c.p)}예요.`,
    opts,
  };
}

/* ---------- 계약 제안 ---------- */

/** 계약 선택지. 설명에는 리그, 기간, 연봉, 그 팀에서의 예상 역할이 들어가요. */
function signOption(c: Career, lg: ProLeagueKey, picked: Team, years: number, salary: number, label = picked.name, tag = LEAGUES[lg].short): DecisionOption {
  const t = scoutTeam(c, lg, picked);
  return {
    label,
    sub: `${LEAGUES[lg].name} · ${years}년 · 연봉 ${money(salary)} · 예상 역할 ${roleOf(expectedMinutes(c, lg))}`,
    tag,
    act: { k: "sign", lg, team: t, years, salary },
  };
}

/** 협상을 거친 계약 제안. 연봉이 ±10% 흔들려요. */
function offerOption(c: Career, lg: ProLeagueKey, t: Team, years: number, sal: number, note?: string): DecisionOption {
  // 대형 에이전시가 있으면 협상에서 10% 더 받아요. 최저 연봉 계약은 그대로예요. note는 선택지의 꼬리표가 돼요(재계약, 아시아쿼터…).
  const agent = c.perks.agency && note !== "최저 연봉" ? 1.1 : 1;
  return signOption(c, lg, t, years, roundSalary(sal * rnd(0.9, 1.1) * agent), t.name, note);
}

/** 소속팀 없이 한 시즌을 보내는 선택지 */
const skipOption = (sub: string): DecisionOption => ({ label: "무소속으로 1년 개인 훈련", sub, act: { k: "skip" } });

/** 재계약 제안을 받는 오버롤: 리그 평균에서 이만큼 아래까지 */
const RESIGN_BELOW: Partial<Record<LeagueKey, number>> = { cebl: 12, nba: 3, euro: 8, acb: 10, lnb: 10, aba: 10, nbl: 10, bleague: 12, cba: 12, kbl: 12, pba: 12, gleague: 9 };
/**
 * 아시아쿼터 제안. 외국선수와 따로 두는 자리 하나라 주전급이어야 해서 리그 평균 - QUOTA_BELOW부터 오고,
 * 자리가 구단마다 하나뿐이라 해마다 QUOTA_CHANCE 확률로만 와요. 기간은 1~2년으로 짧아요.
 */
const QUOTA_BELOW = 3;
const QUOTA_CHANCE = 0.5;
const QUOTA_TAG = "아시아쿼터";
/**
 * 외국선수 제안(북미 선수). 외국선수 자리는 구단마다 두세 명뿐이고 팀의 주축을 맡겨서 리그 평균 - IMPORT_BELOW부터 와요.
 * 세계 어느 리그나 북미 선수를 찾아서, 실력이 되는 리그 가운데 IMPORT_OFFERS곳이 해마다 제안해요. 기간은 1~2년으로 짧아요.
 * 캐나다 CEBL은 구단마다 외국선수가 다섯 명이라 미국 선수도 자국 선수처럼(평균 - HOME_BELOW) 받아 줘요.
 */
const IMPORT_BELOW = 3;
const IMPORT_OFFERS = 2;
const IMPORT_TAG = "외국선수";
const importBelow = (lg: ProLeagueKey): number => (lg === "cebl" ? HOME_BELOW : IMPORT_BELOW);
/** 미국 선수는 G리그가 자국 리그라서 더 낮은 실력(평균 - HOME_BELOW)과 더 많은 나이까지 받아 줘요. */
const GLEAGUE_AGE = 27;
const GLEAGUE_HOME_AGE = 30;

/** 계약 제안. current는 재계약을 제안할 수 있는 지금 팀이고, avoid 팀은 제안 목록에서 빼요(이적 요청). */
export function generateOffers(c: Career, current: CurrentTeam | null, rating: number, avoid?: string): DecisionOption[] {
  // 구단은 히든 스탯까지 반영한 평가 오버롤로 제안 여부와 연봉을 정해요.
  const o = evalOvr(c.p);
  const age = c.age;
  const out: DecisionOption[] = [];
  const used = new Set<string>(avoid ? [avoid] : []);
  const path = pathOf(c.p.nat);
  const eff = o - (age >= 33 ? 4 : 0);
  const years = () => (age < 26 ? ri(2, 4) : age < 31 ? ri(2, 3) : ri(1, 2));
  const add = (lg: ProLeagueKey, y: number, sal: number, note?: string) => {
    const t = pickTeam(lg, used);
    used.add(t.name);
    out.push(offerOption(c, lg, t, y, sal, note));
  };
  const resign = RESIGN_BELOW[current?.lg ?? "hs"];
  if (current && rating >= 5.6 && LEAGUES[current.lg].pro && resign !== undefined && eff >= avg(current.lg) - resign) {
    const lg = current.lg as ProLeagueKey;
    used.add(current.name);
    out.push(offerOption(c, lg, { name: current.name, color: current.color, q: current.q }, years(), salaryFor(lg, o) * 1.05, "재계약"));
  }
  // NBA는 평균 이상이면 정식 제안(평균 +4면 두 팀, +9면 세 팀), 평균 - 3까지는 가끔 최저 연봉 제안이 와요.
  const nba = avg("nba");
  if (eff >= nba) {
    const n = eff >= nba + 9 ? 3 : eff >= nba + 4 ? 2 : 1;
    for (let i = 0; i < n; i++) add("nba", years(), salaryFor("nba", o));
  } else if (eff >= nba - 3 && rnd(0, 1) < 0.45) add("nba", 1, 17, "최저 연봉");
  if (eff >= avg("euro") - 7 && out.length < 4) add("euro", years(), salaryFor("euro", o));
  // 미국 선수의 자국 리그는 G리그라서 아래 G리그 규칙으로 제안해요.
  const usa = path.pro === "gleague";
  if (!usa && eff >= avg(path.pro) - HOME_BELOW && out.length < 4) add(path.pro, years(), salaryFor(path.pro, o));
  for (const lg of path.quota)
    if (eff >= avg(lg) - QUOTA_BELOW && out.length < 4 && chance(QUOTA_CHANCE)) add(lg, ri(1, 2), salaryFor(lg, o), QUOTA_TAG);
  const imports = path.imports.filter((lg) => eff >= avg(lg) - importBelow(lg));
  for (let i = 0; i < IMPORT_OFFERS && imports.length && out.length < 4; i++) {
    const [lg] = imports.splice(ri(0, imports.length - 1), 1);
    add(lg, ri(1, 2), salaryFor(lg, o), IMPORT_TAG);
  }
  // G리그는 NBA를 노리는 젊은 선수의 길이라, NBA 정식 제안을 받을 실력이면 오지 않아요.
  if (usa) {
    if (age <= GLEAGUE_HOME_AGE && eff >= avg("gleague") - HOME_BELOW && eff < nba - 1 && out.length < 4) add("gleague", 1, 0.6);
  } else if (age <= GLEAGUE_AGE && eff >= avg("gleague") - 9 && eff < nba - 1 && out.length < 4 && rnd(0, 1) < 0.7) add("gleague", 1, 0.6);
  return out.slice(0, 4);
}

const RETIRE_OPTION: DecisionOption = {
  label: "은퇴 선언",
  sub: "여기서 커리어를 마무리해요",
  tag: "은퇴",
  act: { k: "retire" },
};

export function freeAgency(c: Career, isFree: boolean): Decision {
  const offers = generateOffers(c, isFree ? null : c.team, c.last ? c.last.rating : 6);
  const opts = [...offers];
  // 계약이 끝난 어린 프로 선수는 NBA 드래프트에 나설 수도 있어요.
  const entry = isFree ? null : proDraftOption(c);
  if (entry) opts.push(entry);
  if (c.age >= 31) opts.push(RETIRE_OPTION);
  if (!offers.length && c.age < 34)
    opts.push(skipOption("경기는 못 뛰지만 다음 시장을 노려요"));
  if (!opts.length) opts.push(RETIRE_OPTION);
  return {
    scene: "deal",
    title: isFree ? "다시 시장에 나왔어요" : "FA 시장이 열렸어요",
    body: offers.length ? "계약이 끝났어요. 다음 팀을 고르세요." : "아직 들어온 제안이 없어요.",
    opts,
  };
}

export function undrafted(c: Career): Decision {
  const opts: DecisionOption[] = generateOffers(c, null, 6).map((o) => ({ ...o, tag: "육성 계약" }));
  opts.push(skipOption("다음 시즌 시장을 노려요"));
  return { scene: "undrafted", title: "지명받지 못했어요", body: "드래프트에서 이름이 불리지 않았지만 다른 길이 남아 있어요.", opts };
}

export function nbaOffer(c: Career): Decision | null {
  if (!c.team || !c.contract) return null;
  const lg = c.team.lg;
  const o = evalOvr(c.p);
  const fromDev = lg === "gleague";
  // G리그에서는 NBA 평균 - 1이면 콜업, 다른 프로 리그(KBL·유로리그·아시아 리그)에서는 평균 + 2는 돼야 바이아웃을 내고 데려가요.
  if (!LEAGUES[lg].pro || lg === "nba" || o < avg("nba") + (fromDev ? -1 : 2)) return null;
  const t = pickTeam("nba");
  const sal = fromDev ? 17 : roundSalary(salaryFor("nba", o));
  const years = fromDev ? 2 : 3;
  return {
    scene: "deal",
    title: fromDev ? "NBA 콜업" : "NBA 영입 제안",
    body: fromDev
      ? `${t.name} 구단에서 G리그에서 NBA로 불러올리고 싶어해요.`
      : `${t.name} 구단에서 바이아웃 금액을 내고 데려가고 싶어해요.`,
    opts: [
      signOption(c, "nba", t, years, sal, `${t.name} 이적`),
      { label: `${c.team.name} 잔류`, sub: `남은 계약 ${c.contract.years}년을 채워요`, act: { k: "none" } },
    ],
  };
}

/* ---------- 프로 선수의 NBA 드래프트 ---------- */

/** NBA 밖 프로 리그 선수가 NBA 드래프트에 나설 수 있는 나이. 해외 선수는 22세가 되는 해에 자동으로 대상이 돼요. */
const PRO_DRAFT_AGE = 22;
/** NBA 드래프트에 한 번 나선 프로 선수의 표시(c.milestones). 다시 신청할 수 없어요. */
export const PRO_DRAFT_MARK = "nbadraft";
/** 스카우트 예상 순위가 이 안이어야 신청을 물어요 (전체 60순위 + 예상 범위의 반폭) */
const PRO_DRAFT_REACH = 68;

/**
 * NBA 밖 프로 리그에서 뛰는 어린 선수의 NBA 드래프트 신청 (중국 CBA의 양한썬, 호주 NBL의 조시 기디처럼).
 * 대학 선수와 같은 기준이에요: 평가 오버롤이 NBA 평균 - 7 이상이거나, 스카우트가 지켜보는 어린 NBL 선수여야 하고,
 * 예상 순위가 지명권 근처여야 해요. 한 번만 신청할 수 있어요.
 */
function proDraftOption(c: Career): DecisionOption | null {
  const lg = c.team?.lg;
  if (!lg || lg === "nba" || !LEAGUES[lg].pro || c.age > PRO_DRAFT_AGE) return null;
  if (c.draft?.lg === "NBA" || c.milestones.includes(PRO_DRAFT_MARK)) return null;
  if (!nextStar(c) && evalOvr(c.p) < avg("nba") - 7) return null;
  if (nbaPick(nbaDraftScore(c, 0)) > PRO_DRAFT_REACH) return null;
  return {
    label: "NBA 드래프트 신청",
    sub: `스카우트 예상 ${projectNba(c)} · 지명되면 NBA 팀으로 옮겨요 · 한 번만 신청할 수 있어요`,
    tag: "NBA",
    act: { k: "draft", d: "nba" },
  };
}

/** 계약이 남은 프로 선수에게 오프시즌에 묻는 NBA 드래프트 신청. 대상이 아니면 null이에요. */
export function proDraftEntry(c: Career): Decision | null {
  const entry = proDraftOption(c);
  if (!entry || !c.team) return null;
  return {
    scene: "draft",
    title: "NBA 드래프트 신청",
    body: `NBA 스카우트들이 ${c.team.name}에서 뛰는 당신을 지켜보고 있어요. 올해 드래프트에 이름을 올릴까요?`,
    opts: [entry, { label: "올해는 신청하지 않는다", sub: `${c.team.name}에서 한 시즌 더 성장해요`, act: { k: "none" } }],
  };
}

/* ---------- 연봉 협상 ---------- */

type SignAction = Extract<Action, { k: "sign" }>;

/** 협상할 수 있는 계약인지. G리그 계약과 NBA 최저 연봉은 금액이 정해져 있어요. */
export const negotiable = (a: SignAction): boolean => !a.deal && a.lg !== "gleague" && !(a.lg === "nba" && a.salary <= 17);

/**
 * 구단이 요구를 들어줄 기본 확률. 그 리그 수준보다 잘할수록, 지난 시즌 평점이 높을수록,
 * 대형 에이전시가 있으면 협상력이 커요.
 */
export function leverage(c: Career, lg: ProLeagueKey): number {
  const rating = c.last?.rating || 6;
  const star = c.p.trait === "스타성" ? 0.12 : 0;
  return clamp(0.45 + (evalOvr(c.p) - LEAGUES[lg].avg) / 25 + (rating - 6.5) * 0.1 + (c.perks.agency ? 0.1 : 0) + star, 0.15, 0.85);
}

/**
 * 제안을 고르면 바로 서명하지 않고 협상 테이블에 앉아요.
 * others는 원래 결정에 있던 다른 선택지로, 크게 요구했다가 결렬되면 여기로 돌아가요.
 */
export function negotiation(c: Career, a: SignAction, others: DecisionOption[]): Decision {
  const lev = leverage(c, a.lg);
  const base = { lg: a.lg, team: a.team, years: a.years, salary: a.salary };
  const up = (x: number) => money(roundSalary(a.salary * x));
  const mood = lev >= 0.6 ? "더 받아낼 수 있다고 자신해요" : lev >= 0.35 ? "조금은 더 받아낼 여지가 있다고 해요" : "욕심을 부리면 위험하다고 말려요";
  const opts: DecisionOption[] = [
    { label: "제시안에 서명", sub: `${a.years}년 · 연봉 ${money(a.salary)}`, tag: "서명", act: { k: "sign", ...base, deal: true } },
    {
      label: "연봉 10% 인상 요구",
      sub: `받아들이면 연봉 ${up(1.1)} · 거절하면 원래 조건으로 서명해요`,
      tag: "협상",
      act: { k: "nego", ...base, ask: 1.1, p: lev },
    },
    {
      label: "연봉 25% 인상 요구",
      sub: `받아들이면 연봉 ${up(1.25)} · 거절하면 구단이 협상을 끝낼 수 있어요`,
      tag: "도전",
      act: { k: "nego", ...base, ask: 1.25, p: lev * 0.6, walk: others },
    },
  ];
  if (a.years < 5)
    opts.push({
      label: "계약 기간 1년 연장 요구",
      sub: `받아들이면 ${a.years + 1}년 · 같은 연봉 · 거절하면 원래 조건으로 서명해요`,
      tag: "협상",
      act: { k: "nego", ...base, years: a.years + 1, ask: 1, p: clamp(lev + 0.1 - (c.age >= 30 ? 0.25 : 0), 0.1, 0.9) },
    });
  return {
    scene: "deal",
    title: `${a.team.name} 연봉 협상`,
    body: `${LEAGUES[a.lg].name} · ${a.years}년 · 연봉 ${money(a.salary)}를 제시했어요. 에이전트는 ${mood}.`,
    opts,
  };
}

/* ---------- 이적 요청 ---------- */

/** 계약 기간 중 이적을 요청할 수 있는지: 프로 선수가 시즌 사이에, 오프시즌마다 한 번 */
export const canRequestTransfer = (c: Career): boolean =>
  c.stage === "pro" && !!c.team && !!c.contract && c.contract.years > 0 && !c.run && !c.queue.length && c.moveAsked !== c.year;

/** 계약을 깨고 나갈 때 내는 위약금: 남은 연봉의 절반 */
export const buyoutCost = (c: Career): number => (c.contract ? roundSalary(c.contract.salary * c.contract.years * 0.5) : 0);

/**
 * 구단에 이적을 요청해요. 출전 시간이 적을수록 구단이 쉽게 보내 주고, 팀의 핵심일수록 붙잡아요.
 * 허락하면 다른 구단의 제안을, 거절하면 남거나 위약금을 내고 나가는 선택지를 대기열에 넣어요.
 */
export function requestTransfer(c: Career): boolean {
  if (!canRequestTransfer(c)) return false;
  c.moveAsked = c.year;
  const team = c.team!;
  const lg = team.lg;
  const tag = `${c.year - 1} 오프시즌`;
  const star = Math.max(0, evalOvr(c.p) - LEAGUES[lg].avg - 6);
  const p = clamp(
    0.45 + (currentExpectedMinutes(c) < 20 ? 0.2 : 0) - star * 0.04 + (c.perks.agency ? 0.1 : 0) - (c.trust >= 2 ? 0.1 : 0),
    0.1,
    0.85,
  );
  const stay: DecisionOption = { label: `${team.name}에 남는다`, sub: `남은 계약 ${c.contract!.years}년을 채워요`, act: { k: "none" } };
  if (chance(p)) {
    const offers = generateOffers(c, null, c.last?.rating || 6, team.name).filter((o) => o.act.k === "sign");
    if (!offers.length) {
      addNews(c, tag, "info", "구단은 이적을 허락했지만 관심을 보이는 팀이 없었어요.");
      return true;
    }
    addNews(c, tag, "info", `${team.name} 구단이 이적 요청을 받아들였어요.`);
    c.queue.unshift({
      scene: "deal",
      title: "이적 시장",
      body: `${team.name} 구단이 트레이드 상대를 찾았어요. 새 팀을 고르면 연봉을 협상해요.`,
      opts: [...offers.map((o) => ({ ...o, tag: o.tag ?? "이적" })), stay],
    });
    return true;
  }
  c.trust = clampTrust(c.trust - 1);
  addNews(c, tag, "bad", `${team.name} 구단이 이적 요청을 거절했어요. 코치와 사이가 조금 서먹해졌어요.`);
  const cost = buyoutCost(c);
  const opts: DecisionOption[] = [{ ...stay, label: "남아서 실력으로 증명한다" }];
  if (c.earnings + 1e-9 >= cost)
    opts.push({
      label: `위약금 ${money(cost)}을 내고 계약 해지`,
      sub: "FA가 되어 모든 구단의 제안을 받아요",
      tag: "해지",
      act: { k: "buyout", cost },
    });
  c.queue.unshift({
    scene: "dealOff",
    title: "이적 요청 거절",
    body: `구단은 아직 당신이 필요하대요.${opts.length > 1 ? "" : ` 계약을 해지하려면 위약금 ${money(cost)}이 필요해요.`}`,
    opts,
  });
  return true;
}

export function retirementPrompt(c: Career): Decision {
  return {
    scene: "retire",
    title: "은퇴를 고민할 나이",
    body: `${c.age}세. 계약은 ${c.contract?.years ?? 0}년 남았어요.`,
    opts: [{ label: "계속 뛴다", sub: "아직 코트에서 보여줄 게 있어요", act: { k: "none" } }, RETIRE_OPTION],
  };
}

export function forcedRetirement(): Decision {
  return {
    scene: "retire",
    title: "은퇴의 시간",
    body: "마흔. 이제 코트를 떠날 때예요.",
    opts: [{ label: "은퇴식 하기", sub: "커리어를 마무리하고 기록을 남겨요", tag: "은퇴", act: { k: "retire" } }],
  };
}

/** 대기열 맨 앞의 지연 결정을 지금 능력치로 만들어요. 화면을 그리기 전에 호출해요. */
export function resolveQueue(c: Career): void {
  const q = c.queue;
  while (q.length && "lazy" in q[0]) {
    const k = q[0].lazy;
    q[0] =
      k === "hsgrad" ? highSchoolGraduation(c) : k === "college" ? collegeSeasonEnd(c) : freeAgency(c, k === "faFree");
  }
}

export function currentDecision(c: Career): Decision | null {
  const d = c.queue[0];
  return d && !("lazy" in d) ? d : null;
}
