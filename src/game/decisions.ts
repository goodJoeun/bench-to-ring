import { LEAGUES, SHORT } from "./data";
import { pickTeam } from "./log";
import { pick, ri, rnd } from "./random";
import { expectedMinutes, ovr, ovrOf, roleOf, salaryFor } from "./ratings";
import type { Career, CurrentTeam, Decision, DecisionOption, ProLeagueKey, Team } from "./types";
import { clamp, money, roundSalary } from "./util";

/* ---------- 드래프트 평가 ---------- */

export function gblDraftScore(c: Career, noise: number): number {
  const o = ovrOf(c.p.attrs, c.p.pos);
  return o + (c.p.pot - o) * 0.35 + (22 - c.age) * 1.2 + c.p.wsd * 0.2 + noise;
}

export function courtDraftScore(c: Career, noise: number): number {
  const o = ovrOf(c.p.attrs, c.p.pos);
  return o + (c.p.pot - o) * 0.25 + (21 - c.age) * 0.6 + noise;
}

/** GBL 드래프트: 전체 1~60순위, 61 이상이면 미지명 */
export const gblPick = (score: number): number => Math.max(1, Math.round(60 - (score - 66) * 3.6));
/** 코트리그 드래프트: 전체 1~20순위, 21 이상이면 미지명 */
export const courtPick = (score: number): number => Math.max(1, Math.round(20 - (score - 54) * 1.3));

function projectGbl(c: Career): string {
  const pk = gblPick(gblDraftScore(c, 0));
  if (pk <= 3) return "1라운드 최상위";
  if (pk <= 12) return "1라운드 상위";
  if (pk <= 30) return "1라운드 중후반";
  if (pk <= 60) return "2라운드";
  return "지명 불확실";
}

function projectCourt(c: Career): string {
  const pk = courtPick(courtDraftScore(c, 0));
  if (pk <= 3) return "1라운드 최상위";
  if (pk <= 10) return "1라운드";
  if (pk <= 20) return "2라운드";
  return "지명 불확실";
}

/* ---------- 진로 결정 ---------- */

export function highSchoolGraduation(c: Career): Decision {
  const o = ovr(c.p);
  const opts: DecisionOption[] = [];
  const uc = pickTeam("ucol");
  const kc = pickTeam("kcol");
  const abroad = (walk: boolean): DecisionOption => ({
    label: `${uc.name} ${walk ? "워크온 입단" : "장학생 입학"}`,
    sub: `해외 대학리그 · 예상 역할 ${roleOf(expectedMinutes(c, "ucol", walk ? -3 : 0))}${
      walk ? " · 장학금 없이 들어가 처음엔 기회가 적어요" : ""
    }`,
    tag: "해외",
    act: { k: "school", lg: "ucol", team: uc, walk },
  });
  if (c.p.path === "abroad") opts.push(abroad(o < 56));
  else if (o >= 60) opts.push({ ...abroad(false), label: `${uc.name} 스카우트 제안` });
  opts.push({
    label: `${kc.name} 진학`,
    sub: `국내 대학리그 · 예상 역할 ${roleOf(expectedMinutes(c, "kcol"))}`,
    tag: "국내",
    act: { k: "school", lg: "kcol", team: kc },
  });
  if (o >= 56)
    opts.push({
      label: "코트리그 고졸 드래프트 참가",
      sub: `대학을 건너뛰고 바로 프로에 도전해요 · 스카우트 예상 ${projectCourt(c)}`,
      tag: "드래프트",
      act: { k: "draft", d: "court" },
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
  if (lg === "ucol" || o >= 68)
    opts.push({
      label: "GBL 드래프트 신청",
      sub: `세계 최고 리그 · 스카우트 예상 ${projectGbl(c)}`,
      tag: "GBL",
      act: { k: "draft", d: "gbl" },
    });
  opts.push({
    label: "코트리그 드래프트 신청",
    sub: `${lg === "ucol" ? "국내로 돌아와 " : ""}국내 프로리그 도전 · 스카우트 예상 ${projectCourt(c)}`,
    tag: "코트리그",
    act: { k: "draft", d: "court" },
  });
  return {
    title: years >= 4 ? "대학 졸업, 드래프트" : "대학 시즌 종료",
    body: years >= 4 ? "졸업 학년이에요. 드래프트에 나설 차례예요." : `대학 ${years}학년 시즌을 마쳤어요. 지금 오버롤은 ${o}예요.`,
    opts,
  };
}

/* ---------- 계약 제안 ---------- */

function offerOption(c: Career, lg: ProLeagueKey, t: Team, years: number, sal: number, note?: string): DecisionOption {
  const s = roundSalary(sal * rnd(0.9, 1.1));
  return {
    label: t.name,
    sub: `${LEAGUES[lg].name} · ${years}년 · 연봉 ${money(s)} · 예상 역할 ${roleOf(expectedMinutes(c, lg))}`,
    tag: note ?? LEAGUES[lg].short,
    act: { k: "sign", lg, team: t, years, salary: s },
  };
}

const RESIGN_MIN: Partial<Record<string, number>> = { gbl: 69, cont: 62, court: 53, dev: 58 };

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
  if (eff >= 71) {
    const n = eff >= 82 ? 3 : eff >= 76 ? 2 : 1;
    for (let i = 0; i < n; i++) add("gbl", years(), salaryFor("gbl", o));
  } else if (eff >= 67 && rnd(0, 1) < 0.65) add("gbl", 1, 15, "최저 연봉");
  if (eff >= 63 && out.length < 4) add("cont", years(), salaryFor("cont", o));
  if (eff >= 53 && out.length < 4) add("court", years(), salaryFor("court", o));
  if (age <= 27 && eff >= 58 && eff < 74 && out.length < 4 && rnd(0, 1) < 0.7) add("dev", 1, 0.6);
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

export function gblOffer(c: Career): Decision | null {
  if (!c.team || !c.contract) return null;
  const lg = c.team.lg;
  const o = ovr(c.p);
  const fromDev = lg === "dev";
  if (!(lg === "court" || lg === "cont" || fromDev) || o < (fromDev ? 70 : 73)) return null;
  const t = pickTeam("gbl");
  const sal = fromDev ? 15 : roundSalary(salaryFor("gbl", o));
  const years = fromDev ? 2 : 3;
  return {
    title: fromDev ? "GBL 콜업" : "GBL 영입 제안",
    body: fromDev
      ? `${t.name} 구단에서 1군으로 불러올리고 싶어해요.`
      : `${t.name} 구단에서 바이아웃 금액을 내고 데려가고 싶어해요.`,
    opts: [
      {
        label: `${t.name} 이적`,
        sub: `그랜드리그 · ${years}년 · 연봉 ${money(sal)} · 예상 역할 ${roleOf(expectedMinutes(c, "gbl"))}`,
        tag: "GBL",
        act: { k: "sign", lg: "gbl", team: t, years, salary: sal },
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

/* ---------- 오프시즌 이벤트 ---------- */

export function flavorEvent(c: Career): Decision {
  const o = ovr(c.p);
  const list: Decision[] = [
    {
      title: "여름 스킬 캠프 초청",
      body: "유명 트레이너의 3주 집중 캠프에 초대받았어요. 강도가 꽤 높아요.",
      opts: [
        { label: "캠프 참가", sub: "무작위 능력치 2개 +2 · 건강 -6", act: { k: "boost", rand: 2, amt: 2, health: -6, msg: "스킬 캠프를 완주했어요." } },
        { label: "푹 쉬기", sub: "건강 +8", act: { k: "boost", health: 8, msg: "여름 내내 몸을 회복했어요." } },
      ],
    },
    {
      title: "새벽 슈팅 루틴",
      body: "매일 새벽 슈팅 500개. 루틴을 시작할까요?",
      opts: [
        { label: "시작한다", sub: `${SHORT.sht} +3 · 건강 -4`, act: { k: "boost", attrs: { sht: 3 }, health: -4, msg: "새벽 슈팅 루틴이 몸에 붙었어요." } },
        { label: "평소대로", sub: "변화 없음", act: { k: "none" } },
      ],
    },
    {
      title: "필름 세션 제안",
      body: "코치가 매주 경기 영상을 함께 분석하자고 해요.",
      opts: [
        { label: "함께 한다", sub: "BQ +3", act: { k: "boost", attrs: { iq: 3 }, msg: "경기를 보는 눈이 넓어졌어요." } },
        { label: "웨이트에 집중", sub: "운동능력 +2", act: { k: "boost", attrs: { ath: 2 }, msg: "웨이트로 몸을 키웠어요." } },
      ],
    },
  ];
  if (c.stage === "pro" && o >= 72) {
    const pay = roundSalary(clamp(o - 70, 1, 20) * 1.5);
    list.push({
      title: "광고 모델 제안",
      body: "스포츠 브랜드에서 광고 촬영을 제안했어요.",
      opts: [
        { label: "수락", sub: `수입 +${money(pay)} · 건강 -3`, act: { k: "boost", money: pay, health: -3, msg: "광고 촬영을 마쳤어요." } },
        { label: "거절하고 훈련", sub: "코치 신뢰 상승", act: { k: "boost", trust: 1, msg: "시즌 준비에만 집중했어요." } },
      ],
    });
  }
  if (c.stage === "pro" && c.age <= 24) {
    list.push({
      title: "베테랑의 개인 레슨",
      body: "팀 베테랑이 여름 개인 훈련을 함께하자고 해요.",
      opts: [
        { label: "따라간다", sub: "BQ +2 · 수비 +2", act: { k: "boost", attrs: { iq: 2, def: 2 }, msg: "베테랑에게 프로의 습관을 배웠어요." } },
        { label: "혼자 훈련", sub: "변화 없음", act: { k: "none" } },
      ],
    });
  }
  return pick(list);
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
