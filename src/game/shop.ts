import { ATTR_KEYS, SHORT } from "./data";
import { addAttr, addHealth } from "./condition";
import { addNews } from "./log";
import { chance, seededPick, shuffle } from "./random";
import type { AttrKey, Career, ShopKey } from "./types";
import { money, round2 } from "./util";

/*
 * 보유 자금으로 사는 것. 시즌 투자와 달리 한 번 사면 커리어 내내 남아요(일회성 상품만 빼고).
 * 상점에는 시즌마다 SHOP_SIZE개만 진열되고, 진열 상품은 시즌이 바뀔 때마다 새로 골라요.
 * 싼 것(1억 미만)·중간(1억~20억)·비싼 것(20억 넘게)을 고루 섞어서, 학생 용돈부터 NBA 연봉까지 살 거리가 있게 했어요.
 */

export type ShopCategory = "장비" | "회복·생활" | "사치품" | "일회성" | "유산";

export interface ShopItem {
  key: ShopKey;
  name: string;
  /** 상점과 보유 목록에 붙는 아이콘 (이모지) */
  icon: string;
  cat: ShopCategory;
  /** 값 (억) */
  price: number;
  /** 효과 한 줄 */
  effect: string;
  /** 이 능력치들이 클 때 더 커요 (+0.06이면 +6%) */
  growth?: Partial<Record<AttrKey, number>>;
  /** 모든 능력치 성장 (+0.04면 +4%) */
  growthAll?: number;
  /** 나이로 떨어지는 폭 배수 */
  decline?: number;
  /** 부상 위험 배수 */
  injury?: number;
  /** 부상 결장 경기 배수 */
  rehab?: number;
  /** 경기 중 체력 소모 배수 */
  fatigue?: number;
  /** 시즌이 끝날 때 더 돌아오는 건강 */
  heal?: number;
  /** 시즌을 시작할 때 경기력 */
  form?: number;
  /** 사는 순간 건강 */
  health?: number;
  /** 사는 순간 무작위 능력치 rand개 +1 */
  rand?: number;
  /** 다른 시즌에 다시 살 수 있어요 (보유 목록에 남지 않아요). */
  repeat?: boolean;
  /** 은퇴 기록의 '코트 밖에서'에 남아요. */
  legacy?: boolean;
}

/** 상품 아이콘 */
const ICONS: Record<ShopKey, string> = {
  shoes: "👟",
  dribblegear: "🧤",
  passtrainer: "🔄",
  slideboard: "🛡️",
  shootingmachine: "🎯",
  weightset: "🏋️",
  videosystem: "🎥",
  court: "🏟️",
  massage: "💆",
  sleeppod: "🛏️",
  mental: "🧠",
  home: "🏠",
  hypoxic: "⛺",
  chef: "👨‍🍳",
  physio: "🩺",
  recovery: "🏥",
  penthouse: "🌆",
  jet: "✈️",
  sneakers: "🛍️",
  watch: "⌚",
  trophyroom: "🏆",
  car: "🏎️",
  yacht: "🛥️",
  retreat: "🧘",
  bootcamp: "⛰️",
  familytrip: "🧳",
  parents: "🎁",
  gymremodel: "🏫",
  foundation: "💝",
  academy: "🏀",
};

const item = (key: ShopKey, name: string, cat: ShopCategory, price: number, effect: string, extra: Omit<ShopItem, "key" | "name" | "icon" | "cat" | "price" | "effect"> = {}): ShopItem => ({
  key,
  name,
  icon: ICONS[key],
  cat,
  price,
  effect,
  ...extra,
});

export const SHOP: ReadonlyArray<ShopItem> = [
  /* 장비: 맡은 능력치가 커리어 내내 조금 더 잘 커요. */
  item("shoes", "맞춤 농구화", "장비", 0.03, "부상 위험 -5%", { injury: 0.95 }),
  item("dribblegear", "드리블 트레이닝 기어", "장비", 0.08, "볼 핸들링 성장 +6%", { growth: { hdl: 0.06 } }),
  item("passtrainer", "패스 리바운더", "장비", 0.1, "패스 성장 +6%", { growth: { pas: 0.06 } }),
  item("slideboard", "수비 슬라이드 보드", "장비", 0.12, "수비 성장 +6%", { growth: { def: 0.06 } }),
  item("shootingmachine", "슈팅 머신", "장비", 0.5, "슛 성장 +6%", { growth: { sht: 0.06 } }),
  item("weightset", "홈 웨이트 세트", "장비", 0.6, "운동능력 성장 +6%", { growth: { ath: 0.06 } }),
  item("videosystem", "개인 영상 분석 시스템", "장비", 2, "BQ 성장 +8%", { growth: { iq: 0.08 } }),
  item("court", "개인 훈련장", "장비", 60, "모든 능력치 성장 +4%, 나이로 떨어지는 폭 -10%", { growthAll: 0.04, decline: 0.9 }),

  /* 회복·생활: 건강과 체력을 지켜요. */
  item("massage", "마사지 의자", "회복·생활", 0.05, "시즌이 끝날 때마다 건강 +1", { heal: 1 }),
  item("sleeppod", "수면 캡슐 침대", "회복·생활", 0.25, "시즌이 끝날 때마다 건강 +2", { heal: 2 }),
  item("mental", "스포츠 심리 상담 패키지", "회복·생활", 1, "시즌을 경기력 상승으로 시작해요", { form: 0.3 }),
  item("home", "내 집 마련", "회복·생활", 5, "시즌이 끝날 때마다 건강 +4", { heal: 4 }),
  item("hypoxic", "고지대 훈련 텐트", "회복·생활", 8, "경기 중 체력 소모 -6%", { fatigue: 0.94 }),
  item("chef", "전담 셰프·영양팀", "회복·생활", 12, "경기 중 체력 소모 -12%", { fatigue: 0.88 }),
  item("physio", "전담 물리치료사 평생 계약", "회복·생활", 20, "부상 위험 -10%, 부상 복귀가 빨라져요", { injury: 0.9, rehab: 0.9 }),
  item("recovery", "개인 회복 센터", "회복·생활", 30, "부상 위험 -15%, 부상 복귀가 빨라져요", { injury: 0.85, rehab: 0.85 }),
  item("penthouse", "한강 펜트하우스", "회복·생활", 40, "지금 건강 +5, 시즌이 끝날 때마다 건강 +3", { health: 5, heal: 3 }),
  item("jet", "전용 전세기", "회복·생활", 80, "원정 피로가 줄어 경기 중 체력 소모 -10%", { fatigue: 0.9 }),

  /* 사치품: 기분 전환. 효과는 작거나 없어요. */
  item("sneakers", "한정판 스니커즈 컬렉션", "사치품", 0.08, "지금 건강 +1 · 수집하는 즐거움", { health: 1 }),
  item("watch", "명품 시계", "사치품", 1.5, "효과는 없어요 · 손목이 빛나요"),
  item("trophyroom", "트로피 진열실", "사치품", 2, "효과는 없어요 · 받은 상을 모아 둬요"),
  item("car", "드림카 구입", "사치품", 4, "지금 건강 +3 · 기분 전환일 뿐이에요", { health: 3 }),
  item("yacht", "요트", "사치품", 25, "지금 건강 +5 · 바다 위에서 쉬어요", { health: 5 }),

  /* 일회성: 진열될 때마다 다시 살 수 있어요. */
  item("retreat", "명상 리트릿", "일회성", 0.3, "지금 건강 +6", { health: 6, repeat: true }),
  item("bootcamp", "여름 개인 전지훈련", "일회성", 0.6, "지금 무작위 능력치 2개 +1", { rand: 2, repeat: true }),
  item("familytrip", "가족 여행", "일회성", 1, "지금 건강 +8", { health: 8, repeat: true }),

  /* 유산: 은퇴 기록에 남아요. */
  item("parents", "부모님께 집 선물", "유산", 3, "지금 건강 +10 · 효도는 커리어에 남아요", { health: 10, legacy: true }),
  item("gymremodel", "모교 체육관 리모델링", "유산", 10, "은퇴 기록에 남아요", { legacy: true }),
  item("foundation", "자선 재단 설립", "유산", 50, "은퇴 기록에 남아요", { legacy: true }),
  item("academy", "유소년 농구 아카데미 설립", "유산", 150, "은퇴 기록에 남아요", { legacy: true }),
];

/** 시즌마다 진열하는 상품 수: 싼 것·중간·비싼 것에서 두 개씩 */
export const SHOP_SIZE = 6;

/** 기부 금액 (억). 가진 돈 안에서, 금액마다 한 시즌에 한 번씩 할 수 있어요. */
export const DONATIONS = [0.1, 1, 10, 100] as const;

/** 기부할 때마다 이 확률로 금액에 맞는 보답(좋은 일)이 와요. */
export const DONATION_LUCK = 0.20;

/** 기부 보답: 금액이 클수록 커요. form은 이번 시즌을 시작할 때 경기력이에요. */
interface DonationReward {
  health?: number;
  form?: number;
  /** 무작위 능력치 rand개 +1 */
  rand?: number;
}

export const DONATION_REWARDS: Record<(typeof DONATIONS)[number], DonationReward> = {
  0.1: { health: 5, form: 0.3 },
  1: { rand: 1 },
  10: { rand: 2, form: 0.5 },
  100: { rand: 3, health: 10 },
};

/** 기부 보답을 한 줄로: "건강 +5 · 시즌 시작 경기력 상승" */
export function describeDonationReward(amount: number): string {
  const r = DONATION_REWARDS[amount as (typeof DONATIONS)[number]];
  if (!r) return "";
  const parts: string[] = [];
  if (r.rand) parts.push(`무작위 능력치 ${r.rand}개 +1`);
  if (r.health) parts.push(`건강 +${r.health}`);
  if (r.form) parts.push("시즌 시작 경기력 상승");
  return parts.join(" · ");
}

export const shopItem = (key: ShopKey): ShopItem | undefined => SHOP.find((i) => i.key === key);
export const owns = (c: Career, key: ShopKey): boolean => c.owned.includes(key);

/** 이번 시즌 진열을 새로 골라요. 이미 가진 상품(일회성 제외)은 다시 나오지 않아요. */
export function refreshShop(c: Career): void {
  if (c.shop?.year === c.year) return;
  const rand = seededPick(`${c.id}:${c.year}`);
  const pool = SHOP.filter((i) => i.repeat || !owns(c, i.key));
  const take = (list: ShopItem[], n: number) =>
    list
      .map((i) => ({ i, r: rand() }))
      .sort((a, b) => a.r - b.r)
      .slice(0, n)
      .map((x) => x.i);
  const picked = [
    ...take(pool.filter((i) => i.price < 1), 2),
    ...take(pool.filter((i) => i.price >= 1 && i.price <= 20), 2),
    ...take(pool.filter((i) => i.price > 20), 2),
  ];
  // 한 가격대가 바닥나면 남은 상품으로 채워요.
  const rest = take(pool.filter((i) => !picked.includes(i)), SHOP_SIZE - picked.length);
  c.shop = { year: c.year, keys: [...picked, ...rest].sort((a, b) => a.price - b.price).map((i) => i.key), bought: [] };
}

/** 이번 시즌 진열 상품 (값 순) */
export const shopLineup = (c: Career): ShopItem[] => (c.shop?.keys ?? []).map(shopItem).filter((i): i is ShopItem => !!i);

/** 이번 시즌에 이미 산 진열 상품인지 */
export const boughtThisSeason = (c: Career, key: ShopKey): boolean => !!c.shop?.bought.includes(key);

/** 지금 살 수 있는지: 은퇴 전, 시즌 사이, 이번 진열에 있고, 아직 안 샀고, 돈이 있으면 */
export function canBuy(c: Career, key: ShopKey): boolean {
  const i = shopItem(key);
  if (!i || c.stage === "retired" || c.run || !c.shop?.keys.includes(key) || boughtThisSeason(c, key)) return false;
  return (i.repeat || !owns(c, key)) && c.earnings + 1e-9 >= i.price;
}

export function buy(c: Career, key: ShopKey): boolean {
  if (!canBuy(c, key)) return false;
  const i = shopItem(key)!;
  c.earnings = round2(c.earnings - i.price);
  c.spent = round2(c.spent + i.price);
  c.shop!.bought.push(key);
  if (!i.repeat) c.owned.push(key);
  if (i.health) addHealth(c, i.health);
  let note = "";
  if (i.rand) {
    const keys = shuffle(ATTR_KEYS).slice(0, i.rand);
    for (const k of keys) addAttr(c.p.attrs, k, 1);
    note = ` · ${keys.map((k) => SHORT[k]).join("·")} +1`;
  }
  addNews(c, `${c.year - 1} 오프시즌`, i.legacy && i.price >= 10 ? "big" : "good", `${i.name} · ${money(i.price)}${note}`);
  return true;
}

/** 가진 상품 (산 순서) */
export const ownedItems = (c: Career): ShopItem[] => c.owned.map(shopItem).filter((i): i is ShopItem => !!i);

/** 가진 상품의 효과를 합쳐요. 시즌 진행과 성장 계산에서 써요. */
export interface ShopPerks {
  injury: number;
  rehab: number;
  fatigue: number;
  heal: number;
  form: number;
  decline: number;
  growth: Record<AttrKey, number>;
}

export function shopPerks(c: Career): ShopPerks {
  const p: ShopPerks = { injury: 1, rehab: 1, fatigue: 1, heal: 0, form: 0, decline: 1, growth: { sht: 1, hdl: 1, pas: 1, def: 1, iq: 1, ath: 1 } };
  for (const i of ownedItems(c)) {
    p.injury *= i.injury ?? 1;
    p.rehab *= i.rehab ?? 1;
    p.fatigue *= i.fatigue ?? 1;
    p.heal += i.heal ?? 0;
    p.form += i.form ?? 0;
    p.decline *= i.decline ?? 1;
    for (const k of ATTR_KEYS) p.growth[k] += (i.growth?.[k] ?? 0) + (i.growthAll ?? 0);
  }
  return p;
}

/** 이번 시즌에 이 금액을 이미 기부했는지 */
export const donatedThisSeason = (c: Career, amount: number): boolean => c.shop?.year === c.year && !!c.shop.gave?.includes(amount);

/** 지금 기부할 수 있는지: 은퇴 전, 시즌 사이, 이번 시즌에 이 금액을 아직 안 했고, 돈이 있으면 */
export function canDonate(c: Career, amount: number): boolean {
  return c.stage !== "retired" && !c.run && c.shop?.year === c.year && !donatedThisSeason(c, amount) && c.earnings + 1e-9 >= amount;
}

/** 기부해요. DONATION_LUCK 확률로 금액에 맞는 보답이 와서, 같은 소식에 함께 적어요. */
export function donate(c: Career, amount: number): boolean {
  if (!canDonate(c, amount)) return false;
  const shop = c.shop!;
  c.earnings = round2(c.earnings - amount);
  c.spent = round2(c.spent + amount);
  c.donated = round2(c.donated + amount);
  shop.gave = [...(shop.gave ?? []), amount];
  let luck = "";
  const r = DONATION_REWARDS[amount as (typeof DONATIONS)[number]];
  if (r && chance(DONATION_LUCK)) {
    const parts: string[] = [];
    if (r.rand) {
      const keys = shuffle(ATTR_KEYS).slice(0, r.rand);
      for (const k of keys) addAttr(c.p.attrs, k, 1);
      parts.push(`${keys.map((k) => SHORT[k]).join("·")} +1`);
    }
    if (r.health) {
      addHealth(c, r.health);
      parts.push(`건강 +${r.health}`);
    }
    if (r.form) {
      shop.form = (shop.form ?? 0) + r.form;
      parts.push("시즌 시작 경기력 상승");
    }
    luck = ` · 아이들의 응원에 힘이 났어요! ${parts.join(" · ")}`;
  }
  addNews(c, `${c.year - 1} 오프시즌`, luck ? "big" : "good", `유소년 농구 발전 기금 ${money(amount)}을 기부했어요. 누적 기부 ${money(c.donated)}${luck}`);
  return true;
}
