import { ARCHETYPES, ATTR_KEYS, HAIRS, POS, SKINS, START_YEAR, TRAIT_KEYS } from "./data";
import { addNews, pickTeam, setTeam } from "./log";
import { pick, ri, rnd, shuffle, triangular } from "./random";
import { ovrOf } from "./ratings";
import type { Archetype, AttrKey, Attrs, Candidate, Career, Grade, NewCareerInput, PosKey } from "./types";
import { clamp, r1 } from "./util";

export const START_OVR = 45;
export const START_TOTAL = 240;

/** 후보 선수 한 명. 능력치 합 240, 오버롤 45에 맞춰요. */
export function generateCandidate(pos: PosKey, archIndex: number): Candidate {
  const arch = ARCHETYPES[pos][archIndex];
  const w = POS[pos].w;
  const raw = {} as Attrs;
  let sum = 0;
  for (const k of ATTR_KEYS) {
    raw[k] = (0.55 + w[k] * 2.4) * (arch.e[k] ?? 1) * rnd(0.88, 1.12);
    sum += raw[k];
  }
  const a = {} as Attrs;
  let total = 0;
  for (const k of ATTR_KEYS) {
    a[k] = clamp(Math.round((raw[k] / sum) * START_TOTAL), 22, 70);
    total += a[k];
  }
  let diff = START_TOTAL - total;
  for (let guard = 0; diff !== 0 && guard < 600; guard++) {
    const k = pick(ATTR_KEYS);
    if (diff > 0 && a[k] < 70) {
      a[k]++;
      diff--;
    } else if (diff < 0 && a[k] > 22) {
      a[k]--;
      diff++;
    }
  }
  // 합계는 그대로 두고, 가중치가 다른 두 능력치 사이에서 1씩 옮겨 오버롤을 45로 맞춰요.
  for (let i = 0; i < 500; i++) {
    const o = Math.round(ovrOf(a, pos));
    if (o === START_OVR) break;
    const up = o < START_OVR;
    const moves: [AttrKey, AttrKey][] = [];
    for (const from of ATTR_KEYS)
      for (const to of ATTR_KEYS)
        if (a[from] > 22 && a[to] < 76 && (up ? w[to] > w[from] : w[to] < w[from])) moves.push([from, to]);
    if (!moves.length) break;
    const [from, to] = pick(moves);
    a[from]--;
    a[to]++;
  }
  const [h0, h1] = POS[pos].h;
  const hFinal = ri(h0, h1);
  const pot = Math.round(triangular(58, 98, 73));
  const shown = pot + ri(-5, 5);
  const grade: Grade = shown >= 90 ? "S" : shown >= 83 ? "A" : shown >= 76 ? "B" : shown >= 70 ? "C" : "D";
  return {
    arch: arch.name,
    attrs: a,
    h: hFinal - ri(3, 9),
    hFinal,
    wsd: ri(-2, 11),
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
  };
  const t = pickTeam("hs");
  setTeam(c, "hs", t);
  addNews(c, `${START_YEAR} 프리시즌`, "move", `${t.name} 농구부에 입단했어요. 벤치에서 시작해요.`);
  return c;
}
