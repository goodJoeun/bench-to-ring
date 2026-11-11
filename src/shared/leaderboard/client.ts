import type { CareerSummary, PosKey } from "@/game";
import { getQueryClient } from "@/shared/query/query-client";
import { LEADERBOARD } from "./keys";
import type { Board, BoardDay, BoardDays, BoardScope, MyRanks, PlayerCreated, StatBoard, StatKey, SubmitResult } from "./types";

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
    // 순위가 바뀌었으니 불러온 순위표는 낡은 것으로 쳐요. 떠 있는 화면(명예의 전당, 랭킹)은 바로 새로 불러와 내 순위가 보여요.
    if (results.size) void getQueryClient().invalidateQueries({ queryKey: LEADERBOARD });
    return results;
  })().finally(() => (flushing = null));
  return flushing;
}

/** 순위표 응답을 기다리는 시간. 이 안에 오지 않으면 서버가 안 되는 것으로 쳐요. */
const BOARD_TIMEOUT_MS = 10000;

/** GET으로 JSON을 받아요. 서버가 안 되거나 BOARD_TIMEOUT_MS 안에 응답이 없으면 오류를 던져요(TanStack Query가 실패로 받아요). */
async function getJson<T>(url: string, headers?: HeadersInit): Promise<T> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(BOARD_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

/** 순위표를 가져와요. 기본은 룰셋과 날짜를 가리지 않는 역대 전체예요. 날짜를 주면 그날 올라온 기록끼리의 순위예요. */
export function fetchBoard(scope: BoardScope = "all", pos: PosKey | null = null, day: BoardDay = null): Promise<Board> {
  const q = new URLSearchParams(scope === "all" ? { scope: "all" } : { ruleset: String(scope.ruleset) });
  if (pos) q.set("pos", pos);
  if (day) q.set("day", day);
  return getJson(`/api/boards?${q}`);
}

/** 스탯 랭킹(프로 통산 상위 50명)을 가져와요. 날짜는 순위표와 같아요. */
export function fetchStatBoard(stat: StatKey, scope: BoardScope = "all", day: BoardDay = null): Promise<StatBoard> {
  const q = new URLSearchParams(scope === "all" ? { scope: "all", stat } : { ruleset: String(scope.ruleset), stat });
  if (day) q.set("day", day);
  return getJson(`/api/stats?${q}`);
}

/** 날짜별 랭킹 등록 수를 가져와요. */
export const fetchBoardDays = (): Promise<BoardDays> => getJson("/api/boards/days");

/** 이 브라우저(플레이어)가 올린 기록의 지금 순위. 아직 올린 적이 없으면 null이에요. */
export async function fetchMine(): Promise<MyRanks | null> {
  const t = read(TOKEN_KEY);
  return t ? getJson<MyRanks>("/api/careers/mine", { authorization: `Bearer ${t}` }) : null;
}

/** 아직 서버에 올리지 못하고 기다리는 기록의 커리어 id */
export const pendingIds = (): Set<string> => new Set(loadPending().map((s) => s.id));

/** 은퇴 기록을 올려요. 올라가면 순위를, 아니면 null을 돌려줘요. */
export async function submitCareer(s: CareerSummary): Promise<SubmitResult | null> {
  savePending([...loadPending().filter((p) => p.id !== s.id), s]);
  await flushing;
  return (await flushPending()).get(s.id) ?? null;
}
