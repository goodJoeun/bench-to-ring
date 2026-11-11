import type { UseQueryResult } from "@tanstack/react-query";

/**
 * 화면에서 쓰는 세 갈래로 나눠요. 보여줄 데이터가 있으면 그걸 보여주고(뒤에서 새로 부르다 실패해도 그대로 둬요),
 * 없으면 불러오는 중(아직 부르지 않았거나 '다시 불러오기' 중) 또는 실패예요.
 */
export function loadState<T>(q: UseQueryResult<T>): { data: T | undefined; loading: boolean; failed: boolean; retry: () => void } {
  const failed = q.data === undefined && q.isError && !q.isFetching;
  return { data: q.data, loading: q.data === undefined && !failed, failed, retry: () => void q.refetch() };
}
