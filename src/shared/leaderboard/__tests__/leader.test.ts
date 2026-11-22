import { describe, expect, it } from "vitest";
import { challengeLeader } from "../leader";
import type { ChallengeEntry, ChallengePosBoard } from "../types";

const entry = (name: string, rank: number) => ({ name, rank }) as ChallengeEntry;
const board = (...top: ChallengeEntry[]): ChallengePosBoard => ({ top, players: top.length, runs: top.length });

describe("챌린지 포지션 1위", () => {
  it("기록이 없으면 1위도 없어요", () => {
    expect(challengeLeader(board())).toBeNull();
  });

  it("맨 위 기록의 이름을 돌려줘요", () => {
    expect(challengeLeader(board(entry("가드", 1), entry("센터", 2)))).toEqual({ name: "가드", others: 0 });
  });

  it("공동 1위는 나머지 사람 수를 세요", () => {
    expect(challengeLeader(board(entry("가드", 1), entry("센터", 1), entry("포워드", 1), entry("벤치", 4)))).toEqual({ name: "가드", others: 2 });
  });
});
