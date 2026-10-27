import type { CareerSummary, PosKey } from "@/game";
import type { Board, BoardScope, MyRanks, PlayerCreated, StatBoard, StatKey, SubmitResult } from "./types";

// 온라인 랭킹에 은퇴 기록을 올려요. 서버가 안 되면 조용히 실패하고, 보내지 못한 기록은 다음에 다시 보내요.

const TOKEN_KEY = "b2r-player-v1";
const PENDING_KEY = "b2r-pending-v1";
/** 보내지 못한 기록은 최근 것만 이만큼 남겨요. */
const PENDING_LIMIT = 20;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // 저장소를 쓸 수 없는 환경(시크릿 모드 등)에서는 조용히 넘어가요.
  }
}

function loadPending(): CareerSummary[] {
  try {
    const o: unknown = JSON.parse(read(PENDING_KEY) ?? "[]");
    return Array.isArray(o) ? (o as CareerSummary[]) : [];
  } catch {
    return [];
  }
}

function savePending(list: CareerSummary[]): void {
  write(PENDING_KEY, list.length ? JSON.stringify(list.slice(-PENDING_LIMIT)) : null);
}

async function token(): Promise<string | null> {
  const saved = read(TOKEN_KEY);
  if (saved) return saved;
  const res = await fetch("/api/players", { method: "POST" });
  if (!res.ok) return null;
  const { token } = (await res.json()) as PlayerCreated;
  write(TOKEN_KEY, token);
  return token;
}

type Sent = { done: true; result: SubmitResult | null } | { done: false };

/** 한 건을 보내요. 다시 보내도 소용없는 실패(형식 오류, 중복)는 끝난 것으로 쳐요. */
async function send(s: CareerSummary, retried = false): Promise<Sent> {
  const t = await token();
  if (!t) return { done: false };
  const res = await fetch("/api/careers", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${t}` },
    body: JSON.stringify(s),
  });
  if (res.status === 201) return { done: true, result: (await res.json()) as SubmitResult };
  // DB가 바뀌어 토큰을 모르면 새 플레이어로 한 번 더 보내요.
  if (res.status === 401 && !retried) {
    write(TOKEN_KEY, null);
    return send(s, true);
  }
  if (res.status === 400 || res.status === 409 || res.status === 413) return { done: true, result: null };
  return { done: false };
}

let flushing: Promise<Map<string, SubmitResult>> | null = null;

/** 쌓인 기록을 오래된 것부터 보내요. 하나라도 실패하면 거기서 멈추고 다음에 이어 보내요. */
export function flushPending(): Promise<Map<string, SubmitResult>> {
  flushing ??= (async () => {
    const results = new Map<string, SubmitResult>();
    try {
      for (const s of loadPending()) {
        const sent = await send(s);
        if (!sent.done) break;
        if (sent.result) results.set(s.id, sent.result);
        savePending(loadPending().filter((p) => p.id !== s.id));
      }
    } catch {
      // 네트워크 오류: 남은 기록은 다음에 보내요.
    }
    return results;
  })().finally(() => (flushing = null));
  return flushing;
}

/** 순위표 응답을 기다리는 시간. 이 안에 오지 않으면 서버가 안 되는 것으로 쳐요. */
const BOARD_TIMEOUT_MS = 10000;

/** 순위표를 가져와요. 기본은 룰셋을 가리지 않는 역대 전체예요. 서버가 안 되거나 BOARD_TIMEOUT_MS 안에 응답이 없으면 null이에요. */
export async function fetchBoard(scope: BoardScope = "all", pos: PosKey | null = null): Promise<Board | null> {
  const q = new URLSearchParams(scope === "all" ? { scope: "all" } : { ruleset: String(scope.ruleset) });
  if (pos) q.set("pos", pos);
  try {
    const res = await fetch(`/api/boards?${q}`, { signal: AbortSignal.timeout(BOARD_TIMEOUT_MS) });
    return res.ok ? ((await res.json()) as Board) : null;
  } catch {
    return null;
  }
}

/** 스탯 랭킹(프로 통산 상위 50명)을 가져와요. 서버가 안 되거나 BOARD_TIMEOUT_MS 안에 응답이 없으면 null이에요. */
export async function fetchStatBoard(stat: StatKey, scope: BoardScope = "all"): Promise<StatBoard | null> {
  const q = new URLSearchParams(scope === "all" ? { scope: "all", stat } : { ruleset: String(scope.ruleset), stat });
  try {
    const res = await fetch(`/api/stats?${q}`, { signal: AbortSignal.timeout(BOARD_TIMEOUT_MS) });
    return res.ok ? ((await res.json()) as StatBoard) : null;
  } catch {
    return null;
  }
}

/** 명예의 전당이 기억해 두는 역대 전체 순위표. 이 시간이 지나면 다시 불러와요. */
const BOARD_CACHE_MS = 60_000;
let boardCache: { at: number; board: Board } | null = null;

/** 마지막으로 불러온 역대 전체 순위표. 오래됐어도 돌려줘요. */
export const lastBoard = (): Board | null => boardCache?.board ?? null;

/** 순위가 바뀌었을 때(내 기록이 올라갔을 때) 알릴 곳 */
const boardListeners = new Set<() => void>();

/** 순위가 바뀌면 알려줘요. 돌려주는 함수를 부르면 그만 알려요. */
export function onBoardChange(listener: () => void): () => void {
  boardListeners.add(listener);
  return () => boardListeners.delete(listener);
}

/** 기억한 순위표가 없거나 BOARD_CACHE_MS보다 오래됐는지 */
export const boardStale = (): boolean => !boardCache || Date.now() - boardCache.at > BOARD_CACHE_MS;

/** 역대 전체 순위표를 새로 불러와 기억해요. 불러오지 못하면 기억한 것은 그대로 두고 null을 돌려줘요. */
export async function refreshBoard(): Promise<Board | null> {
  const board = await fetchBoard();
  if (board) boardCache = { at: Date.now(), board };
  return board;
}

/** 이 브라우저(플레이어)가 올린 기록의 지금 순위. 아직 올린 적이 없거나 서버가 안 되면 null이에요. */
export async function fetchMine(): Promise<MyRanks | null> {
  const t = read(TOKEN_KEY);
  if (!t) return null;
  try {
    const res = await fetch("/api/careers/mine", { headers: { authorization: `Bearer ${t}` } });
    return res.ok ? ((await res.json()) as MyRanks) : null;
  } catch {
    return null;
  }
}

/** 아직 서버에 올리지 못하고 기다리는 기록의 커리어 id */
export const pendingIds = (): Set<string> => new Set(loadPending().map((s) => s.id));

/** 은퇴 기록을 올려요. 올라가면 순위를, 아니면 null을 돌려줘요. */
export async function submitCareer(s: CareerSummary): Promise<SubmitResult | null> {
  savePending([...loadPending().filter((p) => p.id !== s.id), s]);
  await flushing;
  const result = (await flushPending()).get(s.id) ?? null;
  // 순위가 바뀌었으니 기억한 순위표는 버리고, 지금 떠 있는 명예의 전당에도 알려 새로 불러오게 해요.
  if (result) {
    boardCache = null;
    boardListeners.forEach((l) => l());
  }
  return result;
}
