import { useSyncExternalStore } from "react";
import {
  canRetire,
  chooseOption,
  createCareer,
  generateCandidates,
  resolveQueue,
  retire,
  simulateSeason,
  type Candidate,
  type Career,
  type CareerPath,
  type CareerSummary,
  type FocusKey,
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

const SERVER_SNAPSHOT: GameSnapshot = { ready: false, career: null, draft: emptyDraft(), hall: [], simulating: false };

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
  snapshot = { ready: true, career, draft: freshDraft(), hall: loadHall(), simulating: false };
}

function set(patch: Partial<GameSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
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
  finishSimulation() {
    set({ simulating: false });
  },
  choose(index: number) {
    mutate((c) => {
      chooseOption(c, index);
    });
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
