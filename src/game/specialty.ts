import { SHORT } from "./data";
import type { AttrKey, Attrs } from "./types";

/*
 * 특화: 여러 능력치가 고르게 적당한 선수보다, 두 능력치가 함께 두드러진 선수를 더 높게 평가해요.
 * BQ를 뺀 다섯 능력치(슛·볼 핸들링·패스·수비·운동능력)의 두 개짜리 조합 10가지가 특화이고,
 * BQ는 혼자 유난히 높아도 '스마트 플레이어'가 돼요.
 *
 * 기준
 * - 두 능력치가 모두 PAIR_FLOOR 이상이고, 둘 다 나머지 세 능력치(BQ 제외) 평균보다 PAIR_GAP 이상 높아야 해요.
 *   여러 조합이 걸리면 나머지와의 차이가 가장 큰 조합 하나만 인정해요.
 * - 스마트 플레이어: BQ가 SMART_FLOOR 이상이고 나머지 다섯 능력치 평균보다 SMART_GAP 이상 높아야 해요.
 *
 * 보너스는 '평가 오버롤'에 더해져 출전 시간·계약 제안·드래프트·연봉·시상에 쓰여요. 화면의 오버롤은 그대로예요.
 * 두 능력치 중 낮은 쪽이 높을수록(70·80·90) 보너스가 +1·+2·+3이고, 스마트 플레이어는 +1(92 이상 +2), 합계는 BONUS_CAP까지예요.
 * BQ는 24세 이후에도 조금씩 크고 나이 들어 가장 덜 떨어져서, 베테랑이 저절로 스마트 플레이어가 되지 않게 기준을 높게 잡았어요.
 */

export const PAIR_FLOOR = 70;
export const PAIR_GAP = 8;
export const SMART_FLOOR = 82;
export const SMART_GAP = 12;
export const BONUS_CAP = 4;

export type SpecialtyKey =
  | "twoway"
  | "scorer"
  | "stopper"
  | "handler"
  | "shootmaker"
  | "dynamic"
  | "slasher"
  | "onball"
  | "glue"
  | "engine"
  | "smart";

/** 특화가 경기 기록에 주는 작은 효과. 배수는 그 시즌 경기당 기록에, fg는 야투율(%p)에, rating은 평점에, team은 팀 승수 기여에 곱해요. */
export interface SpecialtyEffect {
  pts?: number;
  reb?: number;
  ast?: number;
  stl?: number;
  blk?: number;
  fg?: number;
  rating?: number;
  team?: number;
  /** 올해의 수비수 후보 기준을 이만큼 낮춰요 (리그 평균 대비 수비) */
  dpoy?: number;
}

export interface Specialty {
  key: SpecialtyKey;
  name: string;
  /** 필요한 능력치 (스마트 플레이어는 BQ 하나) */
  attrs: AttrKey[];
  /** 한 줄 설명 */
  desc: string;
  effect: SpecialtyEffect;
}

const pair = (key: SpecialtyKey, name: string, a: AttrKey, b: AttrKey, desc: string, effect: SpecialtyEffect): Specialty => ({
  key,
  name,
  attrs: [a, b],
  desc,
  effect,
});

export const SPECIALTIES: ReadonlyArray<Specialty> = [
  pair("twoway", "투웨이 플레이어", "sht", "def", "공격과 수비 양쪽에서 믿고 쓰는 선수", { pts: 1.05, stl: 1.1, team: 1.15 }),
  pair("scorer", "스코어러", "hdl", "sht", "스스로 슛 기회를 만들어 넣는 득점원", { pts: 1.1 }),
  pair("stopper", "에이스 스토퍼", "def", "ath", "상대 에이스를 지우는 전담 수비수", { stl: 1.15, blk: 1.1, dpoy: 3 }),
  pair("handler", "메인 핸들러", "pas", "hdl", "공을 쥐고 공격 전체를 운영하는 사령관", { ast: 1.15 }),
  pair("shootmaker", "슈팅 플레이메이커", "sht", "pas", "슛을 견제하는 수비를 패스로 무너뜨리는 가드", { pts: 1.05, ast: 1.08, fg: 1 }),
  pair("dynamic", "다이내믹 스코어러", "sht", "ath", "운동능력과 슛을 겸비해 어디서든 득점하는 선수", { pts: 1.08, reb: 1.05 }),
  pair("slasher", "슬래셔", "hdl", "ath", "드리블 돌파로 림을 공략하는 돌격대장", { pts: 1.05, fg: 1.5 }),
  pair("onball", "온볼 디펜더", "hdl", "def", "볼 핸들러를 끝까지 따라붙는 압박 수비수", { stl: 1.2 }),
  pair("glue", "글루 가이", "pas", "def", "기록 밖에서 팀을 하나로 묶는 연결고리", { ast: 1.05, stl: 1.05, team: 1.25 }),
  pair("engine", "트랜지션 엔진", "pas", "ath", "속공을 이끄는 달리는 플레이메이커", { ast: 1.08, pts: 1.05 }),
  { key: "smart", name: "스마트 플레이어", attrs: ["iq"], desc: "경기를 읽는 눈으로 한 박자 빠르게 움직이는 선수", effect: { rating: 0.3, ast: 1.03 } },
];

const NON_IQ: AttrKey[] = ["sht", "hdl", "pas", "def", "ath"];
const mean = (a: Attrs, keys: AttrKey[]) => keys.reduce((t, k) => t + a[k], 0) / keys.length;

export interface SpecialtyHit {
  spec: Specialty;
  /** 평가 오버롤 보너스 */
  bonus: number;
}

/** 지금 능력치로 인정되는 특화: 두 능력치 조합 하나(있으면)와 스마트 플레이어(있으면) */
export function specialtiesOf(a: Attrs): SpecialtyHit[] {
  const hits: SpecialtyHit[] = [];
  let best: { spec: Specialty; margin: number; low: number } | null = null;
  for (const spec of SPECIALTIES) {
    if (spec.attrs.length !== 2) continue;
    const [x, y] = spec.attrs;
    const low = Math.min(a[x], a[y]);
    const margin = low - mean(a, NON_IQ.filter((k) => k !== x && k !== y));
    if (low >= PAIR_FLOOR && margin >= PAIR_GAP && (!best || margin > best.margin)) best = { spec, margin, low };
  }
  if (best) hits.push({ spec: best.spec, bonus: best.low >= PAIR_FLOOR + 20 ? 3 : best.low >= PAIR_FLOOR + 10 ? 2 : 1 });
  const smart = SPECIALTIES.find((s) => s.key === "smart")!;
  if (a.iq >= SMART_FLOOR && a.iq - mean(a, NON_IQ) >= SMART_GAP) hits.push({ spec: smart, bonus: a.iq >= SMART_FLOOR + 10 ? 2 : 1 });
  return hits;
}

/** 평가 오버롤에 더하는 특화 보너스 합계 */
export const specialtyBonus = (a: Attrs): number => Math.min(BONUS_CAP, specialtiesOf(a).reduce((t, h) => t + h.bonus, 0));

/** 특화 조건을 사람이 읽는 말로: "슛·수비 65 이상, 나머지보다 8 높게" */
export function specialtyRule(spec: Specialty): string {
  if (spec.attrs.length === 1) return `${SHORT.iq} ${SMART_FLOOR} 이상, 나머지 평균보다 ${SMART_GAP} 높게`;
  return `${spec.attrs.map((k) => SHORT[k]).join("·")} ${PAIR_FLOOR} 이상, 나머지 평균보다 ${PAIR_GAP} 높게`;
}

/** 여러 특화의 기록 효과를 하나로 합쳐요. */
export function combinedEffect(hits: SpecialtyHit[]): Required<SpecialtyEffect> {
  const e: Required<SpecialtyEffect> = { pts: 1, reb: 1, ast: 1, stl: 1, blk: 1, fg: 0, rating: 0, team: 1, dpoy: 0 };
  for (const { spec } of hits) {
    const f = spec.effect;
    for (const k of ["pts", "reb", "ast", "stl", "blk", "team"] as const) e[k] *= f[k] ?? 1;
    e.fg += f.fg ?? 0;
    e.rating += f.rating ?? 0;
    e.dpoy += f.dpoy ?? 0;
  }
  return e;
}
