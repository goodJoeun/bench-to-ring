import { ATTR_KEYS, POS, POS_KEYS } from "../core/data";
import { ATTR_RANGE } from "../player/condition";
import { evalOvr } from "../player/ratings";
import { LEAGUES } from "../world/leagues";
import { PLAYOFF_SPOTS, seasonStandings } from "../world/standings";
import { addNews, cheer } from "../career/log";
import { shopItem } from "../economy/shop";
import { EMPTY_LIFETIME, LIFETIME_PREFIX, addLifetime, fromCareer, subLifetime, type Lifetime } from "./lifetime";
import type { AttrKey, AwardEntry, AwardKey, Career, LeagueKey, MilitaryKind, PosKey, SeasonRecord } from "../core/types";

/**
 * 업적. 대부분 커리어 기록(시즌 기록, 수상, 드래프트, 국가대표, 기부, 산 것)으로 판정해요.
 * 기록에 남지 않는 것만 따로 세요: 연봉 인상 성공(c.raises), 클러치 성공(c.clutchWins)과 연속 기록(c.clutchStreak), 결승 클러치 성공(c.finalClutchWins),
 * 라이벌전 승리(c.rivalWins), 워크온 입학·주장 완장(c.milestones).
 * '역대 랭킹' 업적은 엔진이 판정하지 않아요. 은퇴 기록을 온라인 랭킹에 올리고 받은 순위로 rankAchievements가 정해요.
 * 업적은 브라우저마다 한 번만 따요. 브라우저에서 이미 딴 업적은 새 커리어에서 조건을 채워도 다시 뜨지 않아요.
 * 커리어마다 처음 딴 업적은 c.achv에 남고, 브라우저에서 딴 업적과 누적 기록은 storage.ts가 모아 둬요(setBrowserRecord).
 * '누적 기록' 업적은 이 브라우저에서 누적 기록을 세기 시작한 뒤로 플레이한 모든 커리어를 더해 판정해요.
 * 업적 창은 따기 전에는 이름과 힌트(hint)만, 딴 뒤에는 조건(desc)까지 보여줘요.
 */

export type AchievementGroup = "school" | "team" | "award" | "clutch" | "ability" | "path" | "life" | "military" | "rank" | "lifetime";

export const ACHIEVEMENT_GROUPS: Record<AchievementGroup, string> = {
  school: "고교·대학",
  team: "팀·우승",
  award: "개인상·기록",
  clutch: "클러치",
  ability: "능력치",
  path: "드래프트·진로",
  life: "국가대표·커리어",
  military: "병역",
  rank: "역대 랭킹",
  lifetime: "누적 기록",
};

/** 이 브라우저의 기록 */
export interface BrowserRecord {
  /** 이미 딴 업적 */
  unlocked: ReadonlySet<string>;
  /** 그 가운데 누적 기록을 세기 시작한 뒤로 딴 업적 수. 업적 사냥꾼이 세요. */
  recent: number;
  /** 지금 커리어를 뺀 다른 커리어들의 누적 기록 */
  others: Lifetime;
  /** 누적 기록을 세기 시작할 때 지금 커리어가 이미 쌓아 둔 기록. 이만큼은 빼요. */
  start?: Lifetime;
}

const NO_RECORD: BrowserRecord = { unlocked: new Set(), recent: 0, others: EMPTY_LIFETIME };
let browserRecord: (c: Career) => BrowserRecord = () => NO_RECORD;

/** 브라우저 기록을 읽는 함수를 정해요. 앱이 처음 불러올 때 storage.ts와 이어 주고, 테스트에서는 바꿔 끼워요. 인자를 빼면 기록 없음으로 돌아가요. */
export function setBrowserRecord(fn?: (c: Career) => BrowserRecord): void {
  browserRecord = fn ?? (() => NO_RECORD);
}

/** 누적 기록 업적이 보는 값: 모든 커리어를 더한 기록과, 누적 기록을 세기 시작한 뒤로 딴 업적 수 */
export interface LifeView {
  t: Lifetime;
  achv: number;
}

/** 판정에 쓰는 커리어 기록 */
interface View {
  c: Career;
  /** 군 복무를 뺀 시즌 (치른 순서). 무소속 시즌은 남아서 연속 기록을 끊어요. */
  seasons: SeasonRecord[];
  /** 프로 팀 시즌 */
  pro: SeasonRecord[];
  /** 정규시즌 MVP(NBA MVP 포함)를 받은 연도 */
  mvp: Set<number>;
  /** 파이널 MVP를 받은 연도 */
  fmvp: Set<number>;
  /** 프로 시즌에 받은 상 (고교·대학 상과 국가대표 메달은 빼요) */
  proAwards: AwardEntry[];
  /** 은퇴했는지. 은퇴해야 정해지는 업적이 있어요. */
  retired: boolean;
  /** 이 브라우저의 모든 커리어(지금 커리어 포함)를 더한 누적 기록 */
  life: LifeView;
}

export interface Achievement {
  id: string;
  name: string;
  /** 달성 조건. 따야 보여요. */
  desc: string;
  /** 따기 전에 보여주는 어렴풋한 힌트 */
  hint: string;
  group: AchievementGroup;
  test: (v: View) => boolean;
  /** 누적 기록 업적의 진행도: 지금 값과 목표. 업적 창이 따기 전에 보여줘요. */
  goal?: { of: (l: LifeView) => number; n: number; unit: string };
  /** 역대 랭킹 업적: 온라인 역대 랭킹에서 이 순위 안에 들면 따요. pos가 있으면 그 포지션 순위예요. */
  rank?: { top: number; pos?: PosKey };
}

const PRO_LEAGUES: LeagueKey[] = ["nba", "euro", "gleague", "kbl"];

const champ = (h: SeasonRecord) => h.pro && h.result === "리그 우승";
const isMvp = (v: View, h: SeasonRecord) => h.pro && v.mvp.has(h.year);
/** 프로 시즌에 그 상(들)을 받은 연도 */
const proYears = (v: View, keys: AwardKey[]) => new Set(v.proAwards.filter((a) => keys.includes(a.k)).map((a) => a.y));
/** 프로 시즌에 그 상을 받은 횟수 */
const proCount = (v: View, k: AwardKey) => v.proAwards.filter((a) => a.k === k).length;
const BENCH = ["벤치", "엔드 오브 벤치"];
const COLLEGE: (LeagueKey | null)[] = ["kuniv", "ncaa"];
/** 고교·대학 전국대회 우승 */
const amateurChamp = (h: SeasonRecord) => !h.pro && h.result === "전국대회 우승";
/** 개인수상 컬렉터: 정규시즌 MVP는 NBA MVP도 쳐요. */
const COLLECTION: AwardKey[][] = [["mip"], ["mvp", "mvp_nba"], ["fmvp"], ["dpoy"], ["sixth"]];

/** 이어진 시즌 가운데 ok를 이어서 만족한 가장 긴 시즌 수. same을 주면 앞 시즌과 같아야 이어져요. */
function longestRun(rows: SeasonRecord[], ok: (h: SeasonRecord) => boolean, same?: (a: SeasonRecord, b: SeasonRecord) => boolean): number {
  let best = 0;
  let run = 0;
  rows.forEach((h, i) => {
    if (!ok(h)) run = 0;
    else run = run > 0 && (!same || same(rows[i - 1], h)) ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

const distinct = (rows: SeasonRecord[]) => new Set(rows.map((h) => h.team)).size;
/** 대표팀에 합류해 딴 금메달. 불참한 대회에서 대표팀이 딴 금메달은 치지 않아요. */
const golds = (c: Career) => c.natLog.filter((t) => t.joined && t.medal === "금");
/** 상점의 사치품 수. 사치품은 한 번씩만 살 수 있어요. */
const LUXURY_COUNT = 5;
/** 능력치 최고값 */
const ATTR_MAX = ATTR_RANGE[1];
/** 능력치마다 최고값(99)을 찍으면 따는 업적: 이름과 힌트 */
const MAXED: Record<AttrKey, [string, string, string]> = {
  sht: ["슛했다 하면 골인", "슛", "던지면 들어가는 경지까지"],
  hdl: ["'볼'아일체", "볼 핸들링", "공이 나고 내가 공인 경지"],
  pas: ["코트 위의 마에스트로", "패스", "보인다 보여. 어디로 줘야할지."],
  def: ["모든 것을 막는 방패", "수비", "아무도 뚫지 못하는 수비"],
  iq: ["농구 도사", "BQ", "농구가 제일 쉬웠어요!"],
  ath: ["휴먼 하이라이트 필름", "운동능력", "코트 위 모든 순간이 Kodak Moment"],
};
/** 상무나 현역으로 입대했는지 (복무 중이거나 전역) */
const enlisted = (c: Career, kind: MilitaryKind) => c.mil.kind === kind && (c.mil.s === "serving" || c.mil.s === "served");
/** 그 형태로 복무를 마치고 돌아온 뒤의 프로 시즌. 복무 시즌이 없으면 빈 목록이에요. */
function afterService(v: View, kind: MilitaryKind): SeasonRecord[] {
  const years = v.c.hist.filter((h) => h.mil === kind).map((h) => h.year);
  return years.length ? v.pro.filter((h) => h.year > Math.max(...years)) : [];
}

/** 그 시즌 정규시즌 순위 (NBA는 컨퍼런스 순위). 시즌 순위표와 같은 순위예요. */
const standingRank = (v: View, h: SeasonRecord) => seasonStandings(v.c, h)?.rank;
/** 플레이오프 첫 시리즈에서 졌는지. KBL 정규리그 1·2위는 4강에 직행해서 4강이 첫 시리즈예요. */
const firstRoundExit = (h: SeasonRecord) =>
  h.result === "플레이오프 1라운드" || h.result === "6강 플레이오프" || (h.lg === "kbl" && h.result === "4강 플레이오프" && h.opps?.length === 1);
/** 정규시즌 전 경기에 나선 시즌 */
const everyGame = (h: SeasonRecord) => !!h.lg && h.gp >= LEAGUES[h.lg].games;
/** 클러치 연속 성공(얼음 심장)·연속 실패(새가슴) 업적의 횟수 */
const CLUTCH_HOT = 8;
const CLUTCH_COLD = 5;
/** 결승전의 사나이: 한 커리어의 결승 클러치 성공 횟수 */
const FINAL_CLUTCH = 10;
/** 역대 랭킹 업적의 순위 */
const RANK_TOP = 10;
/** 포지션별 역대 랭킹 TOP 10 업적: 이름과 힌트 */
const POS_LEGEND: Record<PosKey, [string, string]> = {
  PG: ["야전사령관", "코트 위 모든 공격이 내 손끝에서 시작됐다"],
  SG: ["백코트의 저격수", "어디서든 던지면 꽂히는 슈터의 계보"],
  SF: ["코트 위의 팔방미인", "공격도 수비도, 무엇이든 해내는 포워드"],
  PF: ["페인트존의 투사", "몸싸움이라면 누구에게도 지지 않는 파워"],
  C: ["골밑의 수호신", "림을 지키는 거인의 계보"],
};

/** 히든 스탯 보너스까지 더한 오버롤로 넘어야 하는 값 */
const BEYOND = 100;

/** 누적 기록 업적: 모든 커리어를 더한 값이 목표 이상이면 따요. */
function lifetime(key: string, name: string, hint: string, desc: string, of: (l: LifeView) => number, n: number, unit: string): Achievement {
  return { id: LIFETIME_PREFIX + key, name, hint, desc, group: "lifetime", test: (v) => of(v.life) >= n, goal: { of, n, unit } };
}

export const ACHIEVEMENTS: Achievement[] = [
  // 고교·대학
  {
    id: "hs_king",
    name: "고교 무대 평정",
    desc: "고교 시절 전국대회 우승과 MVP를 모두 차지", hint: "고교 시절, 팀도 나도 정상에",
    group: "school",
    test: (v) => {
      const hs = v.seasons.filter((h) => h.lg === "hs");
      return hs.some(amateurChamp) && hs.some((h) => v.mvp.has(h.year));
    },
  },
  {
    id: "march_madness",
    name: "3월의 광란",
    desc: "NCAA 전국대회 우승", hint: "미국 대학 농구의 봄 축제를 정복하세요",
    group: "school",
    test: (v) => v.seasons.some((h) => h.lg === "ncaa" && amateurChamp(h)),
  },
  {
    id: "campus_legend",
    name: "캠퍼스의 전설",
    desc: "대학(U-리그·NCAA) 시절 MVP 2회 이상", hint: "대학 코트에서 한 번으로는 모자라요",
    group: "school",
    test: (v) => v.seasons.filter((h) => COLLEGE.includes(h.lg) && v.mvp.has(h.year)).length >= 2,
  },
  {
    id: "straight_to_pro",
    name: "고졸 신화",
    desc: "대학을 거치지 않고 프로에 가서 정규시즌 MVP", hint: "학교는 고등학교까지면 충분해요",
    group: "school",
    test: (v) => !v.seasons.some((h) => COLLEGE.includes(h.lg)) && v.pro.some((h) => isMvp(v, h)),
  },
  {
    id: "walk_on",
    name: "워크온의 기적",
    desc: "장학금 없이(워크온) NCAA에 입학해 NBA 진출", hint: "장학금 없이 들어간 곳에서 꿈의 무대까지",
    group: "school",
    test: (v) => v.c.milestones.includes("walkon") && v.pro.some((h) => h.lg === "nba"),
  },

  // 팀·우승
  {
    id: "franchise",
    name: "프랜차이즈 스타",
    desc: "한 팀에서 10시즌 이상 연속으로 뛰기", hint: "한 유니폼을 아주 오래 입어 보세요",
    group: "team",
    test: (v) => longestRun(v.seasons, (h) => h.pro, (a, b) => a.team === b.team) >= 10,
  },
  {
    id: "oneclub",
    name: "원클럽맨",
    desc: "프로 커리어 전체(8시즌 이상)를 한 팀에서만 뛰고 은퇴", hint: "처음 입은 프로 유니폼을 끝까지",
    group: "team",
    test: (v) => v.retired && v.pro.length >= 8 && distinct(v.pro) === 1,
  },
  { id: "journeyman", name: "저니맨", desc: "프로에서 서로 다른 7팀 이상 거치기", hint: "짐을 자주 싸게 될 거예요", group: "team", test: (v) => distinct(v.pro) >= 7 },
  { id: "mercenary", name: "우승청부사", desc: "서로 다른 4팀에서 우승", hint: "가는 팀마다 트로피를 남기세요", group: "team", test: (v) => distinct(v.pro.filter(champ)) >= 4 },
  ...PRO_LEAGUES.map(
    (lg): Achievement => ({
      id: `dynasty_${lg}`,
      name: `${LEAGUES[lg].short} 왕조 건설`,
      desc: `${LEAGUES[lg].short}에서 3시즌 연속 우승`,
      hint: `${LEAGUES[lg].short} 정상을 쉽게 내주지 마세요`,
      group: "team",
      test: (v) => longestRun(v.seasons, (h) => h.lg === lg && champ(h)) >= 3,
    }),
  ),
  { id: "captain", name: "캡틴", desc: "소속팀 주장 완장을 차기", hint: "베테랑이 되면 감독이 먼저 부탁해 올 거예요", group: "team", test: (v) => v.c.milestones.includes("captain") },
  { id: "rings", name: "반지의 제왕", desc: "프로 우승 6회 이상", hint: "손가락이 모자랄 만큼", group: "team", test: (v) => (v.c.awards.ring ?? 0) >= 6 },
  {
    id: "underdog",
    name: "기적의 언더독",
    desc: "정규시즌 승률 5할 미만 팀으로 우승", hint: "아무도 기대하지 않던 팀과 함께",
    group: "team",
    test: (v) => v.pro.some((h) => champ(h) && h.w < h.l),
  },
  {
    id: "royal_road",
    name: "로열 로더",
    desc: "프로에서 처음 오른 결승에서 우승", hint: "첫 큰 무대에서 바로 정상",
    group: "team",
    test: (v) => v.pro.find((h) => h.final)?.final?.win === true,
  },
  {
    id: "bench_to_ring",
    name: "벤치에서 반지까지",
    desc: "프로 데뷔 시즌을 벤치에서 시작해 NBA 우승", hint: "벤치를 데우던 날을 잊지 말고 가장 큰 무대로",
    group: "team",
    test: (v) => BENCH.includes(v.pro[0]?.role ?? "") && v.pro.some((h) => h.lg === "nba" && champ(h)),
  },
  {
    id: "romantic",
    name: "마지막 로맨티스트",
    desc: "NBA에 간 뒤로 한 팀에서만 5시즌 이상 뛰고, 우승 없이 은퇴", hint: "꿈의 무대에서 한 팀만을, 반지가 없더라도",
    group: "team",
    test: (v) => {
      const nba = v.pro.findIndex((h) => h.lg === "nba");
      const after = nba >= 0 ? v.pro.slice(nba) : [];
      return v.retired && after.length >= 5 && distinct(after) === 1 && !(v.c.awards.ring ?? 0);
    },
  },
  {
    id: "runner_up",
    name: "만년 2인자",
    desc: "프로 결승에서 4번 이상 지기", hint: "정상 바로 앞에서 번번이",
    group: "team",
    test: (v) => v.pro.filter((h) => h.final && !h.final.win).length >= 4,
  },
  {
    id: "last_train",
    name: "막차 타고 정상까지",
    desc: "플레이오프에 오르는 마지막 순위(NBA 컨퍼런스 8위·KBL 6위·유로리그·G리그 8위)로 올라가 우승", hint: "턱걸이로 들어간 플레이오프에서 끝까지",
    group: "team",
    test: (v) => v.pro.some((h) => champ(h) && !!PLAYOFF_SPOTS[h.lg!] && standingRank(v, h) === PLAYOFF_SPOTS[h.lg!]),
  },
  {
    id: "first_curse",
    name: "1위의 저주",
    desc: "정규시즌 1위로 마치고 플레이오프 첫 시리즈에서 탈락", hint: "정규시즌의 왕이 봄에는…",
    group: "team",
    test: (v) => v.pro.some((h) => firstRoundExit(h) && standingRank(v, h) === 1),
  },
  {
    id: "bench_keeper",
    name: "벤치의 터줏대감",
    desc: "프로 6시즌 이상 뛰는 동안 식스맨 이상 역할을 한 번도 맡지 못하고 은퇴", hint: "벤치에도 지정석이 있다면",
    group: "team",
    test: (v) => v.retired && v.pro.length >= 6 && v.pro.every((h) => BENCH.includes(h.role) || h.role === "로테이션"),
  },

  // 개인상
  ...PRO_LEAGUES.map(
    (lg): Achievement => ({
      id: `ruler_${lg}`,
      name: `${LEAGUES[lg].short}의 지배자`,
      desc: `${LEAGUES[lg].short}에서 3시즌 연속 MVP`,
      hint: `${LEAGUES[lg].short} 최고의 선수 자리를 지켜내세요`,
      group: "award",
      test: (v) => longestRun(v.seasons, (h) => h.lg === lg && isMvp(v, h)) >= 3,
    }),
  ),
  {
    id: "uncrowned",
    name: "무관의 제왕",
    desc: "MVP 3회 이상, 우승 없이 은퇴", hint: "최고의 선수였지만 반지와는 인연이 없다면",
    group: "award",
    test: (v) => v.retired && v.pro.filter((h) => isMvp(v, h)).length >= 3 && !(v.c.awards.ring ?? 0),
  },
  {
    id: "triple_crown",
    name: "트리플 크라운",
    desc: "한 시즌에 정규시즌 MVP·우승·파이널 MVP를 모두 받기", hint: "한 시즌에 큰 상을 싹쓸이하세요",
    group: "award",
    test: (v) => v.pro.some((h) => isMvp(v, h) && champ(h) && v.fmvp.has(h.year)),
  },
  {
    id: "late_bloomer",
    name: "늦게 핀 꽃",
    desc: "31세 이후에 커리어 첫 MVP", hint: "전성기는 늦게 찾아올 수도 있어요",
    group: "award",
    test: (v) => {
      const first = v.pro.find((h) => isMvp(v, h));
      return !!first && first.age >= 31;
    },
  },
  {
    id: "triple_double",
    name: "시즌 트리플더블",
    desc: "프로 한 시즌 평균 10득점·10리바운드·10어시스트 이상", hint: "세 가지 기록을 모두 두 자릿수로",
    group: "award",
    test: (v) => v.pro.some((h) => h.gp >= 10 && h.pts >= 10 && h.reb >= 10 && h.ast >= 10),
  },
  {
    id: "consistent",
    name: "꾸준함의 대명사",
    desc: "올-NBA 팀이나 다른 리그 베스트5에 7시즌 이상 선정", hint: "해마다 리그 최고의 다섯 명 안에",
    group: "award",
    test: (v) => proYears(v, ["allleague", "allleague2"]).size >= 7,
  },
  {
    id: "supernova",
    name: "초신성의 등장",
    desc: "프로 데뷔 시즌에 신인상과 MVP를 함께 수상", hint: "데뷔하자마자 리그를 뒤흔드세요",
    group: "award",
    test: (v) => {
      const debut = v.pro[0];
      return !!debut && isMvp(v, debut) && proYears(v, ["roy"]).has(debut.year);
    },
  },
  {
    id: "collector",
    name: "개인수상 컬렉터",
    desc: "기량발전상·MVP·파이널 MVP·올해의 수비수·식스맨상을 모두 수상", hint: "트로피 진열장을 종류별로 채우세요",
    group: "award",
    test: (v) => COLLECTION.every((keys) => proYears(v, keys).size > 0),
  },
  {
    id: "scoring_machine",
    name: "무자비한 득점머신",
    desc: "프로 득점왕 7회 이상", hint: "득점 1위를 밥 먹듯이",
    group: "award",
    test: (v) => proCount(v, "scoring") >= 7,
  },
  { id: "rival_killer", name: "라이벌 킬러", desc: "라이벌전에 뛰어 6번 이상 승리", hint: "라이벌만 만나면 더 힘이 나요", group: "award", test: (v) => (v.c.rivalWins ?? 0) >= 6 },
  {
    id: "ageless",
    name: "나이는 숫자에 불과",
    desc: "35세 이상 프로 시즌을 오버롤 92 이상으로 마치기", hint: "30대 중반에도 리그 최정상급 기량을",
    group: "award",
    test: (v) => v.pro.some((h) => h.age >= 35 && h.ovr1 >= 92),
  },
  {
    id: "lone_wolf",
    name: "고군분투",
    desc: "정규시즌 승률 5할 미만 팀에서 정규시즌 MVP", hint: "팀은 졌어도 리그는 나를 봤어요",
    group: "award",
    test: (v) => v.pro.some((h) => isMvp(v, h) && h.w < h.l),
  },
  {
    id: "sixth_rebel",
    name: "식스맨의 반란",
    desc: "식스맨상을 받은 뒤 정규시즌 MVP", hint: "벤치에서 출발해 리그의 주인공으로",
    group: "award",
    test: (v) => {
      const six = v.proAwards.filter((a) => a.k === "sixth").map((a) => a.y);
      return six.length > 0 && v.pro.some((h) => isMvp(v, h) && h.year > Math.min(...six));
    },
  },
  {
    id: "bomber",
    name: "득점 폭격기",
    desc: "프로 한 시즌 평균 40득점 이상", hint: "한 경기에 혼자 40점씩, 시즌 내내",
    group: "award",
    test: (v) => v.pro.some((h) => h.gp >= 10 && h.pts >= 40),
  },
  {
    id: "ironman",
    name: "강철 체력",
    desc: "프로 정규시즌 전 경기 출전 8시즌 이상", hint: "다치지 않는 것도 재능이에요",
    group: "award",
    test: (v) => v.pro.filter(everyGame).length >= 8,
  },

  // 클러치
  { id: "clutch_master", name: "클러치 귀재", desc: "클러치 상황에서 10번 이상 성공", hint: "경기 막판, 마지막 공은 내 손에", group: "clutch", test: (v) => v.c.clutchWins >= 10 },
  {
    id: "ice_heart",
    name: "얼음 심장",
    desc: `클러치 ${CLUTCH_HOT}연속 성공`, hint: "떨리는 순간에도 심장은 차갑게, 한 번도 빠짐없이",
    group: "clutch",
    test: (v) => v.c.clutchStreak >= CLUTCH_HOT,
  },
  {
    id: "chicken_heart",
    name: "새가슴",
    desc: `클러치 ${CLUTCH_COLD}연속 실패 (동점을 만들고 연장에서 진 것도 실패로 쳐요)`, hint: "마지막 공만 잡으면 손이 떨려요",
    group: "clutch",
    test: (v) => v.c.clutchStreak <= -CLUTCH_COLD,
  },
  {
    id: "final_man",
    name: "결승전의 사나이",
    desc: `한 커리어에서 결승 클러치(우승·금메달이 걸린 마지막 플레이) ${FINAL_CLUTCH}번 성공`, hint: "우승이 걸린 마지막 공은 언제나 내 몫",
    group: "clutch",
    test: (v) => v.c.finalClutchWins >= FINAL_CLUTCH,
  },

  // 능력치
  ...ATTR_KEYS.map((k): Achievement => {
    const [name, label, hint] = MAXED[k];
    return { id: `max_${k}`, name, desc: `${label} ${ATTR_MAX} 달성`, hint, group: "ability", test: (v) => v.c.p.attrs[k] >= ATTR_MAX };
  }),
  {
    id: "versatile",
    name: "다재다능 플레이어",
    desc: "능력치 네 가지 이상을 90 이상으로", hint: "한두 가지만 잘해서는 모자라요",
    group: "ability",
    test: (v) => ATTR_KEYS.filter((k) => v.c.p.attrs[k] >= 90).length >= 4,
  },
  {
    id: "beyond",
    name: "한계 돌파",
    desc: `히든 스탯 보너스까지 더한 오버롤 ${BEYOND} 이상`, hint: "숨은 재능까지 더해 한계를 돌파하세요",
    group: "ability",
    test: (v) => evalOvr(v.c.p) >= BEYOND,
  },

  // 드래프트·진로
  {
    id: "first_pick",
    name: "1순위의 무게",
    desc: "NBA 드래프트 전체 1순위로 지명", hint: "드래프트에서 가장 먼저 이름이 불리기",
    group: "path",
    test: (v) => v.c.draft?.lg === "NBA" && v.c.draft.pick === 1,
  },
  {
    id: "cinderella",
    name: "신데렐라 스토리",
    desc: "NBA 드래프트 2라운드 지명이나 미지명으로 시작해 NBA MVP", hint: "늦게 불렸거나 아무도 부르지 않았던 이름으로",
    group: "path",
    test: (v) => (v.c.awards.mvp_nba ?? 0) > 0 && !(v.c.draft?.lg === "NBA" && v.c.draft.round === 1),
  },
  {
    id: "reverse_export",
    name: "역수출 신화",
    desc: "KBL MVP를 받은 뒤 NBA 진출", hint: "국내 리그 최고가 된 뒤 더 큰 무대로",
    group: "path",
    test: (v) => {
      const kblMvp = v.pro.find((h) => h.lg === "kbl" && isMvp(v, h));
      return !!kblMvp && v.pro.some((h) => h.lg === "nba" && h.year > kblMvp.year);
    },
  },
  {
    id: "world_tour",
    name: "월드 투어",
    desc: "KBL·G리그·유로리그·NBA 네 리그를 모두 경험", hint: "여권에 도장을 많이 찍어 보세요",
    group: "path",
    test: (v) => PRO_LEAGUES.every((lg) => v.pro.some((h) => h.lg === lg)),
  },
  {
    id: "homecoming",
    name: "금의환향",
    desc: "NBA에서 뛴 뒤 KBL로 돌아와 우승", hint: "꿈의 무대를 거쳐 고향 코트로",
    group: "path",
    test: (v) => {
      const nba = v.pro.findIndex((h) => h.lg === "nba");
      return nba >= 0 && v.pro.slice(nba + 1).some((h) => h.lg === "kbl" && champ(h));
    },
  },
  {
    id: "thirty_rookie",
    name: "서른 즈음에",
    desc: "30세 이후에 NBA 데뷔", hint: "꿈의 무대는 늦게 밟아도 꿈의 무대",
    group: "path",
    test: (v) => (v.pro.find((h) => h.lg === "nba")?.age ?? 0) >= 30,
  },
  { id: "negotiator", name: "협상의 귀재", desc: "연봉 인상 요구를 5번 이상 관철", hint: "협상 테이블에서 물러서지 마세요", group: "path", test: (v) => v.c.raises >= 5 },

  // 국가대표·커리어
  { id: "patriot", name: "애국자", desc: "국제대회 금메달 3회 이상", hint: "국가대표로 시상대 맨 위에 여러 번", group: "life", test: (v) => golds(v.c).length >= 3 },
  {
    id: "world_cup",
    name: "세계 최강",
    desc: "국가대표로 FIBA 농구 월드컵 금메달", hint: "대표팀과 함께 세계 정상에",
    group: "life",
    test: (v) => golds(v.c).some((t) => t.ev === "worldcup"),
  },
  { id: "national_pillar", name: "국가대표 터줏대감", desc: "국가대표로 50경기 이상 출전", hint: "대표팀 소집에 빠지지 마세요", group: "life", test: (v) => v.c.nat.caps >= 50 },
  {
    id: "grand_slam",
    name: "그랜드슬램",
    desc: "프로 우승, 올림픽 금메달, 월드컵 금메달을 모두 달성", hint: "리그와 세계 무대 모두에서 정상",
    group: "life",
    test: (v) => (v.c.awards.ring ?? 0) > 0 && ["olympics", "worldcup"].every((ev) => golds(v.c).some((t) => t.ev === ev)),
  },
  { id: "forty", name: "불혹의 현역", desc: "40세까지 현역으로 뛰기", hint: "불혹이 되어도 코트 위에", group: "life", test: (v) => v.pro.some((h) => h.age >= 40 && h.gp > 0) },
  {
    id: "luxury",
    name: "사치품 중독자",
    desc: `사치품 ${LUXURY_COUNT}가지를 모두 구입`, hint: "번 돈으로 인생을 즐겨 보세요",
    group: "life",
    test: (v) => v.c.owned.filter((k) => shopItem(k)?.cat === "사치품").length >= LUXURY_COUNT,
  },
  { id: "donor", name: "기부천사", desc: "유소년 농구에 누적 1000억 이상 기부", hint: "유소년 농구에 아낌없이", group: "life", test: (v) => v.c.donated >= 1000 },
  {
    id: "giving_tree",
    name: "아낌없이 주는 나무",
    desc: "커리어 동안 번 돈의 절반 이상(100억 이상)을 유소년 농구에 기부하고 은퇴", hint: "번 것보다 나눈 것으로 기억되고 싶다면",
    group: "life",
    test: (v) => v.retired && v.c.donated >= 100 && v.c.donated * 2 >= v.c.earnings + v.c.spent,
  },

  // 병역: 대한민국 선수만 입대해요.
  { id: "sangmu", name: "국군체육부대 입단", desc: "상무에 입대", hint: "군복을 입고도 코트 위에", group: "military", test: (v) => enlisted(v.c, "sangmu") },
  {
    id: "sangmu_champ",
    name: "불사조 군단",
    desc: "상무에서 D리그 우승", hint: "군인 선수로도 정상에",
    group: "military",
    test: (v) => v.c.hist.some((h) => h.mil === "sangmu" && h.result === "KBL D리그 우승"),
  },
  {
    id: "sangmu_nba",
    name: "군필 NBA리거",
    desc: "상무 전역 뒤 NBA 진출", hint: "군 복무를 마치고 꿈의 무대로",
    group: "military",
    test: (v) => afterService(v, "sangmu").some((h) => h.lg === "nba"),
  },
  { id: "army", name: "대한민국 육군", desc: "현역으로 입대", hint: "18개월 동안 코트 대신 연병장으로", group: "military", test: (v) => enlisted(v.c, "army") },
  {
    id: "army_mvp",
    name: "예비역의 반란",
    desc: "현역 전역 뒤 정규시즌 MVP", hint: "떨어진 감각을 되찾아 리그 최고로",
    group: "military",
    test: (v) => afterService(v, "army").some((h) => isMvp(v, h)),
  },
  {
    id: "army_ring",
    name: "병장 출신 챔피언",
    desc: "현역 전역 뒤 프로 우승", hint: "전역하고 반지까지",
    group: "military",
    test: (v) => afterService(v, "army").some(champ),
  },

  // 역대 랭킹: 은퇴 기록을 온라인 랭킹에 올리고 받은 순위로 따요 (rankAchievements). 엔진은 판정하지 않아요.
  {
    id: "goat",
    name: "나 정도면 GOAT?",
    desc: `온라인 역대 랭킹 전체 TOP ${RANK_TOP} 진입`, hint: "역대 전체 순위표의 맨 윗줄에 이름을",
    group: "rank",
    test: () => false,
    rank: { top: RANK_TOP },
  },
  ...POS_KEYS.map((pos): Achievement => {
    const [name, hint] = POS_LEGEND[pos];
    return { id: `legend_${pos}`, name, hint, desc: `온라인 역대 랭킹 ${POS[pos].name} TOP ${RANK_TOP} 진입`, group: "rank", test: () => false, rank: { top: RANK_TOP, pos } };
  }),

  // 누적 기록: 이 브라우저에서 플레이한 모든 커리어를 더해요.
  lifetime("retire3", "다시 쓰는 농구 인생", "한 번의 농구 인생으로는 모자라요", "모든 커리어 합계 은퇴 3번", (l) => l.t.careers, 3, "번"),
  lifetime("retire10", "농구 인생 10회차", "코트를 떠나고 또 돌아오기를 여러 번", "모든 커리어 합계 은퇴 10번", (l) => l.t.careers, 10, "번"),
  lifetime("seasons", "100시즌의 추억", "시즌을 쌓고 또 쌓아 보세요", "모든 커리어 합계 프로 100시즌", (l) => l.t.seasons, 100, "시즌"),
  lifetime("games", "3000경기의 땀방울", "여러 커리어에 걸쳐 코트를 누비세요", "모든 커리어 합계 프로 3000경기 출전", (l) => l.t.gp, 3000, "경기"),
  lifetime("points", "5만 득점의 손끝", "여러 커리어의 득점을 모아 보세요", "모든 커리어 합계 프로 50,000득점", (l) => l.t.pts, 50000, "점"),
  lifetime("rings", "반지 보관함", "커리어마다 반지를 모아 보세요", "모든 커리어 합계 프로 우승 20회", (l) => l.t.rings, 20, "회"),
  lifetime("mvp", "MVP 제조기", "누구로 뛰든 리그 최고의 선수로", "모든 커리어 합계 정규시즌 MVP 15회", (l) => l.t.mvp, 15, "회"),
  lifetime("earn", "누적 연봉 3000억", "여러 커리어에 걸쳐 차곡차곡", "모든 커리어 합계 3000억 벌기", (l) => l.t.earn, 3000, "억"),
  lifetime("nba", "NBA 단골손님", "꿈의 무대에 여러 번 서 보세요", "NBA를 밟은 커리어 5번", (l) => l.t.nba, 5, "번"),
  lifetime("clutch", "강심장 유전자", "누구로 뛰든 마지막 공은 내 손에", "모든 커리어 합계 클러치 성공 50번", (l) => l.t.clutch, 50, "번"),
  lifetime("positions", "포지션 마스터", "한 포지션만 고집하지 마세요", "다섯 포지션 모두 프로 무대 밟기", (l) => l.t.pos.length, 5, "포지션"),
  lifetime("nations", "국경 없는 농구", "다른 나라 선수로도 뛰어 보세요", "서로 다른 국적 3가지로 프로 무대 밟기", (l) => l.t.nats.length, 3, "국적"),
  lifetime(
    "allround", "올-어라운드 플레이어", "어느 포지션으로 뛰든 꿈의 무대 정상에",
    "다섯 포지션 모두, 한 커리어에서 NBA 우승·NBA MVP·NBA 파이널 MVP를 모두 받기", (l) => l.t.allround.length, 5, "포지션",
  ),
  lifetime("hunter", "업적 사냥꾼", "업적 창을 차근차근 채워 보세요", "업적 30개 달성", (l) => l.achv, 30, "개"),
];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/** id로 업적을 찾아요. 없어진 업적이면 undefined예요. */
export const achievementById = (id: string): Achievement | undefined => BY_ID.get(id);

/** 온라인 역대 랭킹 순위로 따는 역대 랭킹 업적 id. pos는 그 커리어의 포지션, posRank는 그 포지션 안의 순위예요. */
export function rankAchievements(r: { pos: PosKey; rank: number; posRank: number }): string[] {
  return ACHIEVEMENTS.filter((a) => a.rank && (a.rank.pos ? a.rank.pos === r.pos && r.posRank <= a.rank.top : r.rank <= a.rank.top)).map((a) => a.id);
}

function viewOf(c: Career, b: BrowserRecord): View {
  const years = (keys: string[]) => new Set(c.awardLog.filter((a) => keys.includes(a.k)).map((a) => a.y));
  const seasons = c.hist.filter((h) => !h.mil);
  const pro = seasons.filter((h) => h.pro && h.lg);
  const proSeasonYears = new Set(pro.map((h) => h.year));
  return {
    c,
    seasons,
    pro,
    mvp: years(["mvp", "mvp_nba"]),
    fmvp: years(["fmvp"]),
    proAwards: c.awardLog.filter((a) => proSeasonYears.has(a.y) && a.k !== "nat_gold"),
    retired: c.stage === "retired",
    life: {
      t: addLifetime(b.others, b.start ? subLifetime(fromCareer(c), b.start) : fromCareer(c)),
      achv: b.recent + c.achv.filter((id) => !b.unlocked.has(id)).length,
    },
  };
}

/**
 * 새로 딴 업적을 c.achv에 남기고 그 id를 돌려줘요. 소식을 남기고, 은퇴 전이면 축하 팝업도 띄워요.
 * 이 브라우저에서 이미 딴 업적은 건너뛰어요. 업적 수를 세는 업적이 있어서, 새로 딴 게 없을 때까지 다시 봐요.
 * 시즌을 마칠 때, 결정을 고른 뒤(국가대표 대회 등), 은퇴할 때 불러요.
 */
export function checkAchievements(c: Career): string[] {
  const b = browserRecord(c);
  const all: Achievement[] = [];
  for (;;) {
    const v = viewOf(c, b);
    const got = ACHIEVEMENTS.filter((a) => !c.achv.includes(a.id) && !b.unlocked.has(a.id) && a.test(v));
    if (!got.length) break;
    for (const a of got) {
      c.achv.push(a.id);
      addNews(c, `${c.year - 1} 시즌`, "big", `업적 달성 · ${a.name}! ${a.desc}`);
      if (!v.retired) cheer(c, { kind: "achv", title: a.name, sub: a.desc, year: c.year - 1, color: c.team?.color ?? null });
    }
    all.push(...got);
  }
  return all.map((a) => a.id);
}
