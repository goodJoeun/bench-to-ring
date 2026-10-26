import { ATTR_KEYS } from "./data";
import { addNews } from "./log";
import { seededPick } from "./random";
import type { AttrKey, Career, InvestKey } from "./types";
import { money, round2 } from "./util";

/** 한 시즌에 고를 수 있는 투자 수. 돈보다 시간이 모자라요. */
export const INVEST_SLOTS = 2;
/** 시즌마다 기본 투자 옆에 나오는 특별 투자 수 */
export const SPECIAL_COUNT = 3;
/** 고교·대학 선수가 시즌마다 받는 용돈·후원금 (억) */
export const STUDENT_ALLOWANCE = 0.06;

/** 투자 한 가지의 효과. 성장·노화·부상·체력 배율은 곱해서, 건강·경기력·신뢰는 더해서 합쳐요. */
export interface InvestEffect {
  /** 능력치별 성장 (+0.2면 +20%) */
  growth?: Partial<Record<AttrKey, number>>;
  /** 모든 능력치 성장 */
  growthAll?: number;
  /** 능력치별 나이로 떨어지는 폭 배율 (0.75면 -25%) */
  decline?: Partial<Record<AttrKey, number>>;
  /** 모든 능력치의 나이로 떨어지는 폭 배율 */
  declineAll?: number;
  /** 부상 위험 배율 */
  injury?: number;
  /** 부상으로 빠지는 기간 배율 */
  rehab?: number;
  /** 경기마다 닳는 체력 배율 */
  fatigue?: number;
  /** 시즌 뒤 건강 */
  heal?: number;
  /** 시즌을 시작할 때의 경기력 */
  form?: number;
  /** 시즌 뒤 코치 신뢰 */
  trust?: number;
}

export interface Investment extends InvestEffect {
  key: InvestKey;
  name: string;
  /** 효과 한 줄 */
  effect: string;
  /** 연봉 대비 비용 비율 */
  pct: number;
  /** 최저 비용 (억). 연봉이 없거나 적어도 이만큼은 들어요. */
  min: number;
  /** 시즌마다 바뀌는 특별 투자인지. 아니면 늘 고를 수 있는 기본 투자예요. */
  special?: boolean;
  /** 특별 투자가 나올 수 있는 때 */
  when?: (c: Career) => boolean;
}

/**
 * 시즌마다 보유 자금으로 고르는 훈련·회복 투자. 효과는 그 시즌 한 번만 나요.
 * 특별 투자는 기본 투자와 비슷한 크기로, 한 능력치를 조금 더 키우거나 대가가 있는 대신 효과가 커요.
 */
export const INVESTMENTS: ReadonlyArray<Investment> = [
  { key: "coach", name: "개인 스킬 코치", effect: "모든 능력치 성장 +5%", pct: 0.3, min: 0.05, growthAll: 0.05 },
  {
    key: "gym", name: "웨이트·피지컬 프로그램", effect: "운동능력 성장 +20%, 나이로 떨어지는 폭 -25%", pct: 0.2, min: 0.03,
    growth: { ath: 0.2 }, decline: { ath: 0.75 },
  },
  { key: "rehab", name: "회복 관리팀", effect: "부상 위험 -20%, 시즌 뒤 건강 +8", pct: 0.2, min: 0.03, injury: 0.8, heal: 8 },
  { key: "diet", name: "영양·수면 관리", effect: "시즌 뒤 건강 +6, 나이로 떨어지는 폭 -10%", pct: 0.15, min: 0.02, heal: 6, declineAll: 0.9 },
  { key: "video", name: "영상 분석관", effect: "BQ 성장 +25%, 코치 신뢰 +0.5", pct: 0.15, min: 0.02, growth: { iq: 0.25 }, trust: 0.5 },

  { key: "shootcamp", name: "슈팅 전문 캠프", effect: "슛 성장 +20%", pct: 0.2, min: 0.03, special: true, growth: { sht: 0.2 } },
  { key: "handlecamp", name: "볼 핸들링 클리닉", effect: "볼 핸들링 성장 +20%", pct: 0.15, min: 0.02, special: true, growth: { hdl: 0.2 } },
  {
    key: "passcamp", name: "리딩·패스 세미나", effect: "패스 성장 +15%, BQ 성장 +10%", pct: 0.15, min: 0.02, special: true,
    growth: { pas: 0.15, iq: 0.1 },
  },
  {
    key: "defcamp", name: "수비 전술 캠프", effect: "수비 성장 +20%, 코치 신뢰 +0.3", pct: 0.2, min: 0.03, special: true,
    growth: { def: 0.2 }, trust: 0.3,
  },
  {
    key: "altitude", name: "고지대 전지훈련", effect: "운동능력 성장 +25%, 대신 시즌 뒤 건강 -4", pct: 0.2, min: 0.03, special: true,
    growth: { ath: 0.25 }, heal: -4,
  },
  {
    key: "mentor", name: "은퇴 레전드 멘토링", effect: "모든 능력치 성장 +3%, BQ 성장 +10%", pct: 0.25, min: 0.04, special: true,
    growthAll: 0.03, growth: { iq: 0.1 },
  },
  {
    key: "pilates", name: "필라테스·유연성 프로그램", effect: "부상 위험 -12%, 운동능력이 나이로 떨어지는 폭 -15%", pct: 0.15, min: 0.02,
    special: true, injury: 0.88, decline: { ath: 0.85 },
  },
  {
    key: "cryo", name: "냉동 치료·재활 장비", effect: "부상 복귀가 20% 빨라지고, 시즌 뒤 건강 +4", pct: 0.15, min: 0.02, special: true,
    rehab: 0.8, heal: 4,
  },
  {
    key: "preseason", name: "프리시즌 연습경기 투어", effect: "시즌을 경기력 상승으로 시작하고, 코치 신뢰 +0.3", pct: 0.15, min: 0.02,
    special: true, form: 0.3, trust: 0.3, when: (c) => !!c.team,
  },
  {
    key: "loadmgmt", name: "로드 매니지먼트 컨설팅", effect: "경기마다 닳는 체력 -10%", pct: 0.15, min: 0.03, special: true,
    fatigue: 0.9, when: (c) => c.stage === "pro",
  },
  {
    key: "academy", name: "농구 아카데미 특강", effect: "모든 능력치 성장 +4%", pct: 0.2, min: 0.02, special: true,
    growthAll: 0.04, when: (c) => c.stage === "hs" || c.stage === "college",
  },
];

const investment = (key: InvestKey): Investment => INVESTMENTS.find((i) => i.key === key)!;

/**
 * 이번 시즌에 고를 수 있는 투자: 기본 투자 전부와, 시즌마다 바뀌는 특별 투자 몇 가지.
 * 특별 투자는 커리어와 연도로 정해서, 같은 시즌이면 다시 열어도 같은 목록이 나와요.
 */
export function investLineup(c: Career): Investment[] {
  const rand = seededPick(`${c.id}:${c.year}:invest`);
  const specials = INVESTMENTS.filter((i) => i.special && (i.when?.(c) ?? true))
    .map((i) => ({ i, r: rand() }))
    .sort((a, b) => a.r - b.r)
    .slice(0, SPECIAL_COUNT)
    .map((x) => x.i);
  return [...INVESTMENTS.filter((i) => !i.special), ...specials];
}

/** 고른 투자 중 이번 시즌에도 나와 있는 것. 지난 시즌에 고른 특별 투자가 이번에 없으면 빠져요. */
export function chosenInvest(c: Career): InvestKey[] {
  const offered = new Set(investLineup(c).map((i) => i.key));
  return c.invest.filter((k) => offered.has(k)).slice(0, INVEST_SLOTS);
}

/** 지금 연봉 기준 비용 (억) */
export function investCost(c: Career, key: InvestKey): number {
  const inv = investment(key);
  return round2(Math.max(inv.min, (c.contract?.salary ?? 0) * inv.pct));
}

/** 이번 시즌에 낸 투자의 효과를 합쳐요. 시즌 진행과 성장 계산에서 써요. */
export interface InvestPerks {
  growth: Record<AttrKey, number>;
  decline: Record<AttrKey, number>;
  injury: number;
  rehab: number;
  fatigue: number;
  heal: number;
  form: number;
  trust: number;
}

export function investPerks(keys: Iterable<InvestKey>): InvestPerks {
  const ones = () => Object.fromEntries(ATTR_KEYS.map((k) => [k, 1])) as Record<AttrKey, number>;
  const p: InvestPerks = { growth: ones(), decline: ones(), injury: 1, rehab: 1, fatigue: 1, heal: 0, form: 0, trust: 0 };
  for (const key of keys) {
    const i = investment(key);
    for (const k of ATTR_KEYS) {
      p.growth[k] *= 1 + (i.growthAll ?? 0) + (i.growth?.[k] ?? 0);
      p.decline[k] *= (i.declineAll ?? 1) * (i.decline?.[k] ?? 1);
    }
    p.injury *= i.injury ?? 1;
    p.rehab *= i.rehab ?? 1;
    p.fatigue *= i.fatigue ?? 1;
    p.heal += i.heal ?? 0;
    p.form += i.form ?? 0;
    p.trust += i.trust ?? 0;
  }
  return p;
}

/** 복무 중에는 투자할 수 없어요. */
export const canInvest = (c: Career): boolean => c.stage !== "military" && c.stage !== "retired";

/**
 * 시즌을 시작하며 고른 투자 비용을 내요. 돈이 모자라면 고른 순서대로 낼 수 있는 것만 해요.
 * 실제로 낸 투자만 돌려줘요. 고른 목록은 다음 시즌에도 남고, 그 시즌에 나와 있는 투자만 해요.
 */
export function payInvestments(c: Career, tag: string): Set<InvestKey> {
  const paid = new Set<InvestKey>();
  if (!canInvest(c)) return paid;
  const chosen = chosenInvest(c);
  let total = 0;
  for (const key of chosen) {
    const cost = investCost(c, key);
    if (cost > c.earnings + 1e-9) continue;
    c.earnings = round2(c.earnings - cost);
    c.spent = round2(c.spent + cost);
    total += cost;
    paid.add(key);
  }
  if (paid.size) {
    const names = INVESTMENTS.filter((i) => paid.has(i.key)).map((i) => i.name);
    addNews(c, tag, "info", `시즌 투자 · ${names.join(", ")} · ${money(total)}`);
  }
  if (paid.size < chosen.length) addNews(c, tag, "bad", "보유 자금이 모자라 고른 투자 중 일부를 하지 못했어요.");
  return paid;
}
