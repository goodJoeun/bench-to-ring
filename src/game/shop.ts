import { addHealth } from "./condition";
import { addNews } from "./log";
import type { Career, ShopKey } from "./types";
import { money, round2 } from "./util";

/*
 * 보유 자금으로 사는 것. 시즌 투자와 달리 한 번 사면 커리어 내내 남아요.
 * 학생 용돈으로 살 수 있는 농구화부터 NBA 스타만 엄두를 낼 아카데미까지 값의 폭을 넓게 잡았어요.
 */

export interface ShopItem {
  key: ShopKey;
  name: string;
  /** 효과 한 줄 */
  effect: string;
  /** 값 (억) */
  price: number;
}

export const SHOP: ReadonlyArray<ShopItem> = [
  { key: "shoes", name: "맞춤 농구화", effect: "부상 위험 -5%", price: 0.03 },
  { key: "parents", name: "부모님께 집 선물", effect: "지금 건강 +10 · 효도는 커리어에 남아요", price: 3 },
  { key: "car", name: "드림카 구입", effect: "지금 건강 +3 · 기분 전환일 뿐이에요", price: 4 },
  { key: "home", name: "내 집 마련", effect: "시즌이 끝날 때마다 건강 +4", price: 5 },
  { key: "chef", name: "전담 셰프·영양팀", effect: "경기 중 체력 소모 -12%", price: 12 },
  { key: "recovery", name: "개인 회복 센터", effect: "부상 위험 -15%, 부상 복귀가 빨라져요", price: 30 },
  { key: "court", name: "개인 훈련장", effect: "능력치 성장 +4%, 나이로 떨어지는 폭 -10%", price: 60 },
  { key: "academy", name: "유소년 농구 아카데미 설립", effect: "은퇴 기록에 남아요", price: 150 },
];

/** 기부 금액 (억). 가진 돈 안에서 고를 수 있어요. */
export const DONATIONS = [0.1, 1, 10, 100] as const;

export const shopItem = (key: ShopKey): ShopItem => SHOP.find((i) => i.key === key)!;
export const owns = (c: Career, key: ShopKey): boolean => c.owned.includes(key);

/** 지금 살 수 있는지: 은퇴 전, 시즌 사이, 아직 없고 돈이 있으면 */
export function canBuy(c: Career, key: ShopKey): boolean {
  return c.stage !== "retired" && !c.run && !owns(c, key) && c.earnings + 1e-9 >= shopItem(key).price;
}

export function buy(c: Career, key: ShopKey): boolean {
  if (!canBuy(c, key)) return false;
  const item = shopItem(key);
  c.earnings = round2(c.earnings - item.price);
  c.spent = round2(c.spent + item.price);
  c.owned.push(key);
  if (key === "parents") addHealth(c, 10);
  if (key === "car") addHealth(c, 3);
  addNews(c, `${c.year - 1} 오프시즌`, key === "academy" ? "big" : "good", `${item.name} · ${money(item.price)}`);
  return true;
}

export function canDonate(c: Career, amount: number): boolean {
  return c.stage !== "retired" && !c.run && c.earnings + 1e-9 >= amount;
}

export function donate(c: Career, amount: number): boolean {
  if (!canDonate(c, amount)) return false;
  c.earnings = round2(c.earnings - amount);
  c.spent = round2(c.spent + amount);
  c.donated = round2(c.donated + amount);
  addNews(c, `${c.year - 1} 오프시즌`, "good", `유소년 농구 발전 기금 ${money(amount)}을 기부했어요. 누적 기부 ${money(c.donated)}`);
  return true;
}
