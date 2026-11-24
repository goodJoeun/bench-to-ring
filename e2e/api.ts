import type { Page } from "@playwright/test";
import { POS_KEYS, type PosKey } from "@/game";
import { daysBack, kstDay } from "@/shared/leaderboard/days";
import { STAT_KEYS, type Board, type BoardDays, type BoardEntry, type ChallengeBoard, type MyAround, type MyChallenge, type MyRanks, type StatBoard, type StatKey } from "@/shared/leaderboard/types";
import { NOW, retired, summary } from "./careers";

const NAMES = ["한별", "도윤", "서준", "민재", "지훈", "태양", "하늘", "건우", "시우", "유찬", "은호", "재민"];
const TEAMS = ["보스턴 셀틱스", "LA 레이커스", "덴버 너기츠", "뉴욕 닉스", "골든스테이트 워리어스", "시카고 불스"];
const MINE_ID = "visual-record";

const entry = (i: number, pos: PosKey = POS_KEYS[i % POS_KEYS.length]): BoardEntry => ({
  id: `visual-${pos}-${i}`,
  rank: i + 1,
  posRank: Math.floor(i / POS_KEYS.length) + 1,
  name: NAMES[i % NAMES.length],
  num: (i * 7) % 100,
  pos,
  score: 980 - i * 17,
  mvp: Math.max(0, 3 - i),
  fmvp: Math.max(0, 2 - i),
  leagueMvp: i % 3,
  peak: 96 - Math.floor(i / 2),
  personal: 92 - i,
  pts: 24000 - i * 900,
  reb: 7000 - i * 210,
  ast: 5000 - i * 170,
  rings: Math.max(0, 4 - i),
  seasons: 18 - (i % 4),
  legacy: summary.legacy,
  team: TEAMS[i % TEAMS.length],
  look: summary.look ?? null,
  ruleset: 1,
  verified: false,
});

const list = <T>(n: number, make: (i: number) => T) => Array.from({ length: n }, (_, i) => make(i));

function board(url: URL): Board {
  const pos = url.searchParams.get("pos") as PosKey | null;
  return {
    scope: "all",
    day: url.searchParams.get("day"),
    pos,
    top: list(12, (i) => entry(i, pos ?? undefined)),
    best5: POS_KEYS.map((p, i) => ({ pos: p, career: entry(i, p) })),
    stats: { careers: 1284, nba: 312, nbaMvp: 41 },
  };
}

const boardDays = (): BoardDays => ({
  days: daysBack(kstDay(NOW)).map((day, i) => ({ day, careers: 120 - i * 9, players: 80 - i * 5 })),
  all: { careers: 1284, players: 640 },
  byPos: { PG: 268, SG: 281, SF: 252, PF: 243, C: 240 },
});

function stats(url: URL): StatBoard {
  const stat = (url.searchParams.get("stat") ?? STAT_KEYS[0]) as StatKey;
  const top = list(10, (i) => {
    const e = entry(i);
    return { id: e.id, rank: i + 1, name: e.name, num: e.num, pos: e.pos, value: 24000 - i * 900, gp: 1200 - i * 30, team: e.team, look: e.look };
  });
  return { scope: "all", day: url.searchParams.get("day"), stat, top };
}

const challenge = (url: URL): ChallengeBoard => ({
  day: url.searchParams.get("day") ?? kstDay(NOW),
  boards: Object.fromEntries(POS_KEYS.map((p) => [p, { top: list(6, (i) => ({ ...entry(i, p), rank: i + 1, posRank: i + 1, tries: (i % 3) + 1 })), players: 38, runs: 64 }])) as ChallengeBoard["boards"],
});

const myChallenge = (url: URL): MyChallenge => ({
  day: url.searchParams.get("day") ?? kstDay(NOW),
  mine: [{ pos: summary.pos, id: MINE_ID, careerId: retired.id, rank: 12, players: 38, tries: 2, score: 812 }],
});

// 역대 TOP 10에 들면 업적 알림이 떠서 화면이 흔들려요. 순위권 밖으로 둬요.
const myRanks = (): MyRanks => ({ total: 1284, careers: [{ careerId: retired.id, id: MINE_ID, rank: 120, posRank: 30, score: 812 }] });

const myAround = (): MyAround => ({
  id: MINE_ID,
  rows: list(5, (i) => ({ ...entry(i, summary.pos), rank: 118 + i, posRank: 28 + i, ...(i === 2 && { id: MINE_ID, name: summary.name, num: summary.num }) })),
});

const ROUTES: Record<string, (url: URL) => unknown> = {
  "/api/boards": board,
  "/api/boards/days": boardDays,
  "/api/stats": stats,
  "/api/challenge": challenge,
  "/api/challenge/mine": myChallenge,
  "/api/careers/mine": myRanks,
  "/api/careers/mine/around": myAround,
};

/** 이 페이지의 바깥 요청을 모두 막고, 랭킹 API는 고정된 가짜 응답으로 바꿔요. 쓰기 요청은 서버에 닿지 않아요. */
export async function mockApi(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname !== "localhost" || url.pathname.startsWith("/_vercel/")) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const handler = req.method() === "GET" ? ROUTES[url.pathname] : undefined;
    return handler ? route.fulfill({ json: handler(url) }) : route.fulfill({ status: 503, json: { error: "화면 테스트에서는 막아 둔 요청이에요" } });
  });
}
