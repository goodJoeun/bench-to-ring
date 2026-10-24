import { RULESET_VERSION, type CareerSummary, type PosKey } from "@/game";
import type { Board, BoardScope, PlayerCreated, SubmitResult } from "./types";

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

/** 순위표를 가져와요. 서버가 안 되면 null이에요. */
export async function fetchBoard(scope: BoardScope = { ruleset: RULESET_VERSION }, pos: PosKey | null = null): Promise<Board | null> {
  const q = new URLSearchParams(scope === "all" ? { scope: "all" } : { ruleset: String(scope.ruleset) });
  if (pos) q.set("pos", pos);
  try {
    const res = await fetch(`/api/boards?${q}`);
    return res.ok ? ((await res.json()) as Board) : null;
  } catch {
    return null;
  }
}

/** 은퇴 기록을 올려요. 올라가면 순위를, 아니면 null을 돌려줘요. */
export async function submitCareer(s: CareerSummary): Promise<SubmitResult | null> {
  savePending([...loadPending().filter((p) => p.id !== s.id), s]);
  await flushing;
  return (await flushPending()).get(s.id) ?? null;
}
