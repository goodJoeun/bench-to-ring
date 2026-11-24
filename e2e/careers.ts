import {
  POS_KEYS,
  canRetire,
  chooseOption,
  createCareer,
  currentDecision,
  generateCandidate,
  resetRandom,
  resolveQueue,
  retire,
  seeded,
  setRandom,
  startSeason,
  stepSeason,
  type Action,
  type Career,
} from "@/game";
import { NOTICES } from "@/features/notice/notices";
import { kstDay } from "@/shared/leaderboard/days";

/** 화면에 나오는 '오늘'. 날짜가 바뀌어도 같은 화면이 찍혀요. */
export const NOW = Date.parse("2026-11-24T03:00:00Z");

/** 드래프트·국가대표·클러치·NBA MVP를 모두 거치는 커리어의 시드 */
const SEED = 26;

/** 커리어를 돌리며 저장해 두는 순간 */
export type Moment = "rookie" | "decision" | "clutch" | "draft" | "national" | "offer" | "running" | "beforeFinal" | "cheer" | "offseason" | "retired";

const hasAct = (c: Career, test: (a: Action) => boolean) => !!currentDecision(c)?.opts.some((o) => test(o.act));

/** 시드를 고정해 한 커리어를 은퇴까지 돌리고, 장면마다 처음 나온 순간을 복사해 둬요. */
function playCareer(): Record<Moment, Career> {
  setRandom(seeded(SEED));
  const pos = POS_KEYS[SEED % 5];
  const c = createCareer({ name: "테스트", num: 7, nat: "대한민국", pos, path: "domestic" }, generateCandidate(pos, SEED % 3), "visual-career");
  const seen: Partial<Record<Moment, Career>> = {};
  const keep = (m: Moment, from: Career = c) => {
    if (seen[m]) return;
    const copy = structuredClone(from);
    // 축하 팝업이 다른 장면을 가리지 않게 축하 장면에만 남겨요.
    if (m !== "cheer") copy.cheers = [];
    seen[m] = copy;
  };
  keep("rookie");
  for (let guard = 0; c.stage !== "retired" && guard < 6000; guard++) {
    if (c.cheers.length && !c.run) {
      keep("cheer");
      // 화면에서 축하 팝업을 닫은 것처럼 비워요.
      c.cheers = [];
    }
    const decision = currentDecision(c);
    if (decision) {
      if (c.run && hasAct(c, (a) => a.k === "boost" || a.k === "gamble")) keep("decision");
      if (hasAct(c, (a) => a.k === "clutch")) keep("clutch");
      if (hasAct(c, (a) => a.k === "draft")) keep("draft");
      if (hasAct(c, (a) => a.k === "national" && a.join)) keep("national");
      if (hasAct(c, (a) => a.k === "sign")) keep("offer");
      chooseOption(c, 0);
      resolveQueue(c);
    } else if (!c.run) {
      if (c.team?.lg === "nba" && c.hist.length >= 12) keep("offseason");
      if (canRetire(c) && c.age >= 36) retire(c);
      else {
        startSeason(c);
        resolveQueue(c);
      }
    } else {
      if (c.team?.lg === "nba" && c.run.phase === "reg" && c.run.g >= 20) keep("running");
      const before = c.team?.lg === "nba" && c.run.phase !== "reg" ? structuredClone(c) : null;
      const step = stepSeason(c);
      if (step === "final" && before) keep("beforeFinal", before);
      resolveQueue(c);
    }
  }
  keep("retired");
  resetRandom();
  const missing = (["decision", "clutch", "draft", "national", "offer", "running", "beforeFinal", "cheer", "offseason"] as const).filter((m) => !seen[m]);
  if (missing.length) throw new Error(`시드 ${SEED}의 커리어에 없는 장면: ${missing.join(", ")}`);
  return seen as Record<Moment, Career>;
}

export const careers = playCareer();
export const retired = careers.retired;
export const summary = retired.summary!;

/** 지금 결정에서 조건에 맞는 선택지의 순서 */
export const optionIndex = (m: Moment, test: (a: Action) => boolean) => currentDecision(careers[m])!.opts.findIndex((o) => test(o.act));

/** 장면을 열기 전에 브라우저에 넣을 저장소. at이 없으면 처음 온 방문자, "records"면 은퇴 기록만 있는 방문자예요. */
export function storageFor(at: Moment | "records" | undefined, unreadNotices = false): Record<string, string> {
  if (!at) return unreadNotices ? {} : readNotices();
  const achievements = Object.fromEntries(retired.achv.map((id) => [id, { at: NOW, name: summary.name, career: retired.id }]));
  return {
    ...(unreadNotices ? {} : readNotices()),
    "b2r-hall-v1": JSON.stringify([summary]),
    "b2r-endings-v1": JSON.stringify([retired]),
    "b2r-achv-v1": JSON.stringify(achievements),
    "b2r-player-v1": "visual-test-token",
    ...(at !== "records" && { "b2r-save-v1": JSON.stringify(careers[at]) }),
  };
}

/** 공지를 모두 읽고 오늘 안내도 끈 상태: 새 공지가 생겨도 다른 장면이 달라지지 않아요. */
const readNotices = () => {
  const ids = NOTICES.map((n) => n.id).join(",");
  return { "b2r-notices-read": ids, "b2r-notice-alert-seen": ids, "b2r-notice-alert-hidden": kstDay(NOW) };
};
