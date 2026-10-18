import { LEAGUES } from "./data";
import { pickTeam } from "./log";
import { ri, rnd } from "./random";
import { expectedMinutes, ovr, ovrOf, roleOf, salaryFor } from "./ratings";
import type { Career, CurrentTeam, Decision, DecisionOption, ProLeagueKey, Team } from "./types";
import { money, roundSalary } from "./util";

/* ---------- 드래프트 평가 ---------- */

export function nbaDraftScore(c: Career, noise: number): number {
  const o = ovrOf(c.p.attrs, c.p.pos);
  return o + (c.p.pot - o) * 0.35 + (22 - c.age) * 1.2 + c.p.wsd * 0.2 + noise;
}

export function kblDraftScore(c: Career, noise: number): number {
  const o = ovrOf(c.p.attrs, c.p.pos);
  return o + (c.p.pot - o) * 0.25 + (21 - c.age) * 0.6 + noise;
}

/** NBA 드래프트: 2라운드 전체 1~60순위, 61 이상이면 미지명 */
export const nbaPick = (score: number): number => Math.max(1, Math.round(60 - (score - 71) * 3.6));
/** KBL 신인드래프트: 2라운드 전체 1~20순위, 21 이상이면 미지명 */
export const kblPick = (score: number): number => Math.max(1, Math.round(20 - (score - 54) * 1.3));

export function projectNba(c: Career): string {
  const pk = nbaPick(nbaDraftScore(c, 0));
  if (pk <= 3) return "1라운드 최상위";
  if (pk <= 12) return "1라운드 상위";
  if (pk <= 30) return "1라운드 중후반";
  if (pk <= 60) return "2라운드";
  return "지명 불확실";
}

export function projectKbl(c: Career): string {
  const pk = kblPick(kblDraftScore(c, 0));
  if (pk <= 3) return "1라운드 최상위";
  if (pk <= 10) return "1라운드";
  if (pk <= 20) return "2라운드";
  return "지명 불확실";
}

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
  if (c.p.path === "abroad") opts.push(abroad(o < 56));
  else if (o >= 60) opts.push({ ...abroad(false), label: `${uc.name} 스카우트 제안` });
  opts.push({
    label: `${kc.name} 진학`,
    sub: `대학농구 U-리그 · 예상 역할 ${roleOf(expectedMinutes(c, "kuniv"))}`,
    tag: "U-리그",
    act: { k: "school", lg: "kuniv", team: kc },
  });
  if (o >= 56)
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
  if (lg === "ncaa" || o >= 68)
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

function offerOption(c: Career, lg: ProLeagueKey, t: Team, years: number, sal: number, note?: string): DecisionOption {
  // 대형 에이전시가 있으면 협상에서 10% 더 받아요. 최저 연봉 계약은 그대로예요.
  const agent = c.perks.agency && note !== "최저 연봉" ? 1.1 : 1;
  const s = roundSalary(sal * rnd(0.9, 1.1) * agent);
  return {
    label: t.name,
    sub: `${LEAGUES[lg].name} · ${years}년 · 연봉 ${money(s)} · 예상 역할 ${roleOf(expectedMinutes(c, lg))}`,
    tag: note ?? LEAGUES[lg].short,
    act: { k: "sign", lg, team: t, years, salary: s },
  };
}

const RESIGN_MIN: Partial<Record<string, number>> = { nba: 72, euro: 62, kbl: 53, gleague: 58 };

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
  if (current && rating >= 5.6 && LEAGUES[current.lg].pro && eff >= (RESIGN_MIN[current.lg] ?? 99)) {
    const lg = current.lg as ProLeagueKey;
    used.add(current.name);
    out.push(offerOption(c, lg, { name: current.name, color: current.color, q: current.q }, years(), salaryFor(lg, o) * 1.05, "재계약"));
  }
  if (eff >= 75) {
    const n = eff >= 84 ? 3 : eff >= 79 ? 2 : 1;
    for (let i = 0; i < n; i++) add("nba", years(), salaryFor("nba", o));
  } else if (eff >= 72 && rnd(0, 1) < 0.45) add("nba", 1, 17, "최저 연봉");
  if (eff >= 63 && out.length < 4) add("euro", years(), salaryFor("euro", o));
  if (eff >= 53 && out.length < 4) add("kbl", years(), salaryFor("kbl", o));
  if (age <= 27 && eff >= 58 && eff < 74 && out.length < 4 && rnd(0, 1) < 0.7) add("gleague", 1, 0.6);
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
    opts.push({ label: "무소속으로 1년 개인 훈련", sub: "경기는 못 뛰지만 다음 시장을 노려요", act: { k: "skip" } });
  if (!opts.length) opts.push(RETIRE_OPTION);
  return {
    title: isFree ? "다시 시장에 나왔어요" : "FA 시장이 열렸어요",
    body: offers.length ? "계약이 끝났어요. 다음 팀을 고르세요." : "아직 들어온 제안이 없어요.",
    opts,
  };
}

export function undrafted(c: Career): Decision {
  const opts: DecisionOption[] = generateOffers(c, null, 6).map((o) => ({ ...o, tag: "육성 계약" }));
  opts.push({ label: "무소속으로 1년 개인 훈련", sub: "다음 시즌 시장을 노려요", act: { k: "skip" } });
  return { title: "지명받지 못했어요", body: "드래프트에서 이름이 불리지 않았지만 다른 길이 남아 있어요.", opts };
}

export function nbaOffer(c: Career): Decision | null {
  if (!c.team || !c.contract) return null;
  const lg = c.team.lg;
  const o = ovr(c.p);
  const fromDev = lg === "gleague";
  if (!(lg === "kbl" || lg === "euro" || fromDev) || o < (fromDev ? 74 : 77)) return null;
  const t = pickTeam("nba");
  const sal = fromDev ? 17 : roundSalary(salaryFor("nba", o));
  const years = fromDev ? 2 : 3;
  return {
    title: fromDev ? "NBA 콜업" : "NBA 영입 제안",
    body: fromDev
      ? `${t.name} 구단에서 G리그에서 NBA로 불러올리고 싶어해요.`
      : `${t.name} 구단에서 바이아웃 금액을 내고 데려가고 싶어해요.`,
    opts: [
      {
        label: `${t.name} 이적`,
        sub: `NBA · ${years}년 · 연봉 ${money(sal)} · 예상 역할 ${roleOf(expectedMinutes(c, "nba"))}`,
        tag: "NBA",
        act: { k: "sign", lg: "nba", team: t, years, salary: sal },
      },
      { label: `${c.team.name} 잔류`, sub: `남은 계약 ${c.contract.years}년을 채워요`, act: { k: "none" } },
    ],
  };
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
