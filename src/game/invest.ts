import { addNews } from "./log";
import type { Career, InvestKey } from "./types";
import { money, round2 } from "./util";

/** 한 시즌에 고를 수 있는 투자 수. 돈보다 시간이 모자라요. */
export const INVEST_SLOTS = 2;
/** 고교·대학 선수가 시즌마다 받는 용돈·후원금 (억) */
export const STUDENT_ALLOWANCE = 0.06;

export interface Investment {
  key: InvestKey;
  name: string;
  /** 효과 한 줄 */
  effect: string;
  /** 연봉 대비 비용 비율 */
  pct: number;
  /** 최저 비용 (억). 연봉이 없거나 적어도 이만큼은 들어요. */
  min: number;
}

/** 시즌마다 보유 자금으로 고르는 훈련·회복 투자. 효과는 그 시즌 한 번만 나요. */
export const INVESTMENTS: ReadonlyArray<Investment> = [
  { key: "coach", name: "개인 스킬 코치", effect: "모든 능력치 성장 +5%", pct: 0.3, min: 0.05 },
  { key: "gym", name: "웨이트·피지컬 프로그램", effect: "운동능력 성장 +20%, 나이로 떨어지는 폭 -25%", pct: 0.2, min: 0.03 },
  { key: "rehab", name: "회복 관리팀", effect: "부상 위험 -20%, 시즌 뒤 건강 +8", pct: 0.2, min: 0.03 },
  { key: "diet", name: "영양·수면 관리", effect: "시즌 뒤 건강 +6, 나이로 떨어지는 폭 -10%", pct: 0.15, min: 0.02 },
  { key: "video", name: "영상 분석관", effect: "BQ 성장 +25%, 코치 신뢰 +0.5", pct: 0.15, min: 0.02 },
];

/** 지금 연봉 기준 비용 (억) */
export function investCost(c: Career, key: InvestKey): number {
  const inv = INVESTMENTS.find((i) => i.key === key)!;
  return round2(Math.max(inv.min, (c.contract?.salary ?? 0) * inv.pct));
}

/** 복무 중에는 투자할 수 없어요. */
export const canInvest = (c: Career): boolean => c.stage !== "military" && c.stage !== "retired";

/**
 * 시즌을 시작하며 고른 투자 비용을 내요. 돈이 모자라면 고른 순서대로 낼 수 있는 것만 해요.
 * 실제로 낸 투자만 돌려줘요. 고른 목록은 다음 시즌에도 그대로 남아요.
 */
export function payInvestments(c: Career, tag: string): Set<InvestKey> {
  const paid = new Set<InvestKey>();
  if (!canInvest(c)) return paid;
  let total = 0;
  for (const key of c.invest.slice(0, INVEST_SLOTS)) {
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
  if (paid.size < Math.min(c.invest.length, INVEST_SLOTS)) addNews(c, tag, "bad", "보유 자금이 모자라 고른 투자 중 일부를 하지 못했어요.");
  return paid;
}
