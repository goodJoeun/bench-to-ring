import { playedNba, rankScore, type CareerSummary } from "@/game";

// 은퇴 요약에서 계산해 따로 칸으로 두는 값. 순위와 스탯 랭킹이 인덱스로 읽어요.
// DB를 쓰지 않아서 db:rescore 스크립트에서도 불러요.

/** 계산 규칙(랭킹 점수, NBA 팀 목록)을 바꾸면 `npm run db:rescore`로 저장된 기록을 고쳐요. */
export function derivedColumns(s: CareerSummary) {
  return {
    score: rankScore(s),
    nba: playedNba(s),
    stl: s.stl ?? null,
    blk: s.blk ?? null,
    tpm: s.tpm ?? null,
    // 기부하지 않은 커리어는 기부금 랭킹에서 빠져요.
    donated: s.donated || null,
  };
}
