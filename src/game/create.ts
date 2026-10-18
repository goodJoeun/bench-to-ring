import { ARCHETYPES, ATTR_KEYS, HAIRS, POS, SKINS, START_YEAR, TEAMS, TRAIT_KEYS } from "./data";
import { addNews, makeTeam, pickTeam, setTeam } from "./log";
import { chance, pick, ri, rnd, shuffle, triangular } from "./random";
import { ovrOf } from "./ratings";
import type { Archetype, AttrKey, Attrs, Candidate, Career, Grade, NewCareerInput, PosKey } from "./types";
import { clamp, r1 } from "./util";

export const START_OVR = 45;
/** 시작 능력치 범위. 주특기도 55까지이고, 아주 드물게(SPIKE_CHANCE) 가장 강한 능력치 하나만 5 더 열려요. */
export const START_MIN = 22;
export const START_CAP = 55;
export const SPIKE_CAP = 60;
const SPIKE_CHANCE = 0.03;
const SPIKE = SPIKE_CAP - START_CAP;

/** 플레이 유형 배수로 정하는 시작 능력치 상한: 주특기 55, 강점 50, 보조 47, 나머지 45 */
export function startCap(arch: Archetype, k: AttrKey): number {
  const e = arch.e[k] ?? 1;
  return e >= 1.45 ? START_CAP : e >= 1.25 ? 50 : e >= 1.1 ? 47 : 45;
}

/** 플레이 유형에 어울리는 성인 키와 윙스팬(키 대비) 범위 */
export function bodyOf(pos: PosKey, arch: Archetype): { h: [number, number]; wsd: [number, number] } {
  return { h: arch.body?.h ?? POS[pos].h, wsd: arch.body?.wsd ?? [-2, 11] };
}

/**
 * 후보 선수 한 명. 포지션과 플레이 유형이 정한 능력치 모양을 그대로 키우거나 줄여 오버롤 45에 맞추고,
 * 유형마다 정해진 상한(주특기 55, 강점 50…)에서 막아요. 막힌 몫은 나머지 능력치가 모양대로 나눠 가져요.
 */
export function generateCandidate(pos: PosKey, archIndex: number): Candidate {
  const arch = ARCHETYPES[pos][archIndex];
  const w = POS[pos].w;
  const raw = {} as Attrs;
  // 플레이 유형 배수는 1.6제곱해서 써요. 포지션 가중치가 낮은 능력치를 키우는 유형(패싱 센터 등)도 강점이 드러나요.
  for (const k of ATTR_KEYS) raw[k] = (0.55 + w[k] * 2.4) * (arch.e[k] ?? 1) ** 1.6 * rnd(0.88, 1.12);
  const cap = {} as Attrs;
  for (const k of ATTR_KEYS) cap[k] = startCap(arch, k);
  if (chance(SPIKE_CHANCE)) cap[ATTR_KEYS.reduce((m, k) => (raw[k] > raw[m] ? k : m))] += SPIKE;

  // 상한·하한에 닿은 능력치는 그 자리에 묶고, 나머지를 같은 배율로 키워 오버롤 45를 맞춰요.
  const a = {} as Attrs;
  const fixed = new Map<AttrKey, number>();
  for (let guard = 0; guard < ATTR_KEYS.length + 1; guard++) {
    const free = ATTR_KEYS.filter((k) => !fixed.has(k));
    const need = START_OVR - [...fixed].reduce((t, [k, v]) => t + w[k] * v, 0);
    const scale = need / free.reduce((t, k) => t + w[k] * raw[k], 0);
    for (const k of free) a[k] = raw[k] * scale;
    for (const [k, v] of fixed) a[k] = v;
    const over = free.find((k) => a[k] > cap[k]) ?? free.find((k) => a[k] < START_MIN);
    if (!over) break;
    fixed.set(over, a[over] > cap[over] ? cap[over] : START_MIN);
  }
  for (const k of ATTR_KEYS) a[k] = clamp(Math.round(a[k]), START_MIN, cap[k]);
  // 반올림으로 생긴 차이는 모양이 큰 능력치부터 1씩 고쳐요.
  const byShape = [...ATTR_KEYS].sort((x, y) => raw[y] - raw[x]);
  for (let i = 0; i < 60; i++) {
    const o = Math.round(ovrOf(a, pos));
    if (o === START_OVR) break;
    const k = o < START_OVR ? byShape.find((x) => a[x] < cap[x]) : [...byShape].reverse().find((x) => a[x] > START_MIN);
    if (!k) break;
    a[k] += o < START_OVR ? 1 : -1;
  }
  const body = bodyOf(pos, arch);
  const hFinal = ri(...body.h);
  const pot = Math.round(triangular(58, 98, 73));
  const shown = pot + ri(-5, 5);
  const grade: Grade = shown >= 90 ? "S" : shown >= 83 ? "A" : shown >= 76 ? "B" : shown >= 70 ? "C" : "D";
  return {
    arch: arch.name,
    attrs: a,
    // 16세에는 성인 키까지 2~6cm 남아 있어요.
    h: hFinal - ri(2, 6),
    hFinal,
    wsd: ri(...body.wsd),
    pot,
    grade,
    trait: pick(TRAIT_KEYS),
    skin: pick(SKINS),
    hair: pick(HAIRS),
  };
}

const CANDIDATE_COUNT = 3;

/** 후보 세 명을 뽑아요. 플레이 유형은 포지션의 유형 중에서 서로 겹치지 않게 무작위로 정해져요. */
export function generateCandidates(pos: PosKey): Candidate[] {
  const archs = shuffle(ARCHETYPES[pos].map((_, i) => i)).slice(0, CANDIDATE_COUNT);
  return archs.map((i) => generateCandidate(pos, i));
}

/** 후보에 저장된 유형 이름으로 플레이 유형 정보를 찾아요. */
export function archetypeOf(pos: PosKey, name: string): Archetype | undefined {
  return ARCHETYPES[pos].find((a) => a.name === name);
}

export function createCareer(input: NewCareerInput, cand: Candidate, id = String(Date.now())): Career {
  const c: Career = {
    v: 2,
    id,
    p: {
      ...cand,
      attrs: { ...cand.attrs },
      name: input.name.trim().slice(0, 12) || "무명의 루키",
      num: clamp(Math.round(input.num) || 0, 0, 99),
      nat: input.nat,
      pos: input.pos,
      path: input.path,
      traitKnown: false,
    },
    age: 16,
    year: START_YEAR,
    health: 100,
    trust: -1.5,
    focus: "bal",
    team: null,
    contract: null,
    stage: "hs",
    schoolYear: 1,
    collegeYears: 0,
    proSeasons: 0,
    hist: [],
    awards: {},
    awardLog: [],
    nat: { caps: 0 },
    earnings: 0,
    peakOvr: START_OVR,
    queue: [],
    news: [],
    last: null,
    lastDelta: {},
    potOff: r1(rnd(-4, 4)),
    posAsked: {},
    draft: null,
    summary: null,
    events: {},
    perks: {},
    mil: { s: "none" },
    natLog: [],
    live: null,
    draftShow: null,
    invest: [],
    spent: 0,
  };
  const chosen = TEAMS.hs.find(([name]) => name === input.school);
  const t = chosen ? makeTeam(chosen) : pickTeam("hs");
  setTeam(c, "hs", t);
  addNews(c, `${START_YEAR} 프리시즌`, "move", `${t.name} 농구부에 입단했어요. 벤치에서 시작해요.`);
  return c;
}
