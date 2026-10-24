import { useSyncExternalStore } from "react";
import {
  INVEST_SLOTS,
  buy,
  canRetire,
  chooseOption,
  createCareer,
  currentDecision,
  donate,
  generateCandidates,
  requestTransfer,
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
  type ShopKey,
} from "@/game";
import { loadCareer, loadHall, saveCareer, saveHall } from "@/game/storage";
import { flushPending, submitCareer } from "@/lib/leaderboard/client";

/** 선수 생성 화면의 입력값 */
export interface CreationDraft {
  name: string;
  num: string;
  pos: PosKey;
  path: CareerPath;
  /** 고등학교 이름. 빈 문자열이면 무작위 */
  school: string;
  candidates: Candidate[];
  /** 포지션마다 마지막으로 뽑은 후보. 포지션을 오가도 다시 뽑히지 않아요. */
  pool: Partial<Record<PosKey, Candidate[]>>;
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
  /** 방금 은퇴해서 엔딩 전에 커리어 회고를 보여주는 중인지 */
  farewell: boolean;
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

const REROLLS = 5;

const emptyDraft = (): CreationDraft => ({
  name: "",
  num: "",
  pos: "SG",
  // 커리어 경로는 국내 경로(고교 → U-리그·KBL)로 고정이에요. 해외 진출은 실력이 되면 제안으로 와요.
  path: "domestic",
  school: "",
  candidates: [],
  pool: {},
  selected: 0,
  rerolls: REROLLS,
});

const SERVER_SNAPSHOT: GameSnapshot = { ready: false, career: null, draft: emptyDraft(), hall: [], playing: false, speed: 1, final: false, farewell: false, tournament: false, drafting: false, toast: null };

let snapshot: GameSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function freshDraft(prev?: CreationDraft): CreationDraft {
  const base = prev ?? emptyDraft();
  const candidates = generateCandidates(base.pos);
  return {
    ...base,
    num: base.num || String(Math.floor(Math.random() * 100)),
    candidates,
    pool: { [base.pos]: candidates },
    selected: 0,
    rerolls: REROLLS,
  };
}

function ensureLoaded(): void {
  if (snapshot.ready || typeof window === "undefined") return;
  const career = loadCareer();
  if (career) resolveQueue(career);
  snapshot = { ...SERVER_SNAPSHOT, ready: true, career, draft: freshDraft(), hall: loadHall() };
  // 지난번에 보내지 못한 은퇴 기록을 온라인 랭킹에 다시 보내요.
  void flushPending();
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
    // 개인 수상이 있으면 첫 상과 나머지 개수를 덧붙여요. 전체 목록은 시즌 결과 카드에 있어요.
    const awards = r?.awards.length ? ` · ${r.awards[0]}${r.awards.length > 1 ? ` 외 ${r.awards.length - 1}개` : ""}` : "";
    return closeWithToast({ playing: false }, r && `${r.year} 시즌 종료 · ${r.lg ? `${r.w}승 ${r.l}패 · ` : ""}${r.result}${awards}`);
  }
  const msg = latestNewsSince(before, c);
  if (msg) set({ toast: toast(msg) });
}

/** 은퇴 기록을 온라인 랭킹에 올리고, 올라가면 순위를 알려요. 실패하면 조용히 넘어가요. */
function submitOnline(s: CareerSummary): void {
  void submitCareer(s).then((r) => {
    if (r) set({ toast: toast(`온라인 랭킹 전체 ${r.rank}위 · ${r.pos} ${r.posRank}위 (${r.total}명 중)`) });
  });
}

/** 커리어 복사본에 엔진 함수를 적용하고 저장해요. 은퇴하면 명예의 전당과 온라인 랭킹에도 올려요. */
function mutate(fn: (c: Career) => void): void {
  if (!snapshot.career) return;
  const wasRetired = snapshot.career.stage === "retired";
  const c = structuredClone(snapshot.career);
  fn(c);
  resolveQueue(c);
  // 이번 변화로 은퇴했으면 엔딩 전에 회고부터 보여줘요.
  const farewell = !wasRetired && c.stage === "retired";
  let hall = snapshot.hall;
  const s = c.summary;
  if (c.stage === "retired" && s && s.seasons > 0 && !hall.some((h) => h.id === s.id)) {
    hall = [...hall, s];
    saveHall(hall);
    submitOnline(s);
  }
  saveCareer(c);
  set(farewell ? { career: c, hall, farewell, playing: false, toast: null } : { career: c, hall });
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
  editDraft(patch: Partial<Pick<CreationDraft, "name" | "num" | "school" | "selected">>) {
    set({ draft: { ...snapshot.draft, ...patch } });
  },
  /** 포지션을 바꿔요. 처음 고르는 포지션만 새로 뽑고, 이미 본 포지션은 그때 후보를 그대로 보여줘요. */
  choosePosition(pos: PosKey) {
    const d = snapshot.draft;
    if (pos === d.pos) return;
    const candidates = d.pool[pos] ?? generateCandidates(pos);
    set({ draft: { ...d, pos, candidates, pool: { ...d.pool, [pos]: candidates }, selected: 0 } });
  },
  reroll() {
    const d = snapshot.draft;
    if (d.rerolls <= 0) return;
    const candidates = generateCandidates(d.pos);
    set({ draft: { ...d, candidates, pool: { ...d.pool, [d.pos]: candidates }, selected: 0, rerolls: d.rerolls - 1 } });
  },
  startCareer() {
    const d = snapshot.draft;
    const cand = d.candidates[d.selected];
    // 이름은 반드시 지어야 해요. 화면에서 먼저 안내해요.
    if (!cand || !d.name.trim()) return;
    const c = createCareer({ name: d.name, num: Number(d.num), pos: d.pos, path: d.path, school: d.school || undefined }, cand);
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
  /** 커리어 회고를 닫고 엔딩(은퇴 화면)으로 가요. */
  finishFarewell() {
    set({ farewell: false });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  },
  /** 대회 진행 화면을 닫고 최종 성적을 알림으로 보여줘요. */
  finishTournament() {
    const t = snapshot.career?.natLog.at(-1);
    closeWithToast({ tournament: false }, t && `${t.name} · ${t.label}`);
  },
  /** 맨 앞의 축하 팝업을 닫아요. 남은 축하가 있으면 다음 장이 이어서 떠요. */
  dismissCheer() {
    mutate((c) => {
      c.cheers.shift();
    });
  },
  /** 드래프트 진행 화면을 닫고 지명 결과를 알림으로 보여줘요. */
  finishDraft() {
    closeWithToast({ drafting: false }, snapshot.career?.news[0]?.m);
  },
  /** 구단에 이적을 요청해요. 결과는 결정 시트(허락·거절)와 알림으로 나와요. */
  requestTransfer() {
    const before = snapshot.career?.news[0];
    mutate((c) => {
      requestTransfer(c);
    });
    const c = snapshot.career;
    const msg = c && latestNewsSince(before, c);
    if (msg) set({ toast: toast(msg) });
  },
  buy(key: ShopKey) {
    mutate((c) => {
      buy(c, key);
    });
    const m = snapshot.career?.news[0]?.m;
    if (m) set({ toast: toast(`구입 · ${m}`) });
  },
  donate(amount: number) {
    mutate((c) => {
      donate(c, amount);
    });
    const m = snapshot.career?.news[0]?.m;
    if (m) set({ toast: toast(m) });
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
};
