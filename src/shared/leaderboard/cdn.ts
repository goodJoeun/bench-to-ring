// 순위표 GET 응답(순위표, 스탯 랭킹, 날짜별 등록 수)은 Vercel CDN이 잠깐 들고 있다가 그대로 내줘요.
// 그동안은 서버 함수도 DB도 깨지 않아서, 보기만 하는 사람이 많아도 Neon compute가 덜 깨어 있어요.

/** CDN이 순위표 응답을 새것으로 치는 시간(초). 다른 사람이 올린 기록은 이만큼 늦게 보일 수 있어요. */
export const CDN_FRESH_S = 300;
/** 새것이 아니게 된 뒤에도 이 시간(초) 동안은 묵은 응답을 바로 내주면서 뒤에서 새로 받아 와요. */
export const CDN_STALE_S = 3600;

/** 순위표 GET 응답의 Cache-Control. 브라우저는 매번 다시 묻고(브라우저 쪽 기억은 TanStack Query가 맡아요), CDN만 들고 있어요. */
export const BOARD_CACHE_CONTROL = `public, max-age=0, s-maxage=${CDN_FRESH_S}, stale-while-revalidate=${CDN_STALE_S}`;

/**
 * 방금 기록을 올린 브라우저가 CDN에 남은 묵은 순위표를 건너뛰려고 붙이는 쿼리 이름. 값은 마지막으로 올린 때예요.
 * 서버는 이 값을 읽지 않아요(순위표 조건 검사에서 빠져요). CDN 캐시 키만 달라져요.
 */
export const FRESH_PARAM = "fresh";

/** 기록을 올린 뒤 이 시간(ms) 동안은 FRESH_PARAM을 붙여요. CDN이 묵은 응답을 내줄 수 있는 가장 긴 시간이에요. */
export const FRESH_BYPASS_MS = (CDN_FRESH_S + CDN_STALE_S) * 1000;
