import { useSyncExternalStore } from "react";
import {
  HOME_NATION,
  INVEST_SLOTS,
  LOOKS,
  buy,
  canRetire,
  chooseOption,
  chosenInvest,
  createCareer,
  currentDecision,
  donate,
  generateCandidates,
  randomLooks,
  shuffle,
  toLook,
  requestTransfer,
  resolveQueue,
  retire,
  startSeason,
  stepSeason,
  type Candidate,
  type Action,
  type Career,
  type CareerPath,
  type CareerSummary,
  type FocusKey,
  type InvestKey,
  type Look,
  type NewsItem,
  type PosKey,
  type SeasonStep,
  type ShopKey,
} from "@/game";
import { loadCareer, loadEnding, loadEndingIds, loadHall, saveCareer, saveEnding, saveHall } from "@/game/storage";
import { flushPending, submitCareer } from "@/lib/leaderboard/client";

/** 선수 생성 화면의 입력값 */
export interface CreationDraft {
  name: string;
  num: string;
  /** 고른 캐릭터 */
  look: Look;
  /** 고른 캐릭터에 입혀 본 유니폼 색. 생성 화면에서만 써요. */
  jersey: string;
  /** 고를 수 있게 늘어놓은 캐릭터 (무작위 조합)와 저마다 입혀 본 유니폼 색 */
  looks: Look[];
  jerseys: string[];
  /** 국적 (NATIONS의 이름) */
  nat: string;
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
  /** 엔딩을 다시 볼 수 있는 은퇴 커리어 id (명예의 전당 기록과 같은 id) */
  endings: string[];
  /** 다시 보고 있는 지난 커리어의 엔딩. 보는 동안 지금 커리어는 그대로 있어요. */
  ending: Career | null;
  /** 시즌이 저절로 흘러가는 중인지. 꺼져 있으면 일시정지예요. 불러온 시즌은 멈춘 채로 시작해요. */
  playing: boolean;
  /** 시즌 진행 배속 */
  speed: Speed;
  /** 결승전 중계를 보여주는 중인지 (c.live) */
  final: boolean;
  /** 커리어 회고를 보여주는 중인지. 방금 은퇴했거나, 은퇴 화면(지난 엔딩 포함)에서 다시 열었을 때예요. */
  farewell: boolean;
  /** 은퇴 화면에서 회고를 다시 연 것인지. 이때는 뒤에 엔딩을 그대로 둬요. */
  farewellReplay: boolean;
  /** 국가대표 대회 진행 화면을 보여주는 중인지 (c.natLog의 마지막 대회) */
  tournament: boolean;
  /** 드래프트 진행 화면을 보여주는 중인지 (c.draftShow) */
  drafting: boolean;
  /** 화면 아래에 잠깐 떴다 사라지는 알림 */
  toast: Toast | null;
  /** 방금 고른 시즌 중 결정의 결과. 떠 있는 동안 시즌이 멈춰요. */
  outcome: Outcome | null;
}

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

export interface Toast {
  id: number;
  msg: string;
}

/** 결정 결과의 성격: 성공, 실패, 그 밖 */
export type OutcomeTone = "good" | "bad" | "info";

export interface Outcome {
  id: number;
  /** 고른 선택지 */
  label: string;
  /** 그 결과로 생긴 소식 */
  msg: string;
  tone: OutcomeTone;
}

const REROLLS = 5;
/** 한 번에 늘어놓는 캐릭터 수 */
const LOOK_COUNT = 24;

/** 캐릭터 고르기에서 입혀 보는 유니폼 색. 커리어에서는 소속팀 색을 입어요. */
const JERSEYS = ["#C8102E", "#1D428A", "#2453A6", "#00704A", "#552583", "#F2A900", "#E56020", "#111111", "#6CACE4", "#860038", "#007A7A", "#B4975A"];

/** 유니폼 색 count개. 팔레트를 섞어 차례로 쓰고, 이웃한 두 칸이 같은 색이 되지 않게 해요. */
function randomJerseys(count: number): string[] {
  const out: string[] = [];
  while (out.length < count) {
    const round = shuffle(JERSEYS);
    if (round[0] === out.at(-1)) round.push(round.shift()!);
    out.push(...round);
  }
  return out.slice(0, count);
}

const emptyDraft = (): CreationDraft => ({
  name: "",
  num: "",
  // 저장소를 읽기 전(서버 렌더링)에는 무작위 없이 정해 둬요. 화면에 나오기 전에 freshDraft가 새로 뽑아요.
  look: toLook({ kind: "asian", skin: LOOKS.asian.skins[1], hair: LOOKS.asian.hairs[0] }),
  jersey: "#2453A6",
  looks: [],
  jerseys: [],
  nat: HOME_NATION,
  pos: "SG",
  // 커리어 경로는 국내 경로(고교 → U-리그·KBL)로 고정이에요. 해외 진출은 실력이 되면 제안으로 와요.
  path: "domestic",
  school: "",
  candidates: [],
  pool: {},
  selected: 0,
  rerolls: REROLLS,
});

const SERVER_SNAPSHOT: GameSnapshot = { ready: false, career: null, draft: emptyDraft(), hall: [], endings: [], ending: null, playing: false, speed: 1, final: false, farewell: false, farewellReplay: false, tournament: false, drafting: false, toast: null, outcome: null };

let snapshot: GameSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function freshDraft(prev?: CreationDraft): CreationDraft {
  const base = prev ?? emptyDraft();
  const candidates = generateCandidates(base.pos);
  // 다시 시작해도 지난번에 고른 캐릭터는 맨 앞에 남겨요.
  const looks = prev ? [prev.look, ...randomLooks(LOOK_COUNT - 1)] : randomLooks(LOOK_COUNT);
  const jerseys = prev ? [prev.jersey, ...randomJerseys(LOOK_COUNT - 1)] : randomJerseys(LOOK_COUNT);
  return {
    ...base,
    look: looks[0],
    jersey: jerseys[0],
    looks,
    jerseys,
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
  // 엔딩 보관함이 생기기 전에 은퇴해 엔딩에 머물러 있던 커리어도 넣어 둬요.
  const ids = loadEndingIds();
  const endings = career?.stage === "retired" && career.summary?.seasons && !ids.includes(career.id) ? saveEnding(career) : ids;
  snapshot = { ...SERVER_SNAPSHOT, ready: true, career, draft: freshDraft(), hall: loadHall(), endings };
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
function latestNewsItemSince(before: NewsItem | undefined, c: Career): NewsItem | null {
  const first = c.news[0];
  if (!first) return null;
  if (before && first.w === before.w && first.t === before.t && first.m === before.m) return null;
  return first;
}

const latestNewsSince = (before: NewsItem | undefined, c: Career): string | null => latestNewsItemSince(before, c)?.m ?? null;

/**
 * 결과 카드 색. 성공·실패가 갈리는 선택(운에 맡긴 도전, 클러치)만 결과 소식으로 초록·빨강을 정하고,
 * 그 밖의 선택은 결과와 상관없이 기본색이에요.
 */
function toneOf(act: Action, news: NewsItem | null): OutcomeTone {
  if ((act.k !== "gamble" && act.k !== "clutch") || !news) return "info";
  if (news.t === "bad") return "bad";
  return news.t === "good" || news.t === "award" || news.t === "big" ? "good" : "info";
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
  let { hall, endings } = snapshot;
  const s = c.summary;
  if (c.stage === "retired" && s && s.seasons > 0 && !hall.some((h) => h.id === s.id)) {
    hall = [...hall, s];
    saveHall(hall);
    endings = saveEnding(c);
    submitOnline(s);
  }
  saveCareer(c);
  set(farewell ? { career: c, hall, endings, farewell, playing: false, toast: null } : { career: c, hall, endings });
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
  editDraft(patch: Partial<Pick<CreationDraft, "name" | "num" | "nat" | "school" | "selected">>) {
    set({ draft: { ...snapshot.draft, ...patch } });
  },
  /** 늘어놓은 캐릭터 가운데 i번째를 골라요. */
  chooseLook(i: number) {
    const d = snapshot.draft;
    set({ draft: { ...d, look: d.looks[i], jersey: d.jerseys[i] } });
  },
  /** 캐릭터를 새로 뽑아요. 고른 캐릭터는 맨 앞에 남겨요. */
  rerollLooks() {
    const d = snapshot.draft;
    const looks = [d.look, ...randomLooks(LOOK_COUNT - 1)];
    const jerseys = [d.jersey, ...randomJerseys(LOOK_COUNT - 1)];
    set({ draft: { ...d, looks, jerseys } });
  },
  /**
   * 포지션을 바꿔요. 처음 고르는 포지션만 새로 뽑고, 이미 본 포지션은 그때 후보를 그대로 보여줘요.
   * 다시 뽑기 기회는 포지션을 바꿀 때마다 처음 횟수로 돌아가요.
   */
  choosePosition(pos: PosKey) {
    const d = snapshot.draft;
    if (pos === d.pos) return;
    const candidates = d.pool[pos] ?? generateCandidates(pos);
    set({ draft: { ...d, pos, candidates, pool: { ...d.pool, [pos]: candidates }, selected: 0, rerolls: REROLLS } });
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
    const c = createCareer(
      { name: d.name, num: Number(d.num), nat: d.nat, look: d.look, pos: d.pos, path: d.path, school: d.school || undefined },
      cand,
    );
    saveCareer(c);
    set({ career: c });
  },
  setFocus(focus: FocusKey) {
    mutate((c) => {
      c.focus = focus;
    });
  },
  /** 시즌 투자를 고르거나 빼요. 고른 순서대로 두 가지까지 남고, 이번 시즌에 없는 특별 투자는 이때 정리해요. */
  toggleInvest(key: InvestKey) {
    mutate((c) => {
      const chosen = chosenInvest(c);
      c.invest = chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key].slice(0, INVEST_SLOTS);
    });
  },
  /** 시즌을 시작하고 바로 흘려 보내요. */
  startSeason() {
    if (!snapshot.career || snapshot.career.queue.length || snapshot.career.run) return;
    mutate(startSeason);
    set({ playing: true, outcome: null });
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
    const news = after ? latestNewsItemSince(before, after) : null;
    // 시즌 중 결정은 결과를 진행 막대 자리에 띄워 두고 시즌을 잠깐 멈춰요. 이어서 고를 결정이 있으면 알림으로만 알려요.
    if (opt && after?.run && !currentDecision(after))
      return set({ outcome: { id: ++toastId, label: opt.label, msg: news?.m ?? "선택이 반영됐어요.", tone: toneOf(opt.act, news) } });
    const msg = news?.m ?? (opt?.label ? `'${opt.label}'을(를) 골랐어요` : null);
    if (msg) set({ toast: toast(msg) });
  },
  /** 결정 결과를 닫고 시즌을 이어가요. */
  dismissOutcome(id: number) {
    if (snapshot.outcome?.id === id) set({ outcome: null });
  },
  /** 은퇴 화면에서 커리어 회고를 다시 열어요. */
  openFarewell() {
    if ((snapshot.ending ?? snapshot.career)?.stage !== "retired") return;
    set({ farewell: true, farewellReplay: true });
  },
  /** 커리어 회고를 닫고 엔딩(은퇴 화면)으로 가요. 은퇴 직후에는 엔딩 맨 위에서, 다시 본 뒤에는 보던 자리에서 이어져요. */
  finishFarewell() {
    const replay = snapshot.farewellReplay;
    set({ farewell: false, farewellReplay: false });
    if (!replay && typeof window !== "undefined") window.scrollTo({ top: 0 });
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
  /** 화면 아래에 알림을 띄워요. 공유처럼 게임 밖 동작의 결과를 알릴 때 써요. */
  notify(msg: string) {
    set({ toast: toast(msg) });
  },
  dismissToast(id: number) {
    if (snapshot.toast?.id === id) set({ toast: null });
  },
  retire() {
    mutate((c) => {
      if (canRetire(c)) retire(c);
    });
  },
  /** 지난 은퇴 선수의 엔딩을 다시 열어요. 진행 중인 시즌은 멈춰요. */
  openEnding(id: string) {
    const ending = loadEnding(id);
    if (!ending) return set({ endings: loadEndingIds(), toast: toast("이 선수의 엔딩을 불러오지 못했어요") });
    set({ ending, playing: false, farewell: false, farewellReplay: false });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  },
  /** 지난 엔딩을 닫고 원래 화면(진행 중인 커리어나 새 선수 만들기)으로 돌아가요. */
  closeEnding() {
    set({ ending: null, farewell: false, farewellReplay: false });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  },
  newCareer() {
    saveCareer(null);
    set({ career: null, draft: freshDraft(snapshot.draft), playing: false, final: false, outcome: null });
  },
};
