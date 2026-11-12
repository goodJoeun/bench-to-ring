import type { AwardKey, Career, LeagueKey, SeasonRecord } from "../core/types";
import { clamp } from "../core/util";

/*
 * 스타성: 팬과 미디어가 내 선수에게 쏟는 관심 (0~100).
 * 경기 활약과 수상, 클러치 성공, 도발적인 인터뷰, 시그니처 세리머니, 미담, 팬 서비스로 오르고, 시즌마다 조금씩 식어요.
 * 일정 수치를 넘으면 돈이 되는 제안(예능, 광고, 유니폼 판매 수익, 시그니처 농구화)이 오기 시작해요.
 * 능력치·출전 시간에는 영향을 주지 않아요. 계산에 운을 쓰지 않아서 시즌 진행의 난수 흐름도 그대로예요.
 */

export const STAR_RANGE = [0, 100] as const;
/** 새로 시작한 고교 선수의 스타성 */
export const START_STAR = 3;
/** 시즌마다 식는 몫 */
export const STAR_FADE = 0.18;

export const clampStar = (v: number): number => clamp(v, ...STAR_RANGE);

/** 스타성 단계. 낮은 단계부터 */
export const STAR_TIERS: ReadonlyArray<{ min: number; name: string }> = [
  { min: 0, name: "무명" },
  { min: 15, name: "알려진 선수" },
  { min: 30, name: "인기 선수" },
  { min: 55, name: "스타" },
  { min: 75, name: "슈퍼스타" },
  { min: 90, name: "아이콘" },
];

export function starTier(star: number): string {
  let name = STAR_TIERS[0].name;
  for (const t of STAR_TIERS) if (star >= t.min) name = t.name;
  return name;
}

export type StarUnlockKey = "nil" | "variety" | "ad" | "jersey" | "shoe";

/** 스타성이 있어야 오는 제안. 이 수치 이상이어야 오프시즌 이벤트로 제안이 와요. */
export const STAR_UNLOCKS: ReadonlyArray<{ key: StarUnlockKey; min: number; name: string; desc: string }> = [
  { key: "nil", min: 15, name: "NIL 후원", desc: "미국 대학 선수의 이름·초상권 후원" },
  { key: "variety", min: 30, name: "예능 출연", desc: "오프시즌 예능 프로그램 출연료" },
  { key: "ad", min: 40, name: "광고 모델", desc: "스포츠 브랜드 광고 촬영" },
  { key: "jersey", min: 55, name: "유니폼 판매 수익", desc: "내 이름 유니폼 판매 수익 배분" },
  { key: "shoe", min: 75, name: "시그니처 농구화", desc: "내 이름을 단 농구화 (커리어에 한 번)" },
];

export function starNeed(key: StarUnlockKey): number {
  return STAR_UNLOCKS.find((u) => u.key === key)!.min;
}

/** 이 제안이 올 만큼 스타성이 있는지 */
export const hasStar = (c: Career, key: StarUnlockKey): boolean => c.star >= starNeed(key);

/** 리그마다 받는 관심의 크기. 수상과 시즌 활약으로 얻는 스타성에 곱해요. */
export const STAR_EXPOSURE: Record<LeagueKey, number> = {
  hs: 0.35,
  kuniv: 0.5,
  ncaa: 0.9,
  kbl: 0.8,
  gleague: 0.5,
  euro: 0.9,
  nba: 1.4,
};

/** 상마다 오르는 스타성 (리그 관심을 곱하기 전). 국가대표 메달은 리그와 상관없이 그대로예요. */
const AWARD_STAR: Record<AwardKey, number> = {
  mvp_nba: 8,
  mvp: 5,
  fmvp: 5,
  cfmvp: 2,
  ring: 5,
  title: 2,
  allleague: 3,
  allleague2: 1.5,
  alldef: 1,
  allrookie: 1,
  allstar: 2,
  roy: 3,
  dpoy: 2,
  scoring: 2,
  sixth: 1,
  mip: 1,
  nat_gold: 6,
  nat_silver: 3,
  nat_bronze: 2,
};
const NAT_MEDALS: AwardKey[] = ["nat_gold", "nat_silver", "nat_bronze"];

/** 상을 받을 때 오르는 스타성 */
export function awardStar(k: AwardKey, lg: LeagueKey | null | undefined): number {
  if (NAT_MEDALS.includes(k)) return AWARD_STAR[k];
  return AWARD_STAR[k] * (lg ? STAR_EXPOSURE[lg] : 0.5);
}

/** 이 특성을 타고나면 오르는 스타성이 STAR_TRAIT_BOOST배예요. */
export const STAR_TRAIT = "스타성";
export const STAR_TRAIT_BOOST = 1.3;

/** 클러치 성공으로 오르는 스타성. 결승 클러치는 더 크게 올라요. */
export const CLUTCH_STAR = 1.5;
export const FINAL_CLUTCH_STAR = 4;

/**
 * 스타성을 d만큼 바꿔요. 새 단계에 오르거나 새 제안이 열리면 소식으로 남길 문구를 돌려줘요.
 * 소식은 부르는 쪽이 남겨요 (career/log.ts가 이 파일을 가져오므로 여기서는 가져오지 않아요).
 */
export function addStar(c: Career, d: number): string | null {
  const before = c.star;
  // 특성 '스타성'을 타고난 선수는 관심을 더 빨리 모아요.
  if (d > 0 && c.p.trait === STAR_TRAIT) d *= STAR_TRAIT_BOOST;
  c.star = clampStar(Math.round((before + d) * 10) / 10);
  if (c.star <= before) return null;
  // 여러 단계를 한꺼번에 넘으면 가장 높은 단계를 알려요.
  const tier = STAR_TIERS.filter((t) => before < t.min && c.star >= t.min && t.min > 0).at(-1);
  const unlocks = STAR_UNLOCKS.filter((u) => before < u.min && c.star >= u.min).map((u) => u.name);
  if (!tier && !unlocks.length) return null;
  const head = tier ? `스타성 ${Math.round(c.star)} · '${tier.name}'에 올랐어요!` : `스타성 ${Math.round(c.star)}!`;
  return unlocks.length ? `${head} 이제 ${unlocks.join("·")} 제안이 올 수 있어요.` : head;
}

/**
 * 시즌을 마칠 때의 스타성 변화: 시즌을 시작할 때의 관심(star)이 조금 식고, 뛴 리그의 관심만큼 활약이 더해져요.
 * 평점 6.3점 아래로 뛰거나 거의 못 뛰면 식기만 해요. 수상과 클러치는 받을 때 따로 더해요.
 */
export function seasonStar(star: number, rec: SeasonRecord): number {
  const fade = -star * STAR_FADE;
  if (!rec.lg || !rec.gp) return fade;
  const play = clamp(rec.rating - 6.3, 0, 2.5) * clamp(rec.min / 32, 0, 1.1);
  const run = rec.final?.win ? 1 : 0;
  return fade + (play * 1.6 + run) * STAR_EXPOSURE[rec.lg];
}

/**
 * 스타성이 생기기 전의 저장: 지금까지 받은 상과 최고 오버롤로 어림해요.
 * 상을 받을 때마다 오른 몫을 더하고, 시즌마다 식는 만큼 덜어 실제로 키운 값과 비슷하게 맞춰요.
 */
export function estimateStar(c: Career): number {
  let star = START_STAR;
  const byYear = new Map<number, AwardKey[]>();
  for (const a of c.awardLog) byYear.set(a.y, [...(byYear.get(a.y) ?? []), a.k]);
  for (const h of c.hist) {
    star += seasonStar(star, h);
    for (const k of byYear.get(h.year) ?? []) star += awardStar(k, h.lg);
    star = clampStar(star);
  }
  return Math.round(star * 10) / 10;
}
