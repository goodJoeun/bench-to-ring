import { afterAll, describe, expect, it, vi } from "vitest";

// 브라우저처럼 window.localStorage를 흉내 내요. TanStack Query는 처음 불러올 때 window로 서버인지 정하니까
// 어떤 import보다 먼저 둬야 QueryClient가 브라우저용(하나를 함께 씀)이 돼요.
const store = vi.hoisted(() => {
  const m = new Map<string, string>();
  (globalThis as Record<string, unknown>).window = {
    localStorage: {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    },
  };
  return m;
});

import type { UseQueryResult } from "@tanstack/react-query";
import type { CareerSummary } from "@/game";
import { loadState } from "../load-state";
import { getQueryClient, shouldRetry } from "../query-client";
import { deleteOnline, flushPending, pendingIds, submitCareer } from "@/shared/leaderboard/client";
import { LEADERBOARD, leaderboardKeys } from "@/shared/leaderboard/keys";

/** 테스트용 쿼리 결과: loadState가 읽는 값만 채워요. */
const q = <T>(o: { data?: T; isError?: boolean; isFetching?: boolean }) =>
  ({ data: o.data, isError: !!o.isError, isFetching: !!o.isFetching, refetch: vi.fn() }) as unknown as UseQueryResult<T>;

describe("loadState", () => {
  it("아직 부르지 않았거나 불러오는 중이면 로딩이에요", () => {
    expect(loadState(q({}))).toMatchObject({ loading: true, failed: false });
    expect(loadState(q({ isFetching: true }))).toMatchObject({ loading: true, failed: false });
  });

  it("데이터 없이 실패하면 실패, '다시 불러오기' 중이면 다시 로딩이에요", () => {
    expect(loadState(q({ isError: true }))).toMatchObject({ loading: false, failed: true });
    expect(loadState(q({ isError: true, isFetching: true }))).toMatchObject({ loading: true, failed: false });
  });

  it("보여주던 데이터가 있으면 뒤에서 새로 부르다 실패해도 그대로 보여줘요", () => {
    expect(loadState(q({ data: 1, isError: true }))).toMatchObject({ data: 1, loading: false, failed: false });
  });

  it("retry는 다시 불러와요", () => {
    const r = q({ isError: true });
    loadState(r).retry();
    expect(r.refetch).toHaveBeenCalledOnce();
  });
});

describe("재시도", () => {
  it("네트워크 오류는 한 번만 다시 해 봐요", () => {
    expect(shouldRetry(0, new TypeError("fetch failed"))).toBe(true);
    expect(shouldRetry(1, new TypeError("fetch failed"))).toBe(false);
  });

  it("응답이 없어 시간이 다 된 것은 다시 기다리지 않아요", () => {
    expect(shouldRetry(0, new DOMException("timeout", "TimeoutError"))).toBe(false);
  });
});

describe("랭킹 쿼리 키", () => {
  it("모두 LEADERBOARD로 시작해 한 번에 낡은 것으로 칠 수 있어요", () => {
    for (const k of [leaderboardKeys.board(null, null), leaderboardKeys.stat("2026-11-11", "pts"), leaderboardKeys.days(), leaderboardKeys.mine()])
      expect(k.slice(0, LEADERBOARD.length)).toEqual([...LEADERBOARD]);
  });

  it("날짜·포지션·스탯이 다르면 키가 달라요", () => {
    expect(leaderboardKeys.board(null, null)).not.toEqual(leaderboardKeys.board("2026-11-11", null));
    expect(leaderboardKeys.board(null, null)).not.toEqual(leaderboardKeys.board(null, "PG"));
    expect(leaderboardKeys.stat(null, "pts")).not.toEqual(leaderboardKeys.stat(null, "reb"));
  });
});

// 흉내 낸 window는 이 파일의 테스트가 모두 끝난 뒤에 치워요.
afterAll(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe("은퇴 기록 올리기", () => {
  afterAll(() => vi.unstubAllGlobals());

  const summary = { id: "c1", name: "테스트" } as CareerSummary;

  it("올라가면 순위를 돌려주고 랭킹 쿼리를 모두 낡은 것으로 쳐요", async () => {
    store.clear();
    const client = getQueryClient();
    expect(getQueryClient()).toBe(client);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/players"
          ? new Response(JSON.stringify({ token: "t" }), { status: 201 })
          : new Response(JSON.stringify({ rank: 3, posRank: 1, pos: "PG", total: 10 }), { status: 201 }),
      ),
    );
    await expect(submitCareer(summary)).resolves.toMatchObject({ rank: 3 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: LEADERBOARD });
    expect(pendingIds().size).toBe(0);
  });

  it("서버가 안 되면 기록은 남겨 두고 순위표는 건드리지 않아요", async () => {
    const invalidate = vi.spyOn(getQueryClient(), "invalidateQueries");
    invalidate.mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    await expect(submitCareer(summary)).resolves.toBeNull();
    expect(invalidate).not.toHaveBeenCalled();
    expect(pendingIds()).toEqual(new Set(["c1"]));
  });
});

describe("은퇴 기록 지우기", () => {
  afterAll(() => vi.unstubAllGlobals());

  it("올린 적이 없는 브라우저는 서버에 묻지 않고, 대기열의 기록만 빼요", async () => {
    store.clear();
    store.set("b2r-pending-v1", JSON.stringify([{ id: "c1" }, { id: "c2" }]));
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(deleteOnline("c1")).resolves.toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(pendingIds()).toEqual(new Set(["c2"]));
  });

  it("내 토큰으로 지우고, 지웠으면 랭킹 쿼리를 모두 낡은 것으로 쳐요", async () => {
    store.clear();
    store.set("b2r-player-v1", "tok");
    const invalidate = vi.spyOn(getQueryClient(), "invalidateQueries");
    invalidate.mockClear();
    const fetch = vi.fn(async () => new Response(JSON.stringify({ deleted: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await expect(deleteOnline("c 1")).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith("/api/careers/mine?career=c%201", { method: "DELETE", headers: { authorization: "Bearer tok" } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: LEADERBOARD });
    expect(store.has("b2r-delete-v1")).toBe(false);
    // 지운 브라우저는 한동안 CDN이 들고 있는 순위표를 건너뛰어요.
    expect(Number(store.get("b2r-submitted-v1"))).toBeGreaterThan(0);
  });

  it("서버가 안 되면 지울 기록을 남겨 두고, 다음에 접속할 때 지워요", async () => {
    store.clear();
    store.set("b2r-player-v1", "tok");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    await expect(deleteOnline("c3")).resolves.toBe(false);
    expect(JSON.parse(store.get("b2r-delete-v1")!)).toEqual(["c3"]);
    const fetch = vi.fn(async () => new Response(JSON.stringify({ deleted: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await flushPending();
    expect(fetch).toHaveBeenCalledOnce();
    expect(store.has("b2r-delete-v1")).toBe(false);
  });
});
