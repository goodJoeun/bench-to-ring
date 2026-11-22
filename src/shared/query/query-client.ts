import { QueryClient, isServer } from "@tanstack/react-query";
import { CDN_FRESH_S } from "@/shared/leaderboard/cdn";

// 서버에서 가져오는 데이터(온라인 랭킹)는 TanStack Query가 기억하고 다시 불러와요.
// 게임 상태(커리어)는 브라우저에만 있으니 여기가 아니라 shared/store/game-store가 맡아요.

/**
 * 불러온 순위표를 새것으로 치는 시간. 지나면 다시 볼 때 보여주면서 뒤에서 새로 불러와요.
 * CDN이 같은 응답을 들고 있는 시간과 맞춰요. 그 안에 다시 물어도 같은 응답이라 요청만 늘어요. 내 기록을 올리면 바로 비워요.
 */
const FRESH_MS = CDN_FRESH_S * 1000;

/** 잠깐 끊긴 네트워크는 한 번 더 해 봐요. 응답이 없어 시간이 다 된 것은 또 기다리게 하지 않아요. */
export const shouldRetry = (count: number, error: unknown): boolean =>
  count < 1 && !(error instanceof DOMException && error.name === "TimeoutError");

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // 다른 탭에 다녀올 때마다 떠 있는 순위표를 전부 다시 부르지 않아요.
      queries: { staleTime: FRESH_MS, retry: shouldRetry, refetchOnWindowFocus: false },
    },
  });
}

let browserClient: QueryClient | undefined;

/**
 * 브라우저에서는 늘 같은 QueryClient를 돌려줘요. 화면을 옮겨도 불러온 순위표가 남고, 게임 스토어(React 밖)에서도 같은 기억을 비울 수 있어요.
 * 서버 렌더링에서는 요청끼리 섞이지 않게 매번 새로 만들어요.
 */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  return (browserClient ??= makeQueryClient());
}
