import { clampTrust } from "./condition";
import { LEAGUES } from "./leagues";
import { addNews, pickTeam } from "./log";
import { chance, ri, rnd } from "./random";
import { currentExpectedMinutes, expectedMinutes, ovr, ovrOf, roleOf, salaryFor } from "./ratings";
import type { Action, Career, CurrentTeam, Decision, DecisionOption, LeagueKey, ProLeagueKey, Team } from "./types";
import { clamp, money, roundSalary } from "./util";

/*
 * 진로·계약 기준은 모두 그 리그 평균 오버롤에서 얼마나 떨어져 있는지로 정해요.
 * 리그 평균(leagues.ts)을 바꾸면 드래프트·계약 제안·진학 기준이 같이 움직여서,
 * 어느 리그든 들어갔을 때의 출전 시간은 비슷하고 들어가기 어려운 정도만 달라져요.
 */
const avg = (lg: LeagueKey) => LEAGUES[lg].avg;

/* ---------- 드래프트 평가 ---------- */

export function nbaDraftScore(c: Career, noise: number): number {
  const o = ovrOf(c.p.attrs, c.p.pos);
  return o + (c.p.pot - o) * 0.35 + (22 - c.age) * 1.2 + c.p.wsd * 0.2 + noise;
}

export function kblDraftScore(c: Career, noise: number): number {
  const o = ovrOf(c.p.attrs, c.p.pos);
  return o + (c.p.pot - o) * 0.25 + (21 - c.age) * 0.6 + noise;
}

/** NBA 드래프트: 2라운드 전체 1~60순위, 61 이상이면 미지명. 평가 점수가 NBA 평균 - 4이면 60순위예요. */
export const nbaPick = (score: number): number => Math.max(1, Math.round(60 - (score - (avg("nba") - 4)) * 3.6));
/** KBL 신인드래프트: 2라운드 전체 1~20순위, 21 이상이면 미지명. 평가 점수가 KBL 평균 - 11이면 20순위예요. */
export const kblPick = (score: number): number => Math.max(1, Math.round(20 - (score - (avg("kbl") - 11)) * 1.3));

/** 예상 지명 순위를 스카우트 문구로 바꿔요. tiers는 [이 순위까지, 문구] 목록이에요. */
const projection = (pick: number, tiers: [number, string][]): string => tiers.find(([n]) => pick <= n)?.[1] ?? "지명 불확실";

export const projectNba = (c: Career): string =>
  projection(nbaPick(nbaDraftScore(c, 0)), [
    [3, "1라운드 최상위"],
    [12, "1라운드 상위"],
    [30, "1라운드 중후반"],
    [60, "2라운드"],
  ]);

export const projectKbl = (c: Career): string =>
  projection(kblPick(kblDraftScore(c, 0)), [
    [3, "1라운드 최상위"],
    [10, "1라운드"],
    [20, "2라운드"],
  ]);

/* ---------- 진로 결정 ---------- */

export function highSchoolGraduation(c: Career): Decision {
  const o = ovr(c.p);
  const opts: DecisionOption[] = [];
  const uc = pickTeam("ncaa");
  const kc = pickTeam("kuniv");
  const abroad = (walk: boolean): DecisionOption => ({
    label: `${uc.name} ${walk ? "워크온 입단" : "장학생 입학"}`,
    sub: `NCAA 디비전 I · 예상 역할 ${roleOf(expectedMinutes(c, "ncaa", walk ? -3 : 0))}${
      walk ? " · 장학금 없이 들어가 처음엔 기회가 적어요" : ""
    }`,
    tag: "NCAA",
    act: { k: "school", lg: "ncaa", team: uc, walk },
  });
  // NCAA: 해외 경로는 NCAA 평균 - 5부터 장학생, 그 아래 - 7까지는 워크온이고, 더 낮으면 받아 주는 학교가 없어요.
  // 국내 경로는 NCAA 평균 - 1은 돼야 스카우트가 찾아와요.
  if (c.p.path === "abroad") {
    if (o >= avg("ncaa") - 7) opts.push(abroad(o < avg("ncaa") - 5));
  } else if (o >= avg("ncaa") - 1) opts.push({ ...abroad(false), label: `${uc.name} 스카우트 제안` });
  opts.push({
    label: `${kc.name} 진학`,
    sub: `대학농구 U-리그 · 예상 역할 ${roleOf(expectedMinutes(c, "kuniv"))}`,
    tag: "U-리그",
    act: { k: "school", lg: "kuniv", team: kc },
  });
  if (o >= avg("kbl") - 9)
    opts.push({
      label: "KBL 신인드래프트 고졸 참가",
      sub: `대학을 건너뛰고 바로 프로에 도전해요 · 스카우트 예상 ${projectKbl(c)}`,
      tag: "드래프트",
      act: { k: "draft", d: "kbl" },
    });
  return { title: "고교 졸업, 진로 선택", body: `고교 3년 동안 오버롤 ${o}까지 성장했어요. 다음 무대를 고르세요.`, opts };
}

export function collegeSeasonEnd(c: Career): Decision {
  const o = ovr(c.p);
  const lg = c.team?.lg;
  const years = c.collegeYears;
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
  opts.push({
    label: "KBL 신인드래프트 신청",
    sub: `${lg === "ncaa" ? "국내로 돌아와 " : ""}국내 프로리그 도전 · 스카우트 예상 ${projectKbl(c)}`,
    tag: "KBL",
    act: { k: "draft", d: "kbl" },
  });
  return {
    title: years >= 4 ? "대학 졸업, 드래프트" : "대학 시즌 종료",
    body: years >= 4 ? "졸업 학년이에요. 드래프트에 나설 차례예요." : `대학 ${years}학년 시즌을 마쳤어요. 지금 오버롤은 ${o}예요.`,
    opts,
  };
}

/* ---------- 계약 제안 ---------- */

/** 계약 선택지. 설명에는 리그, 기간, 연봉, 그 팀에서의 예상 역할이 들어가요. */
function signOption(c: Career, lg: ProLeagueKey, t: Team, years: number, salary: number, label = t.name, tag = LEAGUES[lg].short): DecisionOption {
  return {
    label,
    sub: `${LEAGUES[lg].name} · ${years}년 · 연봉 ${money(salary)} · 예상 역할 ${roleOf(expectedMinutes(c, lg))}`,
    tag,
    act: { k: "sign", lg, team: t, years, salary },
  };
}

/** 협상을 거친 계약 제안. 연봉이 ±10% 흔들려요. */
function offerOption(c: Career, lg: ProLeagueKey, t: Team, years: number, sal: number, note?: string): DecisionOption {
  // 대형 에이전시가 있으면 협상에서 10% 더 받아요. 최저 연봉 계약은 그대로예요.
  const agent = c.perks.agency && note !== "최저 연봉" ? 1.1 : 1;
  return signOption(c, lg, t, years, roundSalary(sal * rnd(0.9, 1.1) * agent), t.name, note);
}

/** 소속팀 없이 한 시즌을 보내는 선택지 */
const skipOption = (sub: string): DecisionOption => ({ label: "무소속으로 1년 개인 훈련", sub, act: { k: "skip" } });

/** 재계약 제안을 받는 오버롤: 리그 평균에서 이만큼 아래까지 */
const RESIGN_BELOW: Partial<Record<LeagueKey, number>> = { nba: 3, euro: 8, kbl: 12, gleague: 9 };

export function generateOffers(c: Career, current: CurrentTeam | null, rating: number): DecisionOption[] {
  const o = ovr(c.p);
  const age = c.age;
  const out: DecisionOption[] = [];
  const used = new Set<string>();
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
  if (eff >= avg("kbl") - 12 && out.length < 4) add("kbl", years(), salaryFor("kbl", o));
  // G리그는 NBA를 노리는 젊은 선수의 길이라, NBA 정식 제안을 받을 실력이면 오지 않아요.
  if (age <= 27 && eff >= avg("gleague") - 9 && eff < nba - 1 && out.length < 4 && rnd(0, 1) < 0.7) add("gleague", 1, 0.6);
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
  if (c.age >= 31) opts.push(RETIRE_OPTION);
  if (!offers.length && c.age < 34)
    opts.push(skipOption("경기는 못 뛰지만 다음 시장을 노려요"));
  if (!opts.length) opts.push(RETIRE_OPTION);
  return {
    title: isFree ? "다시 시장에 나왔어요" : "FA 시장이 열렸어요",
    body: offers.length ? "계약이 끝났어요. 다음 팀을 고르세요." : "아직 들어온 제안이 없어요.",
    opts,
  };
}

export function undrafted(c: Career): Decision {
  const opts: DecisionOption[] = generateOffers(c, null, 6).map((o) => ({ ...o, tag: "육성 계약" }));
  opts.push(skipOption("다음 시즌 시장을 노려요"));
  return { title: "지명받지 못했어요", body: "드래프트에서 이름이 불리지 않았지만 다른 길이 남아 있어요.", opts };
}

export function nbaOffer(c: Career): Decision | null {
  if (!c.team || !c.contract) return null;
  const lg = c.team.lg;
  const o = ovr(c.p);
  const fromDev = lg === "gleague";
  // G리그에서는 NBA 평균 - 1이면 콜업, KBL·유로리그에서는 평균 + 2는 돼야 바이아웃을 내고 데려가요.
  if (!(lg === "kbl" || lg === "euro" || fromDev) || o < avg("nba") + (fromDev ? -1 : 2)) return null;
  const t = pickTeam("nba");
  const sal = fromDev ? 17 : roundSalary(salaryFor("nba", o));
  const years = fromDev ? 2 : 3;
  return {
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
  return clamp(0.45 + (ovr(c.p) - LEAGUES[lg].avg) / 25 + (rating - 6.5) * 0.1 + (c.perks.agency ? 0.1 : 0), 0.15, 0.85);
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
  const star = Math.max(0, ovr(c.p) - LEAGUES[lg].avg - 6);
  const p = clamp(
    0.45 + (currentExpectedMinutes(c) < 20 ? 0.2 : 0) - star * 0.04 + (c.perks.agency ? 0.1 : 0) - (c.trust >= 2 ? 0.1 : 0),
    0.1,
    0.85,
  );
  const stay: DecisionOption = { label: `${team.name}에 남는다`, sub: `남은 계약 ${c.contract!.years}년을 채워요`, act: { k: "none" } };
  if (chance(p)) {
    const offers = generateOffers(c, null, c.last?.rating || 6).filter((o) => o.act.k === "sign" && o.act.team.name !== team.name);
    if (!offers.length) {
      addNews(c, tag, "info", "구단은 이적을 허락했지만 관심을 보이는 팀이 없었어요.");
      return true;
    }
    addNews(c, tag, "info", `${team.name} 구단이 이적 요청을 받아들였어요.`);
    c.queue.unshift({
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
    title: "이적 요청 거절",
    body: `구단은 아직 당신이 필요하대요.${opts.length > 1 ? "" : ` 계약을 해지하려면 위약금 ${money(cost)}이 필요해요.`}`,
    opts,
  });
  return true;
}

export function retirementPrompt(c: Career): Decision {
  return {
    title: "은퇴를 고민할 나이",
    body: `${c.age}세. 계약은 ${c.contract?.years ?? 0}년 남았어요.`,
    opts: [{ label: "계속 뛴다", sub: "아직 코트에서 보여줄 게 있어요", act: { k: "none" } }, RETIRE_OPTION],
  };
}

export function forcedRetirement(): Decision {
  return {
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
