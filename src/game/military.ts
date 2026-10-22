import { addAttr, addHealth } from "./condition";
import { ATTR_KEYS } from "./data";
import { addNews, decisionTag } from "./log";
import { chance, ri, rnd } from "./random";
import { ovr } from "./ratings";
import type { AttrKey, Career, Decision, DecisionOption, MilitaryKind, QueueItem, SeasonRecord } from "./types";
import { clamp, r1, ro, sigmoid } from "./util";

/*
 * 대한민국 선수의 병역. 만 28세까지 입대를 미룰 수 있고, 상무(국군체육부대)나 현역으로 18개월을 복무해요.
 * 게임에서는 복무 시즌 하나를 통째로 빠지고, 전역한 다음 시즌은 중반부터 합류해요.
 * 아시안게임 금메달이나 올림픽 메달을 따면 예술체육요원으로 편입돼 병역 특례를 받아요.
 */

/** 입대를 더는 미룰 수 없는 나이 */
export const ENLIST_DEADLINE = 28;
/** 처음 입대 시기를 묻는 나이 */
const FIRST_ASK = 23;

export const SANGMU = { name: "상무 (국군체육부대)", color: "#4B5A2A" };
export const ARMY = { name: "육군 (현역 복무)", color: "#5B6148" };

/** 복무하는 부대 (이름, 유니폼 색) */
export const militaryUnit = (kind: MilitaryKind | undefined): { name: string; color: string } => (kind === "sangmu" ? SANGMU : ARMY);

export const owesService = (c: Career): boolean => c.p.nat === "대한민국" && c.mil.s === "none";

/** 상무 최종 합격 확률. KBL 주전급이면 대부분 붙고, 경기를 못 뛴 선수는 어려워요. */
export function sangmuChance(c: Career): number {
  const played = c.hist.length ? c.hist[c.hist.length - 1].gp > 0 : false;
  return clamp(sigmoid((ovr(c.p) - 63) / 3) * (played ? 1 : 0.5), 0.05, 0.95);
}

const chanceLabel = (p: number) => (p >= 0.75 ? "합격 가능성 높음" : p >= 0.4 ? "합격 가능성 보통" : "합격 가능성 낮음");

/** 입대 시기 결정. 물어볼 때가 아니면 null이에요. (오프시즌이라 나이는 이미 한 살 늘어난 상태) */
export function militaryDecision(c: Career): Decision | null {
  if (!owesService(c) || !["pro", "free", "college"].includes(c.stage)) return null;
  if (c.age < (c.mil.ask ?? FIRST_ASK)) return null;
  const forced = c.age >= ENLIST_DEADLINE;
  const p = sangmuChance(c);
  const opts: DecisionOption[] = [
    {
      label: "상무 지원",
      sub: `국군체육부대에서 18개월 동안 뛰어요 · D리그와 대회에 나가 경기 감각을 지켜요 · ${chanceLabel(p)}`,
      tag: "상무",
      act: { k: "military", choice: "sangmu" },
    },
    {
      label: "현역 입대",
      sub: "18개월 동안 농구를 쉬어요 · 운동능력과 슛 감각이 떨어지지만 확실히 다녀와요",
      act: { k: "military", choice: "army" },
    },
  ];
  if (!forced)
    opts.push({
      label: "입대 연기",
      sub: `만 ${ENLIST_DEADLINE}세까지 미룰 수 있어요 · 그 사이 아시안게임 금메달이나 올림픽 메달을 따면 병역 특례를 받아요`,
      act: { k: "military", choice: "defer" },
    });
  return {
    title: forced ? "병역 · 입대 기한" : "병역 · 입대 시기",
    body: forced
      ? `만 ${c.age}세가 되어 더는 입대를 미룰 수 없어요. 상무에 떨어지면 현역으로 입대해요.`
      : `만 ${c.age}세, 병역 의무를 이행할 시기예요. 복무하는 동안 소속팀 계약은 멈추고, 전역하면 다시 돌아와요.`,
    opts,
  };
}

/** 복무 중 시즌이 이어지면 안 되는 결정(이적·계약·진로·생활 이벤트)은 입대와 함께 지워요. */
function enlist(c: Career, kind: MilitaryKind, tag: string): void {
  c.mil = { s: "serving", kind, prev: { stage: c.stage, team: c.team, contract: c.contract } };
  c.stage = "military";
  c.team = null;
  c.contract = null;
  c.trust = 0;
  c.queue = [];
  addNews(
    c,
    tag,
    "big",
    kind === "sangmu" ? "상무(국군체육부대)에 입대했어요. 18개월 동안 군인 선수로 뛰어요." : "현역으로 입대했어요. 18개월 동안 코트를 떠나요.",
  );
}

export function applyMilitary(c: Career, choice: MilitaryKind | "defer"): void {
  const tag = decisionTag(c);
  const forced = c.age >= ENLIST_DEADLINE;
  if (choice === "defer") {
    c.mil.ask = Math.min(ENLIST_DEADLINE, c.age + 2);
    addNews(c, tag, "info", `입대를 미뤘어요. 만 ${c.mil.ask}세에 다시 결정해요.`);
    return;
  }
  if (choice === "army") return enlist(c, "army", tag);
  if (chance(sangmuChance(c))) return enlist(c, "sangmu", tag);
  if (forced) {
    addNews(c, tag, "bad", "상무 최종 전형에서 떨어졌어요. 입대 기한이 되어 현역으로 입대해요.");
    return enlist(c, "army", tag);
  }
  c.mil.ask = c.age + 1;
  addNews(c, tag, "bad", "상무 최종 전형에서 떨어졌어요. 내년에 다시 결정해요.");
}

/** 복무 시즌. 상무는 D리그에서 뛰며 평소처럼 크고, 현역은 감각이 떨어져요. */
export function serviceSeason(
  c: Career,
  yr: number,
  ov0: number,
  tag: string,
): { rec: SeasonRecord; min: number; rating: number; grow: boolean } {
  const kind = c.mil.kind ?? "army";
  const base = {
    year: yr, age: c.age, lg: null, pro: false, stl: 0, blk: 0, ovr0: ov0, ovr1: ov0, awards: [] as string[], mil: kind,
  };
  if (kind === "sangmu") {
    // D리그와 각종 대회. 상무는 D리그 최강팀이에요.
    const gp = ri(18, 24);
    const lead = ov0 - 58;
    const v = (x: number) => r1(clamp(x * rnd(0.85, 1.15), 0, 40));
    const w = Math.round(gp * clamp(0.72 + rnd(-0.1, 0.12), 0.4, 0.95));
    const champ = chance(0.6);
    const rec: SeasonRecord = {
      ...base, team: SANGMU.name, role: lead >= 6 ? "에이스" : "주전", gp, min: r1(rnd(26, 32)),
      pts: v(10 + lead * 0.9), reb: v(3 + lead * 0.2), ast: v(2 + lead * 0.2), fg: r1(rnd(45, 54)),
      rating: r1(clamp(6.6 + lead / 6 + rnd(-0.4, 0.4), 5, 9.5)), w, l: gp - w,
      result: champ ? "KBL D리그 우승" : "KBL D리그 준우승",
    };
    addNews(c, tag, "info", `상무 소속으로 D리그 ${gp}경기를 뛰었어요 · ${rec.result}`);
    return { rec, min: rec.min, rating: rec.rating, grow: true };
  }
  // 현역: 농구를 거의 못 해요. 운동능력과 슛 감각이 많이 떨어지고, 경기 이해도는 그대로예요.
  const drop: Record<AttrKey, number> = { ath: 1.3, sht: 1.1, hdl: 0.9, pas: 0.6, def: 0.8, iq: 0.15 };
  const delta: Partial<Record<AttrKey, number>> = {};
  for (const k of ATTR_KEYS) delta[k] = addAttr(c.p.attrs, k, -drop[k] * rnd(1, 2.6));
  c.lastDelta = delta;
  addHealth(c, 12);
  const rec: SeasonRecord = {
    ...base, team: ARMY.name, role: "-", gp: 0, min: 0, pts: 0, reb: 0, ast: 0, fg: 0, rating: 0, w: 0, l: 0,
    result: "현역 복무",
  };
  addNews(c, tag, "info", "현역으로 복무하며 틈틈이 개인 운동을 했어요. 경기 감각이 많이 떨어졌어요.");
  return { rec, min: 0, rating: 5.5, grow: false };
}

/**
 * 전역. 입대 전 소속과 계약을 되돌리고, 이어서 고를 진로 결정을 돌려줘요.
 * 계약 기간은 복무하는 동안 멈춰 있었으니 줄이지 않아요.
 */
export function endService(c: Career, tag: string): QueueItem[] {
  const prev = c.mil.prev;
  const kind = c.mil.kind;
  c.mil = { s: "served", kind, back: true };
  c.stage = prev?.stage ?? "free";
  c.team = prev?.team ?? null;
  c.contract = prev?.contract ?? null;
  if (c.stage === "military" || c.stage === "hs") c.stage = "free";
  addNews(c, tag, "big", `${kind === "sangmu" ? "상무" : "현역"} 복무를 마치고 전역했어요!${c.team ? ` ${ro(c.team.name)} 돌아가요.` : ""}`);
  if (c.stage === "college") return [{ lazy: "college" }];
  if (c.stage === "pro" && c.team && c.contract && c.contract.years > 0) return [];
  if (c.stage === "pro" && c.team) {
    c.contract = null;
    return [{ lazy: "fa" }];
  }
  c.stage = "free";
  c.team = null;
  return [{ lazy: "faFree" }];
}

/** 아시안게임 금메달 또는 올림픽 메달: 예술체육요원 편입으로 병역 특례를 받아요. */
export function grantExemption(c: Career, tag: string, event: string): void {
  if (!owesService(c)) return;
  c.mil = { s: "exempt" };
  c.queue = c.queue.filter((q) => !("title" in q && q.title.startsWith("병역")));
  addNews(
    c,
    tag,
    "big",
    `${event} 메달로 예술체육요원에 편입돼 병역 특례를 받았어요! 선수 생활을 이어가며 봉사활동 544시간을 채우면 복무를 마쳐요.`,
  );
}
