import { useSyncExternalStore } from "react";
import {
  INVEST_SLOTS,
  canRetire,
  chooseOption,
  createCareer,
  currentDecision,
  generateCandidates,
  resolveQueue,
  retire,
  startSeason,
  stepSeason,
  type Candidate,
  type Career,
  type CareerPath,
  type CareerSummary,
  type FocusKey,
  type InvestKey,
  type NewsItem,
  type PosKey,
  type SeasonStep,
} from "@/game";
import { decodeSave, loadCareer, loadHall, saveCareer, saveHall } from "@/game/storage";

/** 선수 생성 화면의 입력값 */
export interface CreationDraft {
  name: string;
  num: string;
  nat: string;
  pos: PosKey;
  path: CareerPath;
  /** 고등학교 이름. 빈 문자열이면 무작위 */
  school: string;
  candidates: Candidate[];
  selected: number;
  rerolls: number;
}

export interface GameSnapshot {
  /** 브라우저 저장소를 읽었는지. 서버 렌더링에서는 false예요. */
  ready: boolean;
  career: Career | null;
  draft: CreationDraft;
  hall: CareerSummary[];
  /** 시즌이 저절로 흘러가는 중인지. 꺼져 있으면 일시정지예요. 불러온 시즌은 멈춘 채로 시작해요. */
  playing: boolean;
  /** 시즌 진행 배속 */
  speed: Speed;
  /** 결승전 중계를 보여주는 중인지 (c.live) */
  final: boolean;
  /** 국가대표 대회 진행 화면을 보여주는 중인지 (c.natLog의 마지막 대회) */
  tournament: boolean;
  /** 드래프트 진행 화면을 보여주는 중인지 (c.draftShow) */
  drafting: boolean;
  /** 화면 아래에 잠깐 떴다 사라지는 알림 */
  toast: Toast | null;
}

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

export interface Toast {
  id: number;
  msg: string;
}

const REROLLS = 3;

const emptyDraft = (): CreationDraft => ({
  name: "",
  num: "",
  nat: "대한민국",
  pos: "SG",
  path: "abroad",
  school: "",
  candidates: [],
  selected: 0,
  rerolls: REROLLS,
});

const SERVER_SNAPSHOT: GameSnapshot = { ready: false, career: null, draft: emptyDraft(), hall: [], playing: false, speed: 1, final: false, tournament: false, drafting: false, toast: null };

let snapshot: GameSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function freshDraft(prev?: CreationDraft): CreationDraft {
  const base = prev ?? emptyDraft();
  return {
    ...base,
    num: base.num || String(Math.floor(Math.random() * 100)),
    candidates: generateCandidates(base.pos),
    selected: 0,
    rerolls: REROLLS,
  };
}

function ensureLoaded(): void {
  if (snapshot.ready || typeof window === "undefined") return;
  const career = loadCareer();
  if (career) resolveQueue(career);
  snapshot = { ...SERVER_SNAPSHOT, ready: true, career, draft: freshDraft(), hall: loadHall() };
}

function set(patch: Partial<GameSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

let toastId = 0;
const toast = (msg: string): Toast => ({ id: ++toastId, msg });

/** 진행 화면을 닫으며 결과를 알림으로 띄워요. 알릴 말이 없으면 지금 알림을 그대로 둬요. */
function closeWithToast(patch: Partial<GameSnapshot>, msg: string | null | undefined): void {
  set({ ...patch, toast: msg ? toast(msg) : snapshot.toast });
}

/** before 이후에 새로 쌓인 소식 중 가장 최근 것 */
function latestNewsSince(before: NewsItem | undefined, c: Career): string | null {
  const first = c.news[0];
  if (!first) return null;
  if (before && first.w === before.w && first.t === before.t && first.m === before.m) return null;
  return first.m;
}

/**
 * 시즌을 한 칸 진행한 뒤: 결승에 오르면 중계를 띄우고, 시즌이 끝나면 멈추고 결과를 알려요.
 * 그 밖에는 이번 칸에서 새로 생긴 소식(부상, 플레이오프 진출…)을 알려요.
 */
function afterStep(res: SeasonStep | null, before: NewsItem | undefined): void {
  const c = snapshot.career;
  if (!c || !res) return;
  if (res === "final") return set({ final: true, toast: null });
  if (res === "done") {
    const r = c.last;
    return closeWithToast({ playing: false }, r && `${r.year} 시즌 종료 · ${r.lg ? `${r.w}승 ${r.l}패 · ` : ""}${r.result}`);
  }
  const msg = latestNewsSince(before, c);
  if (msg) set({ toast: toast(msg) });
}

/** 커리어 복사본에 엔진 함수를 적용하고 저장해요. 은퇴하면 명예의 전당에도 올려요. */
function mutate(fn: (c: Career) => void): void {
  if (!snapshot.career) return;
  const c = structuredClone(snapshot.career);
  fn(c);
  resolveQueue(c);
  let hall = snapshot.hall;
  const s = c.summary;
  if (c.stage === "retired" && s && s.seasons > 0 && !hall.some((h) => h.id === s.id)) {
    hall = [...hall, s];
    saveHall(hall);
  }
  saveCareer(c);
  set({ career: c, hall });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): GameSnapshot {
  ensureLoaded();
  return snapshot;
}

export function useGame(): GameSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}

export const gameActions = {
  editDraft(patch: Partial<Pick<CreationDraft, "name" | "num" | "nat" | "path" | "school" | "selected">>) {
    set({ draft: { ...snapshot.draft, ...patch } });
  },
  choosePosition(pos: PosKey) {
    set({ draft: { ...snapshot.draft, pos, candidates: generateCandidates(pos), selected: 0 } });
  },
  reroll() {
    const d = snapshot.draft;
    if (d.rerolls <= 0) return;
    set({ draft: { ...d, candidates: generateCandidates(d.pos), selected: 0, rerolls: d.rerolls - 1 } });
  },
  startCareer() {
    const d = snapshot.draft;
    const cand = d.candidates[d.selected];
    if (!cand) return;
    const c = createCareer({ name: d.name, num: Number(d.num), nat: d.nat, pos: d.pos, path: d.path, school: d.school || undefined }, cand);
    saveCareer(c);
    set({ career: c });
  },
  setFocus(focus: FocusKey) {
    mutate((c) => {
      c.focus = focus;
    });
  },
  /** 시즌 투자를 고르거나 빼요. 고른 순서대로 두 가지까지 남아요. */
  toggleInvest(key: InvestKey) {
    mutate((c) => {
      c.invest = c.invest.includes(key) ? c.invest.filter((k) => k !== key) : [...c.invest, key].slice(0, INVEST_SLOTS);
    });
  },
  /** 시즌을 시작하고 바로 흘려 보내요. */
  startSeason() {
    if (!snapshot.career || snapshot.career.queue.length || snapshot.career.run) return;
    mutate(startSeason);
    set({ playing: true });
  },
  /** 시즌을 한 칸(경기·라운드·일정) 진행해요. 시계가 부르고, 결정이 남았으면 아무것도 하지 않아요. */
  step() {
    const c0 = snapshot.career;
    if (!c0?.run || c0.queue.length) return;
    const before = c0.news[0];
    let res: SeasonStep | null = null;
    mutate((c) => {
      res = stepSeason(c);
    });
    afterStep(res, before);
  },
  /** 결정이나 결승전이 나오기 전까지, 없으면 시즌 끝까지 한 번에 진행해요. */
  skip() {
    const c0 = snapshot.career;
    if (!c0?.run || c0.queue.length) return;
    const before = c0.news[0];
    let res: SeasonStep | null = null;
    mutate((c) => {
      do res = stepSeason(c);
      while (res === "step" && !c.queue.length);
    });
    afterStep(res, before);
  },
  setPlaying(playing: boolean) {
    set({ playing });
  },
  /** 1배속 → 2배속 → 4배속 → 1배속 */
  cycleSpeed() {
    set({ speed: SPEEDS[(SPEEDS.indexOf(snapshot.speed) + 1) % SPEEDS.length] });
  },
  /** 결승전 중계를 닫고 시즌을 이어 가요. */
  finishFinal() {
    const f = snapshot.career?.run?.final;
    closeWithToast({ final: false }, f && `${f.win ? "우승!" : "준우승"} · ${f.series ? `시리즈 ${f.series}` : `${f.us}-${f.them}`}`);
  },
  /**
   * 결정을 고르고, 그 결과로 생긴 소식을 알림으로 띄워요.
   * 국가대표에 합류하면 대회 진행 화면을, 드래프트에 나가면 드래프트 진행 화면을 먼저 보여줘요.
   */
  choose(index: number) {
    const c0 = snapshot.career;
    if (!c0) return;
    const opt = currentDecision(c0)?.opts[index];
    const before = c0.news[0];
    mutate((c) => {
      chooseOption(c, index);
    });
    if (opt?.act.k === "draft") return set({ drafting: true });
    if (opt?.act.k === "national" && opt.act.join) return set({ tournament: true });
    const after = snapshot.career;
    const msg = (after && latestNewsSince(before, after)) ?? (opt?.label ? `'${opt.label}'을(를) 골랐어요` : null);
    if (msg) set({ toast: toast(msg) });
  },
  /** 대회 진행 화면을 닫고 최종 성적을 알림으로 보여줘요. */
  finishTournament() {
    const t = snapshot.career?.natLog.at(-1);
    closeWithToast({ tournament: false }, t && `${t.name} · ${t.label}`);
  },
  /** 드래프트 진행 화면을 닫고 지명 결과를 알림으로 보여줘요. */
  finishDraft() {
    closeWithToast({ drafting: false }, snapshot.career?.news[0]?.m);
  },
  dismissToast(id: number) {
    if (snapshot.toast?.id === id) set({ toast: null });
  },
  retire() {
    mutate((c) => {
      if (canRetire(c)) retire(c);
    });
  },
  newCareer() {
    saveCareer(null);
    set({ career: null, draft: freshDraft(snapshot.draft), playing: false, final: false });
  },
  /** 성공하면 true */
  importSave(code: string): boolean {
    const c = decodeSave(code);
    if (!c) return false;
    resolveQueue(c);
    saveCareer(c);
    set({ career: c, playing: false, final: false });
    return true;
  },
};
