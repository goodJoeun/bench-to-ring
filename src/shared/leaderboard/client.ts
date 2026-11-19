import type { CareerSummary, PosKey } from "@/game";
import { getQueryClient } from "@/shared/query/query-client";
import { FRESH_BYPASS_MS, FRESH_PARAM } from "./cdn";
import { LEADERBOARD } from "./keys";
import type { Board, BoardDay, BoardDays, BoardScope, DeleteResult, MyRanks, PlayerCreated, StatBoard, StatKey, SubmitResult } from "./types";

// 온라인 랭킹에 은퇴 기록을 올리고 지워요. 서버가 안 되면 조용히 실패하고, 보내지 못한 기록과 지우지 못한 기록은 다음에 다시 해요.

const TOKEN_KEY = "b2r-player-v1";
const PENDING_KEY = "b2r-pending-v1";
/** 온라인 랭킹에서 지울 커리어 id. 서버가 안 돼 지우지 못했으면 남겨 두고 다음에 다시 지워요. */
const DELETE_KEY = "b2r-delete-v1";
/** 마지막으로 기록을 올린 때(ms). 새로 고쳐도 CDN의 묵은 순위표를 건너뛸 수 있게 남겨 둬요. */
const SUBMITTED_KEY = "b2r-submitted-v1";
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

function loadDeletes(): string[] {
  try {
    const o: unknown = JSON.parse(read(DELETE_KEY) ?? "[]");
    return Array.isArray(o) ? o.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function saveDeletes(ids: string[]): void {
  write(DELETE_KEY, ids.length ? JSON.stringify(ids) : null);
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

/**
 * 올린 기록 하나를 지워요. 토큰이 없으면 올린 적이 없어 지울 것도 없어요.
 * 다시 해도 소용없는 실패(형식 오류, 서버가 모르는 토큰)는 끝난 것으로 쳐요. 서버가 모르는 토큰이면 그 기록도 없어요.
 */
async function sendDelete(id: string): Promise<{ done: true; deleted: boolean } | { done: false }> {
  const t = read(TOKEN_KEY);
  if (!t) return { done: true, deleted: false };
  const res = await fetch(`/api/careers/mine?career=${encodeURIComponent(id)}`, { method: "DELETE", headers: { authorization: `Bearer ${t}` } });
  if (res.ok) return { done: true, deleted: ((await res.json()) as DeleteResult).deleted };
  if (res.status === 400 || res.status === 401) return { done: true, deleted: false };
  return { done: false };
}

let flushing: Promise<Map<string, SubmitResult>> | null = null;

/**
 * 지울 기록을 먼저 지우고, 쌓인 기록을 오래된 것부터 보내요. 하나라도 실패하면 거기서 멈추고 다음에 이어서 해요.
 * 앱을 처음 불러올 때와 기록을 올리거나 지울 때 불러요.
 */
export function flushPending(): Promise<Map<string, SubmitResult>> {
  flushing ??= (async () => {
    const results = new Map<string, SubmitResult>();
    let removed = false;
    try {
      for (const id of loadDeletes()) {
        const sent = await sendDelete(id);
        if (!sent.done) break;
        removed ||= sent.deleted;
        saveDeletes(loadDeletes().filter((x) => x !== id));
      }
    } catch {
      // 네트워크 오류: 남은 기록은 다음에 지워요.
    }
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
    // CDN이 들고 있는 순위표에는 아직 내 기록이 없으니(지운 기록은 아직 있으니), 한동안은 CDN을 건너뛰어 불러요(withFresh).
    if (results.size || removed) {
      write(SUBMITTED_KEY, String(Date.now()));
      void getQueryClient().invalidateQueries({ queryKey: LEADERBOARD });
    }
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

/** 기록을 올린 지 FRESH_BYPASS_MS가 안 됐으면 CDN 캐시 키가 달라지게 올린 때를 붙여요. 다른 사람은 늘 CDN이 들고 있는 것을 받아요. */
function withFresh(q: URLSearchParams): URLSearchParams {
  const at = Number(read(SUBMITTED_KEY));
  if (at > 0 && Date.now() - at < FRESH_BYPASS_MS) q.set(FRESH_PARAM, String(at));
  return q;
}

/** 순위표를 가져와요. 기본은 룰셋과 날짜를 가리지 않는 역대 전체예요. 날짜를 주면 그날 올라온 기록끼리의 순위예요. */
export function fetchBoard(scope: BoardScope = "all", pos: PosKey | null = null, day: BoardDay = null): Promise<Board> {
  const q = new URLSearchParams(scope === "all" ? { scope: "all" } : { ruleset: String(scope.ruleset) });
  if (pos) q.set("pos", pos);
  if (day) q.set("day", day);
  return getJson(`/api/boards?${withFresh(q)}`);
}

/** 스탯 랭킹(프로 통산 상위 50명)을 가져와요. 날짜는 순위표와 같아요. */
export function fetchStatBoard(stat: StatKey, scope: BoardScope = "all", day: BoardDay = null): Promise<StatBoard> {
  const q = new URLSearchParams(scope === "all" ? { scope: "all", stat } : { ruleset: String(scope.ruleset), stat });
  if (day) q.set("day", day);
  return getJson(`/api/stats?${withFresh(q)}`);
}

/** 날짜별 랭킹 등록 수를 가져와요. */
export const fetchBoardDays = (): Promise<BoardDays> => {
  const q = withFresh(new URLSearchParams()).toString();
  return getJson(q ? `/api/boards/days?${q}` : "/api/boards/days");
};

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

/**
 * 은퇴 기록을 온라인 랭킹에서 지워요. 아직 올리지 못한 기록이면 대기열에서 빼요.
 * 보내는 중이던 기록이 있으면 그게 끝난 뒤에 지워요. 서버가 안 되면 지울 id를 남겨 두고 다음에 접속할 때 다시 지워요.
 * 지웠거나 지울 게 없으면 true, 다음으로 미뤘으면 false예요.
 */
export async function deleteOnline(id: string): Promise<boolean> {
  savePending(loadPending().filter((p) => p.id !== id));
  if (!read(TOKEN_KEY)) return true;
  saveDeletes([...loadDeletes().filter((x) => x !== id), id]);
  await flushing;
  await flushPending();
  return !loadDeletes().includes(id);
}
