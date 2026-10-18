import { useSyncExternalStore } from "react";
import {
  canRetire,
  chooseOption,
  createCareer,
  currentDecision,
  generateCandidates,
  resolveQueue,
  retire,
  simulateSeason,
  type Candidate,
  type Career,
  type CareerPath,
  type CareerSummary,
  type FocusKey,
  type NewsItem,
  type PosKey,
} from "@/game";
import { decodeSave, loadCareer, loadHall, saveCareer, saveHall } from "@/game/storage";

/** 선수 생성 화면의 입력값 */
export interface CreationDraft {
  name: string;
  num: string;
  nat: string;
  pos: PosKey;
  path: CareerPath;
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
  /** 시즌 진행 로딩 화면을 보여주는 중인지. 결과는 이미 계산·저장돼 있어요. */
  simulating: boolean;
  /** 국가대표 대회 진행 화면을 보여주는 중인지 (c.natLog의 마지막 대회) */
  tournament: boolean;
  /** 화면 아래에 잠깐 떴다 사라지는 알림 */
  toast: Toast | null;
}

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
  candidates: [],
  selected: 0,
  rerolls: REROLLS,
});

const SERVER_SNAPSHOT: GameSnapshot = { ready: false, career: null, draft: emptyDraft(), hall: [], simulating: false, tournament: false, toast: null };

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
  snapshot = { ready: true, career, draft: freshDraft(), hall: loadHall(), simulating: false, tournament: false, toast: null };
}

function set(patch: Partial<GameSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

let toastId = 0;
const toast = (msg: string): Toast => ({ id: ++toastId, msg });

/** before 이후에 새로 쌓인 소식 중 가장 최근 것 */
function latestNewsSince(before: NewsItem | undefined, c: Career): string | null {
  const first = c.news[0];
  if (!first) return null;
  if (before && first.w === before.w && first.t === before.t && first.m === before.m) return null;
  return first.m;
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
  editDraft(patch: Partial<Pick<CreationDraft, "name" | "num" | "nat" | "path" | "selected">>) {
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
    const c = createCareer({ name: d.name, num: Number(d.num), nat: d.nat, pos: d.pos, path: d.path }, cand);
    saveCareer(c);
    set({ career: c });
  },
  setFocus(focus: FocusKey) {
    mutate((c) => {
      c.focus = focus;
    });
  },
  advanceSeason() {
    if (!snapshot.career || snapshot.career.queue.length) return;
    mutate(simulateSeason);
    set({ simulating: true });
  },
  /** 로딩 화면을 닫고 시즌 결과를 알림으로 보여줘요. */
  finishSimulation() {
    const r = snapshot.career?.last;
    const msg = r ? `${r.year} 시즌 종료 · ${r.lg ? `${r.w}승 ${r.l}패 · ` : ""}${r.result}` : null;
    set({ simulating: false, toast: msg ? toast(msg) : snapshot.toast });
  },
  /** 결정을 고르고, 그 결과로 생긴 소식을 알림으로 띄워요. 국가대표에 합류하면 대회 진행 화면을 먼저 보여줘요. */
  choose(index: number) {
    const c0 = snapshot.career;
    if (!c0) return;
    const opt = currentDecision(c0)?.opts[index];
    const label = opt?.label;
    if (opt?.act.k === "national" && opt.act.join) {
      mutate((c) => {
        chooseOption(c, index);
      });
      set({ tournament: true });
      return;
    }
    const before = c0.news[0];
    mutate((c) => {
      chooseOption(c, index);
    });
    const after = snapshot.career;
    const msg = (after && latestNewsSince(before, after)) ?? (label ? `'${label}'을(를) 골랐어요` : null);
    if (msg) set({ toast: toast(msg) });
  },
  /** 대회 진행 화면을 닫고 최종 성적을 알림으로 보여줘요. */
  finishTournament() {
    const t = snapshot.career?.natLog.at(-1);
    set({ tournament: false, toast: t ? toast(`${t.name} · ${t.label}`) : snapshot.toast });
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
    set({ career: null, draft: freshDraft(snapshot.draft) });
  },
  /** 성공하면 true */
  importSave(code: string): boolean {
    const c = decodeSave(code);
    if (!c) return false;
    resolveQueue(c);
    saveCareer(c);
    set({ career: c });
    return true;
  },
};
