import { seededPick } from "../core/random";
import { LEAGUES } from "../world/leagues";
import type { AwardKey, Career, LeagueKey, Role, SeasonRecord } from "../core/types";
import { josa, r1 } from "../core/util";

/*
 * 시즌 결산의 농구 커뮤니티 반응: 국내 커뮤니티와 해외 포럼(번역)에 달린 댓글.
 * 실제 커뮤니티 이름(디시인사이드, 에펨코리아, MLBPARK, 레딧, RealGM)을 빌려 오고, 커뮤니티마다 댓글 묶음을 따로 둬서
 * 그곳의 말투(디시 갤러리의 짧은 반말과 비꼼, 에펨의 감탄사와 밈, 엠팍의 존댓말, 레딧 밈, RealGM 스카우팅 말투)와
 * 닉네임 모양·추천 표시를 흉내 내요. 해외 포럼(레딧·RealGM)은 영어 원문으로 달리고, 선수 이름은 영어식으로 바꿔요.
 * 실제 글은 말투를 참고만 했고, 댓글은 모두 새로 지은 가상의 반응이에요.
 * 리그·소속팀·성적·수상·팀 성적·나이·성장 같은 상황에 맞는 댓글을 고르고, 가상의 닉네임과 추천 수를 붙여요.
 * 커리어와 시즌으로 난수를 정해서 같은 시즌은 다시 열어도 같은 댓글이에요.
 */

/** 댓글 분위기: 칭찬, 비판, 아쉬움·중립, 농담·도발 */
export type CommentMood = "up" | "down" | "meh" | "lol";

export interface CommunityComment {
  nick: string;
  text: string;
  likes: number;
  mood: CommentMood;
  /** 추천을 많이 받은 베스트 댓글 */
  best?: boolean;
}

/** 커뮤니티 말투: 닉네임 모양과 추천 표시가 달라요. */
export type SiteStyle = "dc" | "fm" | "mlbpark" | "reddit" | "realgm";

export interface CommunityBoard {
  kind: "domestic" | "overseas";
  /** 커뮤니티와 게시판 이름 */
  site: string;
  style: SiteStyle;
  /** 추천 수 앞에 붙는 말 (추천, ▲, And1) */
  upLabel: string;
  title: string;
  views: number;
  /** 게시글에 달린 전체 댓글 수 (보여주는 건 그중 몇 개) */
  total: number;
  comments: CommunityComment[];
}

/** 시즌 평가 단계: 0 실망, 1 아쉬움, 2 준수, 3 훌륭, 4 리그 지배 */
type Tier = 0 | 1 | 2 | 3 | 4;

interface Ctx {
  name: string;
  /** 영어 댓글에 쓰는 이름 (김농구 → Nong-gu Kim) */
  ename: string;
  /** 영어 리그 이름 */
  elg: string;
  team: string;
  /** 팀 이름의 마지막 낱말 (셀틱스, 나이츠) */
  nick: string;
  lg: LeagueKey;
  lgName: string;
  year: number;
  pts: string;
  reb: string;
  ast: string;
  rating: string;
  tpp: number;
  age: number;
  role: Role | "-";
  tier: Tier;
  awards: Set<AwardKey>;
  champ: boolean;
  finalLoss: boolean;
  missed: boolean;
  korean: boolean;
  injured: boolean;
  three: boolean;
  growth: number;
  /** 프로 첫 시즌 */
  debut: boolean;
  /** NBA에서 뛰는데 KBL을 거쳤어요 */
  fromKbl: boolean;
  bench: boolean;
}

interface Line {
  t: string;
  mood: CommentMood;
  when?: (x: Ctx) => boolean;
}

/** 커뮤니티 하나의 말투: 상황 댓글, 성적 댓글, 농담·밈 댓글, 게시글 제목 */
interface Voice {
  event: Line[];
  tier: Line[];
  lol: Line[];
  /** 게시글 제목 후보. 같은 성적이 이어져도 제목이 바뀌게 여럿이에요. */
  title: Record<Tier, string[]>;
  champTitle: string[];
}

const has = (...keys: AwardKey[]) => (x: Ctx) => keys.some((k) => x.awards.has(k));
const tier = (...ts: Tier[]) => (x: Ctx) => ts.includes(x.tier);
const nba = (x: Ctx) => x.lg === "nba";
const abroad = (x: Ctx) => x.lg === "nba" || x.lg === "euro" || x.lg === "gleague" || x.lg === "ncaa";
const pro = (x: Ctx) => LEAGUES[x.lg].pro;
const koreanAbroad = (x: Ctx) => x.korean && abroad(x);
const young = (x: Ctx) => x.age <= 21 && pro(x);
const old = (x: Ctx) => x.age >= 34;
const MVP = has("mvp", "mvp_nba");

/* ---------- 디시인사이드: 짧은 반말, 비꼼과 인정 사이, 실화임?·지배자·팀빨·느바 ---------- */

const DC: Voice = {
  event: [
    { t: "우승했으니 일단 인정한다 ㅋㅋ", mood: "up", when: (x) => x.champ },
    { t: "반지 꼈으면 이제 아무도 못 깜", mood: "up", when: (x) => x.champ },
    { t: "팀빨이라던 놈들 다 어디 감?", mood: "lol", when: (x) => x.champ },
    { t: "결승에서 쫄았네 ㅋㅋ 큰 경기 체질은 아닌 듯", mood: "down", when: (x) => x.finalLoss },
    { t: "준우승이면 잘한 거 아님? 여기 기준이 이상함", mood: "meh", when: (x) => x.finalLoss },
    { t: "플옵도 못 갔는데 개인 기록이 무슨 의미임", mood: "down", when: (x) => x.missed },
    { t: "{nick} 프런트가 문제지 얘는 할 만큼 했음", mood: "meh", when: (x) => x.missed && x.tier >= 2 },
    { t: "MVP는 인정. 반박하는 놈은 경기 안 본 거", mood: "up", when: MVP },
    { t: "{name} MVP 실화임?", mood: "up", when: MVP },
    { t: "파엠은 진짜임. 큰 경기에서 증명했잖아", mood: "up", when: has("fmvp") },
    { t: "신인왕은 걍 원툴이었음", mood: "up", when: has("roy") },
    { t: "득점왕 ㅋㅋ 공 혼자 다 들고 있으면 누가 못 함", mood: "lol", when: has("scoring") },
    { t: "수비 하나는 인정. 공격은 모르겠고", mood: "meh", when: has("dpoy") },
    { t: "올스타가 인기투표지 뭐 ㅋㅋ", mood: "lol", when: has("allstar") },
    { t: "올느바 들어갈 만했음", mood: "up", when: (x) => nba(x) && x.awards.has("allleague") },
    { t: "한국인이 느바에서 이 정도면 걍 국보임", mood: "up", when: (x) => x.korean && nba(x) && x.tier >= 2 },
    { t: "새벽마다 {name} 보는 맛에 산다", mood: "up", when: (x) => koreanAbroad(x) && x.tier >= 2 },
    { t: "느바에서 버티는 것만 해도 어디냐", mood: "meh", when: (x) => x.korean && nba(x) && x.tier <= 1 },
    { t: "작년이랑 완전 다른 놈인데 뭐 먹었냐", mood: "up", when: (x) => x.growth >= 4 },
    { t: "에이징 커브 왔네 ㅋㅋ", mood: "down", when: (x) => x.growth <= -2 },
    { t: "또 부상이냐 유리몸 ㅋㅋ", mood: "down", when: (x) => x.injured },
    { t: "3점 {tpp}%? 이제 슈터라고 불러도 됨", mood: "up", when: (x) => x.three },
    { t: "{age}살에 이 스탯이면 나중에 고트 논쟁 낌", mood: "up", when: (x) => young(x) && x.tier >= 3 },
    { t: "{age}살 할배가 아직도 이걸 하네 ㄷ", mood: "up", when: (x) => old(x) && x.tier >= 2 },
    { t: "{age}살이면 이제 은퇴각 재야지", mood: "down", when: (x) => old(x) && x.tier <= 1 },
    { t: "루키 시즌에 이 정도면 됐지", mood: "up", when: (x) => x.debut && x.tier >= 2 },
    { t: "고딩 스탯 실화임?", mood: "up", when: (x) => x.lg === "hs" && x.tier >= 3 },
    { t: "벤치에서 수건만 흔든 시즌 ㅋㅋ", mood: "lol", when: (x) => x.bench },
    { t: "우승 반지 끼고 나니까 말투부터 달라짐 ㅋㅋ", mood: "lol", when: (x) => x.champ },
    { t: "파엠 아니어도 우승 지분은 인정", mood: "up", when: (x) => x.champ && !x.awards.has("fmvp") },
    { t: "결승에서 이 정도 했으면 진 건 팀 탓임", mood: "meh", when: (x) => x.finalLoss && x.tier >= 3 },
    { t: "플옵 탈락인데 댓글 왜 이렇게 많음 ㅋㅋ", mood: "lol", when: (x) => x.missed },
    { t: "득점왕인데 팀은 플옵 탈락 ㅋㅋ 전형적임", mood: "down", when: (x) => x.awards.has("scoring") && x.missed },
    { t: "신인왕 다음 해 2년차 징크스 국룰인데 어떻게 되나 보자", mood: "lol", when: has("roy") },
    { t: "수비왕 받는 거 쉬운 거 아님. 이건 인정", mood: "up", when: has("dpoy") },
    { t: "식스맨상 받을 거면 그냥 주전 시켜라", mood: "meh", when: has("sixth") },
    { t: "느바 중계에서 한국 이름 듣는 날이 오네", mood: "up", when: (x) => x.korean && nba(x) && x.tier >= 2 },
    { t: "유로리그가 동네 리그인 줄 아는 놈들 많네. 거기서 이 정도면 대단한 거임", mood: "up", when: (x) => x.lg === "euro" && x.tier >= 2 },
    { t: "지리그에서 이러면 콜업 가야 되는 거 아님?", mood: "meh", when: (x) => x.lg === "gleague" && x.tier >= 2 },
    { t: "NCAA에서 이 정도면 로터리 각 아님?", mood: "up", when: (x) => x.lg === "ncaa" && x.tier >= 3 },
    { t: "대딩이 저 스탯이면 바로 프로 가야지", mood: "up", when: (x) => x.lg === "kuniv" && x.tier >= 3 },
    { t: "부상 복귀하고 바로 이 정도면 ㄹㅇ 괴물", mood: "up", when: (x) => x.injured && x.tier >= 3 },
    { t: "3점 {tpp}%면 그냥 서서 쏘게 두면 안 됨", mood: "up", when: (x) => x.three },
    { t: "벤치에서 나와서 이 정도면 식스맨상 줘라", mood: "up", when: (x) => x.bench && x.tier >= 2 },
  ],
  tier: [
    { t: "{name} 이번 시즌 {lg} 지배자 맞음", mood: "up", when: tier(4) },
    { t: "평균 {pts}점 실화임?", mood: "up", when: tier(4) },
    { t: "이 스탯으로 MVP 못 받으면 리그가 이상한 거", mood: "up", when: (x) => x.tier === 4 && !MVP(x) },
    { t: "{pts}/{reb}/{ast}면 할 말 없음", mood: "up", when: tier(3, 4) },
    { t: "이 정도면 팀 1옵션 인정", mood: "up", when: tier(3) },
    { t: "까던 놈들 다 조용해졌네 ㅋㅋ", mood: "lol", when: tier(3, 4) },
    { t: "딱 밥값 했음", mood: "meh", when: tier(2) },
    { t: "나쁘진 않은데 그렇다고 대단하지도 않음", mood: "meh", when: tier(2) },
    { t: "평점 {rating}이면 쏘쏘", mood: "meh", when: tier(2) },
    { t: "작년보다 확실히 아쉬움", mood: "down", when: tier(1) },
    { t: "기복 오짐 ㅋㅋ 되는 날만 됨", mood: "down", when: tier(1) },
    { t: "이름값 못 하네", mood: "down", when: tier(1, 0) },
    { t: "이 정도면 걍 벤치 가야 됨", mood: "down", when: tier(0) },
    { t: "{name} 나오는 날은 걍 채널 돌림", mood: "down", when: tier(0) },
    { t: "이게 프로냐 ㅋㅋ", mood: "down", when: (x) => x.tier === 0 && pro(x) },
    { t: "혼자 다른 게임 하는 중 ㅋㅋ", mood: "up", when: tier(4) },
    { t: "상대 팀 팬인데 이건 인정할 수밖에 없음", mood: "up", when: tier(4) },
    { t: "{lg} 역사 다시 쓰는 중임", mood: "up", when: tier(4) },
    { t: "에이스 맞네 이 정도면", mood: "up", when: tier(3) },
    { t: "올해 {lg}에서 다섯 손가락 안에는 듦", mood: "up", when: tier(3) },
    { t: "스탯 보고 다시 봄. 생각보다 잘함", mood: "up", when: tier(3) },
    { t: "욕할 정도는 아님", mood: "meh", when: tier(2) },
    { t: "딱 중박", mood: "meh", when: tier(2) },
    { t: "이 정도면 계약값은 함", mood: "meh", when: tier(2) },
    { t: "작년 폼 어디 감?", mood: "down", when: tier(1) },
    { t: "기대치가 높아서 그렇지 못한 건 아님", mood: "meh", when: tier(1) },
    { t: "슬슬 내려오는 거 아니냐", mood: "down", when: tier(1) },
    { t: "이 팀에 왜 있는지 모르겠음", mood: "down", when: tier(0) },
    { t: "트레이드 매물 1순위 ㅋㅋ", mood: "down", when: tier(0) },
    { t: "경기 보다가 한숨만 나옴", mood: "down", when: tier(0) },
    { t: "{lg}에서 상대 팀이 제일 먼저 막는 선수가 됨", mood: "up", when: tier(3, 4) },
    { t: "스탯도 스탯인데 경기 보면 더 잘함", mood: "up", when: tier(3, 4) },
    { t: "{name} 없으면 이 팀 플옵도 못 감", mood: "up", when: (x) => x.tier >= 3 && !x.missed },
    { t: "꾸준한 게 제일 어려운 건데 그걸 함", mood: "up", when: tier(2, 3) },
    { t: "팀에 꼭 필요한 선수인 건 맞음", mood: "meh", when: tier(2, 3) },
    { t: "올해 못한 건 아님. 더 잘할 수 있을 뿐", mood: "meh", when: tier(2, 3) },
    { t: "잘한 경기만 보면 올스타인데 못한 경기가 너무 많음", mood: "meh", when: tier(1, 2) },
    { t: "평균은 하는데 임팩트가 없음", mood: "meh", when: tier(1, 2) },
    { t: "한 끗이 모자람", mood: "meh", when: tier(1, 2) },
    { t: "경기 보는 내 눈이 아픔", mood: "down", when: tier(0, 1) },
    { t: "계약 끝나면 안 잡을 듯", mood: "down", when: tier(0, 1) },
    { t: "솔직히 올해는 변명거리 없음", mood: "down", when: tier(0, 1) },
    { t: "그냥 무난. 끝", mood: "meh", when: tier(2) },
    { t: "욕먹을 시즌은 아님", mood: "meh", when: tier(2) },
  ],
  lol: [
    { t: "{name} 까던 놈들 다 어디 갔냐 ㅋㅋ", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "또 {name} 글이냐 갤 주인 바뀜?", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "팀갤 터져서 여기로 피난 옴", mood: "lol", when: (x) => x.missed || x.tier <= 1 },
    { t: "역대 {lg} 순위 매겨 봄 {name} 몇 위임?", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "이번 시즌 볼만했음? 나 하이라이트만 봄", mood: "lol" },
    { t: "직관 갔는데 하필 그날 결장함 ㅠ", mood: "lol", when: (x) => x.injured || x.bench },
    { t: "개념글 가자 ㅋㅋ", mood: "lol", when: (x) => x.tier >= 3 || x.champ },
    { t: "{name} 팬 아닌데 글마다 들어오게 됨", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "스탯만 보면 갓인데 경기 보면 또 다름 ㅋㅋ", mood: "lol", when: tier(2) },
    { t: "이 글 보고 하이라이트 돌려 봄 ㄹㅇ 잘함", mood: "lol", when: (x) => x.tier >= 2 },
    { t: "우리 팀으로 데려와라 (팀명은 비밀)", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "올해 {lg} 볼 게 {name}밖에 없었음", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "댓글 수준 보니까 팬이 아니라 안티인 줄 ㅋㅋ", mood: "lol", when: (x) => x.tier <= 1 },
    { t: "다음 시즌 예측: 또 이 정도", mood: "lol", when: tier(2) },
  ],
  title: {
    4: ["{name} 이번 시즌 {lg} 지배자임", "{name} 스탯 보고 옴 이거 실화냐", "{lg} 올해 1황은 {name}임"],
    3: ["{name} 올해 스탯 실화임?", "{name} 이번 시즌 평가 좀", "{name} 올해 이 정도면 잘한 거 맞지?"],
    2: ["{name} 이번 시즌 평가 해 봄", "{name} 올해 어땠음?", "{name} 시즌 끝났는데 한 줄 평"],
    1: ["{name} 작년이랑 비교하면 어떰?", "{name} 폼 떨어진 거 맞지?", "{name} 왜 작년만 못함?"],
    0: ["{name} 개못하네 ㅋㅋ", "{name} 이대로 가면 어떻게 됨?", "{name} 보고 있으면 화남"],
  },
  champTitle: ["{nick} 우승했는데 {name} 지분 몇 퍼임?", "우승 반지 낀 {name} 이제 어디까지 감?", "{nick} 우승 ㅋㅋㅋ {name} 커리어 하이"],
};

/* ---------- 에펨코리아: 감탄사(ㄷㄷㄷ·ㅁㅊ), 외계인·지구 평평 밈, MVP 주쇼, 효율 보소, 퇴근 ---------- */

const FM: Voice = {
  event: [
    { t: "우승 ㅁㅊ ㅋㅋㅋ {nick}붕이들 오늘 잠 못 잔다", mood: "up", when: (x) => x.champ },
    { t: "반지 축하 ㄷㄷ 이건 인정이지", mood: "up", when: (x) => x.champ },
    { t: "준우승 아깝다 ㅠ 마지막에 체력이 바닥났음", mood: "meh", when: (x) => x.finalLoss },
    { t: "플옵 못 간 건 진짜 에바임 ㅠ", mood: "down", when: (x) => x.missed },
    { t: "MVP 주쇼 했는데 진짜 줬네 ㅋㅋ", mood: "up", when: MVP },
    { t: "진짜 외계인 아닐까", mood: "up", when: MVP },
    { t: "파이널에서 하는 거 보고 소름 돋았음", mood: "up", when: has("fmvp") },
    { t: "신인왕 ㄷㄷ 떡잎부터 다름", mood: "up", when: has("roy") },
    { t: "득점왕 효율 보소 ㅋㅋㅋ 지린다", mood: "up", when: has("scoring") },
    { t: "수비 구라 안 치고 진짜 좋아짐", mood: "up", when: has("dpoy") },
    { t: "작년만 해도 수비는 조상님이 해 주겠지 마인드였는데 ㅋㅋ", mood: "lol", when: (x) => x.awards.has("dpoy") || x.growth >= 4 },
    { t: "올스타 ㅊㅊ 이제 리그 간판이네", mood: "up", when: has("allstar") },
    { t: "한국인이 느바에서 {pts}점 ㄷㄷㄷ 국뽕 차오름", mood: "up", when: (x) => x.korean && nba(x) && x.tier >= 2 },
    { t: "느바에서 살아남는 것만 해도 대단함", mood: "meh", when: (x) => x.korean && nba(x) && x.tier <= 1 },
    { t: "콜업 언제 되냐 ㅠ 기다리다 목 빠짐", mood: "meh", when: (x) => x.korean && (x.lg === "gleague" || x.lg === "euro") },
    { t: "스텝이나 집중력이 그냥 작년이랑 다름", mood: "up", when: (x) => x.growth >= 4 },
    { t: "부상만 아니었으면 ㅠ 몸 관리 잘하자", mood: "meh", when: (x) => x.injured },
    { t: "3점 {tpp}% ㅁㅊ 슈터 다 됐네", mood: "up", when: (x) => x.three },
    { t: "{age}살이 이러면 반칙 아님?", mood: "up", when: (x) => young(x) && x.tier >= 3 },
    { t: "{age}살에 이 폼이면 자기관리 GOAT", mood: "up", when: (x) => old(x) && x.tier >= 2 },
    { t: "루키 시즌 이 정도면 합격 ㅇㅈ", mood: "up", when: (x) => x.debut && x.tier >= 2 },
    { t: "출전 시간 좀 줘라 감독아 ㅠ", mood: "meh", when: (x) => x.bench },
    { t: "우승 반지 ㄷㄷ 이제 누가 뭐래도 레전드 코스", mood: "up", when: (x) => x.champ },
    { t: "결승에서 진 건 아쉬운데 시즌 자체는 역대급이었음", mood: "meh", when: (x) => x.finalLoss && x.tier >= 3 },
    { t: "플옵 탈락 ㅠ 내년엔 좀 보강해라 프런트야", mood: "meh", when: (x) => x.missed },
    { t: "MVP 트로피 들고 있는 거 보니까 울컥함", mood: "up", when: MVP },
    { t: "파엠 ㅁㅊ 결승에서 미친 거 아니냐", mood: "up", when: has("fmvp") },
    { t: "신인이 이 정도면 2년차 때 뭐가 되는 거임 ㄷㄷ", mood: "up", when: has("roy") },
    { t: "득점왕 ㄷㄷㄷ 매일 30점 찍는 거 실화냐", mood: "up", when: has("scoring") },
    { t: "식스맨 이 정도면 주전 줘라 ㅋㅋ", mood: "lol", when: has("sixth") },
    { t: "올-디펜스 ㅇㅈ 손이 그냥 다름", mood: "up", when: has("alldef") },
    { t: "느바 중계에서 한국 이름 나오는 거 아직도 안 익숙함 ㅋㅋ", mood: "lol", when: (x) => x.korean && nba(x) },
    { t: "유로리그에서 이 정도면 NBA 팀들 뭐 하냐 ㄹㅇ", mood: "up", when: (x) => x.lg === "euro" && x.tier >= 2 },
    { t: "NCAA 하이라이트 보는데 혼자 다른 게임 함 ㄷㄷ", mood: "up", when: (x) => x.lg === "ncaa" && x.tier >= 3 },
    { t: "부상 복귀하고 이 폼이면 진짜 ㅁㅊ", mood: "up", when: (x) => x.injured && x.tier >= 3 },
    { t: "{age}살인데 벌써 이러면 커리어 끝엔 뭐가 돼 있을까", mood: "up", when: (x) => young(x) && x.tier >= 3 },
    { t: "{age}살 폼이 아님 ㄷㄷ 뭐 먹음?", mood: "up", when: (x) => old(x) && x.tier >= 2 },
    { t: "루키가 벌써 클러치 맡는 거 보니까 ㄷㄷ", mood: "up", when: (x) => x.debut && x.tier >= 3 },
  ],
  tier: [
    { t: "오늘도 지구는 평평하다 ㅋㅋㅋ 스탯이 말이 안 됨", mood: "up", when: tier(4) },
    { t: "평균 {pts}점 ㄷㄷㄷㄷ", mood: "up", when: tier(4) },
    { t: "이 정도면 MVP 주쇼", mood: "up", when: (x) => x.tier === 4 && !MVP(x) },
    { t: "{pts}/{reb}/{ast} 효율 보소 ㅋㅋ", mood: "up", when: tier(3, 4) },
    { t: "빡겜 뛰는 거 보니까 좋다", mood: "up", when: tier(3) },
    { t: "1옵션 스탯 이 정도면 ㅇㅈ", mood: "up", when: tier(3) },
    { t: "무난무난 ㅇㅈ", mood: "meh", when: tier(2) },
    { t: "평점 {rating}이면 준수하지", mood: "up", when: tier(2) },
    { t: "기복만 줄이면 내년에 터질 듯", mood: "meh", when: tier(2, 1) },
    { t: "올해는 좀 에바였음", mood: "down", when: tier(1) },
    { t: "폼 언제 돌아오냐 ㅠ", mood: "down", when: tier(1, 0) },
    { t: "보여준 게 있으니 기다려 봄", mood: "meh", when: tier(1) },
    { t: "이건 좀... 할 말이 없네", mood: "down", when: tier(0) },
    { t: "평점 {rating} 실화?", mood: "down", when: tier(0) },
    { t: "이 정도면 리그 버그임 ㅋㅋㅋ", mood: "up", when: tier(4) },
    { t: "매 경기 하이라이트 ㅁㅊ", mood: "up", when: tier(4) },
    { t: "스탯 보고 세 번 다시 봄", mood: "up", when: tier(4) },
    { t: "올스타 확정이지 이 정도면", mood: "up", when: tier(3) },
    { t: "효율까지 좋아서 더 ㅁㅊ", mood: "up", when: tier(3) },
    { t: "올해 {lg} 재미는 {name}이 다 책임짐", mood: "up", when: tier(3) },
    { t: "딱 제 몫 ㅇㅈ", mood: "meh", when: tier(2) },
    { t: "나쁘지 않음. 근데 더 할 수 있는 선수임", mood: "meh", when: tier(2) },
    { t: "평타는 침", mood: "meh", when: tier(2) },
    { t: "폼 떨어진 거 눈에 보임 ㅠ", mood: "down", when: tier(1) },
    { t: "작년 폼 돌려줘 ㅠㅠ", mood: "down", when: tier(1) },
    { t: "기대가 커서 더 아쉬움", mood: "meh", when: tier(1) },
    { t: "이건 변명이 안 됨", mood: "down", when: tier(0) },
    { t: "시즌 내내 퇴근 모드였음", mood: "down", when: tier(0) },
    { t: "이러면 로테이션에서 빠져도 할 말 없음", mood: "down", when: tier(0) },
    { t: "하이라이트가 매일 올라옴 ㅋㅋ", mood: "up", when: tier(3, 4) },
    { t: "이 선수 있는 팀이 부럽다 ㄹㅇ", mood: "up", when: tier(3, 4) },
    { t: "상대 팀 입장에선 재앙임", mood: "up", when: tier(3, 4) },
    { t: "꾸준함 ㅇㅈ 이게 제일 어려움", mood: "up", when: tier(2, 3) },
    { t: "팀에 없으면 안 되는 선수", mood: "up", when: tier(2, 3) },
    { t: "조용히 잘하는 타입", mood: "meh", when: tier(2, 3) },
    { t: "잘할 땐 ㅁㅊ는데 못할 땐 진짜 못함", mood: "meh", when: tier(1, 2) },
    { t: "평균은 하는데 임팩트가 ㅠ", mood: "meh", when: tier(1, 2) },
    { t: "뭔가 2% 부족", mood: "meh", when: tier(1, 2) },
    { t: "이 폼으로는 벤치 ㅇㅈ", mood: "down", when: tier(0, 1) },
    { t: "보는 내가 다 답답함", mood: "down", when: tier(0, 1) },
    { t: "올해는 그냥 넘어가자 ㅠ", mood: "meh", when: tier(0, 1) },
    { t: "무난 그 자체", mood: "meh", when: tier(2) },
    { t: "작년이랑 비슷비슷", mood: "meh", when: tier(2) },
  ],
  lol: [
    { t: "{name} 덕분에 {nick}붕이 됨", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "퇴근하려나? 했는데 4쿼터에 또 나와서 다 털고 감 ㅋㅋ", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "이거 스탯 조작 아니냐 ㅋㅋ 숫자가 이상함", mood: "lol", when: tier(4) },
    { t: "비추 누른 사람 나와 ㅋㅋ", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "{nick} 경기는 내 정신 건강에 안 좋음", mood: "lol", when: (x) => x.missed || x.tier <= 1 },
    { t: "매일 퇴근하는 줄 알았는데 진짜 퇴근이었네", mood: "lol", when: (x) => x.tier === 0 },
    { t: "포텐 가자 ㅋㅋㅋ", mood: "lol", when: (x) => x.tier >= 3 || x.champ },
    { t: "하이라이트만 봐도 밥 한 공기 뚝딱", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "이 글 포텐 안 가면 펨코 아님", mood: "lol", when: (x) => x.tier >= 3 || x.champ },
    { t: "역시 믿고 보는 {name}", mood: "lol", when: (x) => x.tier >= 2 },
    { t: "오늘도 평화로운 농게", mood: "lol" },
    { t: "판타지에서 이 선수 1픽한 내가 승자 ㅋㅋ", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "경기 안 보고 스탯만 봄 ㅈㅅ", mood: "lol" },
    { t: "{nick}붕이들 올해도 고생했다 ㅠ", mood: "lol", when: (x) => x.missed || x.tier <= 1 },
  ],
  title: {
    4: ["{name} 시즌 스탯 ㄷㄷㄷㄷ", "{name} 이번 시즌 그냥 미쳤음 ㅁㅊ", "{name} 올해 그냥 {lg} 최종보스였음"],
    3: ["{name} 이번 시즌 정리 ㅁㅊ", "{name} 올해 효율 보소 ㄷㄷ", "{name} 올 시즌 스탯 정리"],
    2: ["{name} 이번 시즌 무난했네", "{name} 올 시즌 어땠냐", "{name} 이번 시즌 한 줄 평 ㄱㄱ"],
    1: ["{name} 올해 왜 이럼?", "{name} 폼 어디 갔냐 ㅠ", "{name} 작년 폼 어디 감"],
    0: ["{name} 이대로 괜찮나...", "{name} 시즌 내내 퇴근 ㅠ", "{name} 올해 뭐 함?"],
  },
  champTitle: ["{nick} 우승 ㅁㅊ ㅋㅋㅋ", "{nick} 우승!!! {name} 시즌 정리", "{nick} 우승 ㄷㄷㄷ {name} 반지 꼈다"],
};

/* ---------- MLBPARK 불펜: 존댓말(~네요·~습니다), 야구에 빗댄 말, 두루 보는 스포츠 팬 ---------- */

const PARK: Voice = {
  event: [
    { t: "우승 축하합니다. {name} 지분이 꽤 크네요", mood: "up", when: (x) => x.champ },
    { t: "야구만 보다가 이번에 농구 우승 보니 재밌네요", mood: "lol", when: (x) => x.champ },
    { t: "준우승도 대단한 겁니다. 다음 시즌 기대합니다", mood: "meh", when: (x) => x.finalLoss },
    { t: "플레이오프 못 간 건 아쉽지만 개인 기록은 훌륭하네요", mood: "meh", when: (x) => x.missed && x.tier >= 2 },
    { t: "MVP 받을 만하죠. 이견 없습니다", mood: "up", when: MVP },
    { t: "야구로 치면 트리플 크라운급 시즌이네요", mood: "up", when: MVP },
    { t: "큰 경기에서 해 주는 선수가 진짜죠", mood: "up", when: has("fmvp") },
    { t: "신인왕 축하합니다. 떡잎부터 다르네요", mood: "up", when: has("roy") },
    { t: "득점왕이면 야구로 치면 홈런왕인데 대단하네요", mood: "up", when: has("scoring") },
    { t: "한국 선수가 NBA에서 이렇게 하는 날이 오네요 ㄷㄷ", mood: "up", when: (x) => x.korean && nba(x) && x.tier >= 2 },
    { t: "메이저리그 진출 1세대 보던 느낌이 납니다", mood: "up", when: (x) => koreanAbroad(x) && x.tier >= 2 },
    { t: "해외에서 버티는 것 자체가 대단한 겁니다", mood: "meh", when: (x) => koreanAbroad(x) && x.tier <= 1 },
    { t: "작년과는 완전히 다른 선수가 됐네요", mood: "up", when: (x) => x.growth >= 4 },
    { t: "부상만 아니었으면... 건강이 최우선입니다", mood: "meh", when: (x) => x.injured },
    { t: "3점 {tpp}%면 야구로 치면 4할 타자급 아닙니까", mood: "up", when: (x) => x.three },
    { t: "{age}세에 이 정도면 관리를 정말 잘하네요", mood: "up", when: (x) => old(x) && x.tier >= 2 },
    { t: "{age}세면 앞으로가 더 기대되는군요", mood: "up", when: (x) => young(x) && x.tier >= 2 },
    { t: "출전 기회만 받으면 보여 줄 선수 같은데요", mood: "meh", when: (x) => x.bench },
    { t: "우승 반지 하나가 커리어를 바꿉니다. 축하해요", mood: "up", when: (x) => x.champ },
    { t: "결승에서 졌지만 올 시즌 최고의 선수 중 하나였습니다", mood: "meh", when: (x) => x.finalLoss && x.tier >= 3 },
    { t: "플레이오프 탈락은 구단이 책임져야죠", mood: "meh", when: (x) => x.missed },
    { t: "MVP 수상 소감 들었는데 겸손하더군요", mood: "up", when: MVP },
    { t: "파이널 MVP는 아무나 못 받습니다", mood: "up", when: has("fmvp") },
    { t: "신인상 받고 더 성장하는 선수가 진짜죠", mood: "up", when: has("roy") },
    { t: "올스타 선정 축하드립니다. 당연한 결과네요", mood: "up", when: has("allstar") },
    { t: "수비는 기록에 다 안 나오는데 이 선수는 다르네요", mood: "up", when: has("dpoy") },
    { t: "국내 리그 수준이 한 단계 올라간 느낌입니다", mood: "up", when: (x) => x.lg === "kbl" && x.tier >= 3 },
    { t: "유럽에서 뛰는 것도 쉬운 일이 아닙니다", mood: "meh", when: (x) => x.lg === "euro" },
    { t: "대학 선수가 벌써 이 정도면 프로 적응은 문제없겠네요", mood: "up", when: (x) => (x.lg === "kuniv" || x.lg === "ncaa") && x.tier >= 3 },
    { t: "부상 복귀 후에도 이 정도면 대단합니다", mood: "up", when: (x) => x.injured && x.tier >= 3 },
    { t: "{age}세에 이런 경기력이면 롱런하겠는데요", mood: "up", when: (x) => young(x) && x.tier >= 3 },
    { t: "{age}세면 후배들 챙길 나이인데 아직 현역이네요", mood: "meh", when: old },
    { t: "벤치에서 나오는 선수치고는 기록이 좋네요", mood: "up", when: (x) => x.bench && x.tier >= 2 },
  ],
  tier: [
    { t: "이 정도면 리그 최고 선수죠", mood: "up", when: tier(4) },
    { t: "평균 {pts}점... 기록이 말이 안 되네요", mood: "up", when: tier(4) },
    { t: "농구 잘 안 보는데 {name} 경기는 챙겨 봅니다", mood: "up", when: tier(4, 3) },
    { t: "{pts}/{reb}/{ast}면 올스타급이죠", mood: "up", when: tier(3) },
    { t: "확실히 한 단계 올라섰네요", mood: "up", when: tier(3) },
    { t: "팀의 에이스로 손색없습니다", mood: "up", when: (x) => x.tier >= 3 && !x.bench },
    { t: "제 몫은 충분히 했다고 봅니다", mood: "meh", when: tier(2) },
    { t: "평점 {rating}이면 준수하네요", mood: "up", when: tier(2) },
    { t: "꾸준함이 장점인 선수네요", mood: "meh", when: tier(2) },
    { t: "올해는 좀 아쉽네요", mood: "down", when: tier(1) },
    { t: "기복이 좀 있었습니다", mood: "down", when: tier(1) },
    { t: "내년에는 반등할 거라고 봅니다", mood: "meh", when: tier(1, 0) },
    { t: "이번 시즌은 실망스럽네요", mood: "down", when: tier(0) },
    { t: "자신감을 좀 찾아야 할 것 같습니다", mood: "meh", when: tier(0) },
    { t: "이 선수 하나 보려고 농구 봅니다", mood: "up", when: tier(4) },
    { t: "역대급 시즌이라고 봐도 되겠습니다", mood: "up", when: tier(4) },
    { t: "기록 보고 눈을 의심했습니다", mood: "up", when: tier(4) },
    { t: "리그 정상급으로 올라왔네요", mood: "up", when: tier(3) },
    { t: "경기 보면 확실히 다릅니다", mood: "up", when: tier(3) },
    { t: "이런 선수가 팀에 있으면 든든하죠", mood: "up", when: tier(3) },
    { t: "무난한 시즌이었네요", mood: "meh", when: tier(2) },
    { t: "평균은 하는 선수입니다", mood: "meh", when: tier(2) },
    { t: "조금만 더 하면 올스타급인데요", mood: "meh", when: tier(2) },
    { t: "작년이 더 좋았던 것 같네요", mood: "down", when: tier(1) },
    { t: "조금 주춤하네요", mood: "down", when: tier(1) },
    { t: "기대치가 있어서 그런지 아쉽습니다", mood: "meh", when: tier(1) },
    { t: "이대로면 자리 보전이 어렵겠는데요", mood: "down", when: tier(0) },
    { t: "팬 입장에서 보기 힘든 시즌이었습니다", mood: "down", when: tier(0) },
    { t: "뭔가 문제가 있어 보입니다", mood: "down", when: tier(0) },
    { t: "상대 팀 벤치가 제일 먼저 신경 쓰는 선수죠", mood: "up", when: tier(3, 4) },
    { t: "기록도 좋지만 경기를 보면 더 좋습니다", mood: "up", when: tier(3, 4) },
    { t: "이 선수 없는 팀은 상상이 안 되네요", mood: "up", when: tier(3, 4) },
    { t: "꾸준함이 최고의 재능이라고 하죠", mood: "up", when: tier(2, 3) },
    { t: "팀에 꼭 필요한 선수입니다", mood: "meh", when: tier(2, 3) },
    { t: "조용히 제 역할 하는 타입이네요", mood: "meh", when: tier(2, 3) },
    { t: "잘하는 날과 못하는 날 차이가 크네요", mood: "meh", when: tier(1, 2) },
    { t: "평균은 하는데 임팩트가 아쉽습니다", mood: "meh", when: tier(1, 2) },
    { t: "한 끗이 부족해 보입니다", mood: "meh", when: tier(1, 2) },
    { t: "보는 팬들이 답답했을 것 같습니다", mood: "down", when: tier(0, 1) },
    { t: "계약 연장은 어려워 보이네요", mood: "down", when: tier(0, 1) },
    { t: "올해는 변명의 여지가 없네요", mood: "down", when: tier(0, 1) },
    { t: "나쁘지 않은 시즌이었어요", mood: "meh", when: tier(2) },
    { t: "작년과 비슷한 수준이네요", mood: "meh", when: tier(2) },
  ],
  lol: [
    { t: "불펜에 농구 글 오랜만이네요 ㅎㅎ", mood: "lol" },
    { t: "야구 시즌 끝나고 농구 보는데 {name} 때문에 재밌네요", mood: "lol", when: (x) => x.tier >= 2 },
    { t: "이 선수는 야구했어도 잘했을 것 같습니다", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "농알못인데 이 정도면 잘하는 거 맞죠?", mood: "lol" },
    { t: "{nick} 팬인데 올해도 속이 터집니다 ㅠ", mood: "lol", when: (x) => x.missed || x.tier <= 1 },
    { t: "불펜 형님들 농구도 좀 봐 주세요 ㅎㅎ", mood: "lol" },
    { t: "야구 비시즌에 농구가 효자네요", mood: "lol", when: (x) => x.tier >= 2 },
    { t: "이 선수 야구로 치면 5툴 플레이어 아닙니까", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "댓글 보니 농구 팬이 생각보다 많네요", mood: "lol" },
    { t: "응원하는 팀은 아니지만 인정합니다", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "올해도 우리 팀은 봄 농구 없네요 ㅠ", mood: "lol", when: (x) => x.missed },
  ],
  title: {
    4: ["{name} 이번 시즌 대단하네요 ㄷㄷ", "{name} 올해 기록 보셨습니까", "{name} 올해 리그 최고 아닙니까"],
    3: ["{name} {year} 시즌 기록입니다", "{name} 올 시즌 평가 어떠신가요", "{name} 올해 정말 잘했네요"],
    2: ["{name} 이번 시즌 어떻게 보셨나요", "{name} 올해 무난했네요", "{name} 올 시즌 한 줄 평 부탁드립니다"],
    1: ["{name} 올해는 좀 아쉽네요", "{name} 작년만 못하네요", "{name} 올해 폼이 많이 떨어졌네요"],
    0: ["{name} 이대로 괜찮을까요", "{name} 올해 왜 이런가요", "{name} 올해 왜 이렇게 못하나요"],
  },
  champTitle: ["{nick} 우승했네요 ㄷㄷ", "{nick} 우승, {name} 활약 어떻게 보셨나요", "{nick} 우승이네요. {name} 축하합니다"],
};

/* ---------- 레딧 (영어 원문): He's him·cooking·box score watchers·fantasy·!RemindMe·Respect ---------- */

const REDDIT: Voice = {
  event: [
    { t: "Ring secured. He's him, no further questions.", mood: "up", when: (x) => x.champ },
    { t: "Did you see his face at the parade lmao. Pure joy", mood: "up", when: (x) => x.champ },
    { t: "Only box score watchers will say losing the Finals ruins his season", mood: "meh", when: (x) => x.finalLoss },
    { t: "MVP race was over by Christmas tbh", mood: "up", when: MVP },
    { t: "He's him. The MVP was never in doubt", mood: "up", when: MVP },
    { t: "That Finals MVP changes his whole legacy", mood: "up", when: has("fmvp") },
    { t: "Led the ROY ladder wire to wire. What's his ceiling?", mood: "up", when: has("roy") },
    { t: "DPOY deserved. Nobody wants to bring the ball up against him", mood: "up", when: has("dpoy") },
    { t: "Scoring title AND efficient? He's cooking", mood: "up", when: has("scoring") },
    { t: "Having him come off the bench should be illegal", mood: "up", when: has("sixth") },
    { t: "Glad he didn't get snubbed this year", mood: "up", when: has("allstar") },
    { t: "This Korean kid is the real deal", mood: "up", when: (x) => x.korean && x.tier >= 2 },
    { t: "Best Asian guard we've seen in a long time, not even close", mood: "up", when: (x) => x.korean && nba(x) && x.tier >= 3 },
    { t: "Give him time to adjust. Everyone struggles in year one", mood: "meh", when: (x) => x.korean && x.tier <= 1 },
    { t: "A KBL guy doing this? Scouts should be embarrassed", mood: "up", when: (x) => x.fromKbl && x.tier >= 2 },
    { t: "All-NBA level when healthy, but that's a big 'when'", mood: "meh", when: (x) => x.injured && nba(x) },
    { t: "Can't stay on the floor. Health is the only question with him", mood: "meh", when: (x) => x.injured && !nba(x) },
    { t: "{tpp}% from three. You can't go under screens on him anymore", mood: "up", when: (x) => x.three },
    { t: "{age} years old with these numbers. The next decade could be his", mood: "up", when: (x) => x.age <= 22 && nba(x) && x.tier >= 3 },
    { t: "{age} and still doing this. Aging like fine wine", mood: "up", when: (x) => old(x) && x.tier >= 2 },
    { t: "Numbers like this in the EuroLeague and no NBA team has called? Wild", mood: "up", when: (x) => x.lg === "euro" && x.tier >= 2 },
    { t: "EuroLeague defenses are tougher than people think. This is legit", mood: "up", when: (x) => x.lg === "euro" && x.tier >= 3 },
    { t: "Why hasn't he been called up yet? Front office, explain", mood: "up", when: (x) => x.lg === "gleague" && x.tier >= 2 },
    { t: "His draft stock is skyrocketing", mood: "up", when: (x) => x.lg === "ncaa" && x.tier >= 2 },
    { t: "Nobody wants to see this guy in March", mood: "up", when: (x) => x.lg === "ncaa" && x.tier >= 3 },
    { t: "Ring night is going to hit different for him", mood: "up", when: (x) => x.champ },
    { t: "Lost the Finals but he showed up. Can't say that about everyone", mood: "meh", when: (x) => x.finalLoss && x.tier >= 3 },
    { t: "Missed the playoffs with THAT season? Blow it up, front office", mood: "meh", when: (x) => x.missed && x.tier >= 2 },
    { t: "Unanimous MVP talk is not crazy", mood: "up", when: MVP },
    { t: "Finals MVP in a series like that. Legacy stuff", mood: "up", when: has("fmvp") },
    { t: "ROY and already a top-3 player on his team", mood: "up", when: has("roy") },
    { t: "Scoring title with those shot charts? Insane", mood: "up", when: has("scoring") },
    { t: "DPOY and he still scores. Rare breed", mood: "up", when: has("dpoy") },
    { t: "All-Star starter next year, book it", mood: "up", when: has("allstar") },
    { t: "Korean basketball just got a new face", mood: "up", when: (x) => x.korean && x.tier >= 3 },
    { t: "The EuroLeague-to-NBA pipeline is sleeping on this guy", mood: "up", when: (x) => x.lg === "euro" && x.tier >= 2 },
    { t: "G League stats don't always translate, but these would", mood: "up", when: (x) => x.lg === "gleague" && x.tier >= 2 },
    { t: "Lottery pick written all over him", mood: "up", when: (x) => x.lg === "ncaa" && x.tier >= 3 },
    { t: "Came back from injury and didn't miss a beat", mood: "up", when: (x) => x.injured && x.tier >= 3 },
    { t: "{age} with this feel for the game is unfair", mood: "up", when: (x) => young(x) && x.tier >= 3 },
    { t: "Father Time is 0-1 against this man", mood: "up", when: (x) => old(x) && x.tier >= 2 },
  ],
  tier: [
    { t: "{pts}/{reb}/{ast}?? Those are video game numbers", mood: "up", when: tier(4) },
    { t: "He was cooking every single night", mood: "up", when: tier(4, 3) },
    { t: "He's him.", mood: "up", when: tier(4) },
    { t: "Don't forget this name when All-Star voting opens", mood: "up", when: tier(3) },
    { t: "Front office absolutely nailed that signing", mood: "up", when: tier(3, 4) },
    { t: "The guy you want with the ball in the 4th", mood: "up", when: tier(3) },
    { t: "Not flashy, just winning basketball", mood: "up", when: tier(2) },
    { t: "Box score watchers will never get his value", mood: "meh", when: tier(2) },
    { t: "Feels like a leap is coming next season", mood: "meh", when: tier(2, 1) },
    { t: "The talent is there but he's way too inconsistent", mood: "meh", when: tier(1) },
    { t: "Good nights are great, bad nights are brutal", mood: "down", when: tier(1) },
    { t: "Needs a bounce-back year", mood: "meh", when: tier(1, 0) },
    { t: "Trade deadline candidate #1", mood: "down", when: tier(0) },
    { t: "Honestly not sure why he's in the rotation", mood: "down", when: tier(0) },
    { t: "He'd probably like to forget this season", mood: "down", when: tier(0) },
    { t: "Nobody has an answer for him right now", mood: "up", when: tier(4) },
    { t: "Casual fans have no idea how good this guy is", mood: "up", when: tier(4) },
    { t: "Unreal season. Put some respect on his name", mood: "up", when: tier(4) },
    { t: "Second-best player on any contender, easily", mood: "up", when: tier(3) },
    { t: "He's been quietly elite all year", mood: "up", when: tier(3) },
    { t: "That's an All-NBA case if I've ever seen one", mood: "up", when: (x) => x.tier === 3 && nba(x) },
    { t: "Solid starter. Nothing more, nothing less", mood: "meh", when: tier(2) },
    { t: "Does his job every night", mood: "up", when: tier(2) },
    { t: "Fine season. Fans expect too much", mood: "meh", when: tier(2) },
    { t: "Regressed a bit this year, not gonna lie", mood: "down", when: tier(1) },
    { t: "Still waiting for the breakout", mood: "meh", when: tier(1) },
    { t: "Hot and cold all season", mood: "down", when: tier(1) },
    { t: "This contract is looking rough", mood: "down", when: tier(0) },
    { t: "Dude fell off a cliff", mood: "down", when: tier(0) },
    { t: "Not a rotation player right now, sorry", mood: "down", when: tier(0) },
    { t: "Opposing coaches game-plan for him first. That says it all", mood: "up", when: tier(3, 4) },
    { t: "Highlights don't even do him justice", mood: "up", when: tier(3, 4) },
    { t: "This team doesn't make the playoffs without him", mood: "up", when: (x) => x.tier >= 3 && !x.missed },
    { t: "Consistency is a skill and he has it", mood: "up", when: tier(2, 3) },
    { t: "Every contender needs a guy like this", mood: "up", when: tier(2, 3) },
    { t: "Quietly does everything right", mood: "meh", when: tier(2, 3) },
    { t: "Elite on good nights, invisible on bad ones", mood: "meh", when: tier(1, 2) },
    { t: "Decent numbers, zero impact. Classic", mood: "meh", when: tier(1, 2) },
    { t: "Something's missing and I can't tell what", mood: "meh", when: tier(1, 2) },
    { t: "My eyes hurt watching him this year", mood: "down", when: tier(0, 1) },
    { t: "No way they extend him after this", mood: "down", when: tier(0, 1) },
    { t: "No excuses this season", mood: "down", when: tier(0, 1) },
    { t: "Fine. Just fine", mood: "meh", when: tier(2) },
    { t: "Same as last year, basically", mood: "meh", when: tier(2) },
  ],
  lol: [
    { t: "Drafted him in fantasy. I'm a genius", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "Drafted him in fantasy and finished dead last lol", mood: "lol", when: (x) => x.tier <= 1 },
    { t: "Source? My eyes.", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "!RemindMe 3 years", mood: "lol" },
    { t: "Is it just me or does he only go off against my team?", mood: "lol", when: (x) => x.tier >= 2 },
    { t: "Respect, regardless of flair", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "Commentators finally pronouncing his name right lol", mood: "lol", when: (x) => x.korean },
    { t: "This thread is going to age well", mood: "lol", when: (x) => x.tier >= 2 },
    { t: "He's him (I say this every year)", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "Fantasy managers rise up", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "Watched one game and became a fan. No regrets", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "Mods, pin this", mood: "lol", when: tier(4) },
    { t: "Flair up before you post this take", mood: "lol" },
    { t: "Posted this in the game thread and got downvoted. Vindicated", mood: "lol", when: (x) => x.tier >= 3 },
    { t: "Me in October: he's washed. Him: {pts} ppg", mood: "lol", when: (x) => x.tier >= 3 && x.age >= 28 },
    { t: "Someone make the highlight reel already", mood: "lol", when: (x) => x.tier >= 2 },
  ],
  title: {
    4: ["[Stats] {ename} finishes the season averaging {pts}/{reb}/{ast}", "{ename} just had one of the best seasons we've seen in years", "{ename} is the best player in the {elg} right now, and it's not close"],
    3: ["[Highlight] {ename}'s best plays of the season", "[Discussion] How good was {ename} this season?", "{ename} deserves way more attention"],
    2: ["{ename} season review thread", "[Discussion] Where does {ename} rank at his position?", "Honest take on {ename}'s season"],
    1: ["{ename} had a disappointing season. What happened?", "Is {ename} overrated or was this just a down year?", "Down year for {ename}. Concerned or nah?"],
    0: ["Is {ename} still in the rotation next year?", "What happened to {ename}?", "{ename}'s season was rough. Where does he go from here?"],
  },
  champTitle: ["[Finals] Champions! Appreciation thread for {ename}", "[Finals] {ename} is a champion. Where does this season rank?", "[Finals] {ename} finally got his ring"],
};

/* ---------- RealGM 국제 농구 포럼 (영어 원문): 리그 수준을 따지는 차분한 스카우팅 ---------- */

const REALGM: Line[] = [
  { t: "Even adjusting for the level of competition, {pts} ppg means something", mood: "up" },
  { t: "Athleticism will always be the knock, but the feel and passing are real", mood: "up" },
  { t: "Three-point form needs work, but the touch is soft", mood: "meh", when: (x) => !x.three },
  { t: "Shooting {tpp}% from three. The jumper looks legit", mood: "up", when: (x) => x.three },
  { t: "Not sure he's an NBA guy, but he'd help any national team", mood: "meh" },
  { t: "Worth a summer league look. Whether he sticks is another question", mood: "meh" },
  { t: "Weak roster around him might inflate the numbers, but the production is real", mood: "meh" },
  { t: "Could be a 10-15 minute bench piece for an NBA team", mood: "up" },
  { t: "At {age}, now's the time to try his luck overseas", mood: "meh", when: (x) => x.age <= 26 },
  { t: "Don't judge off highlights. Watched three full games before posting this", mood: "meh" },
  { t: "People who wrote him off as a prospect were premature. The numbers speak", mood: "up" },
  { t: "Level of competition matters, but you can't fake this kind of feel", mood: "up" },
  { t: "Needs to add strength before anyone talks about the next level", mood: "meh" },
  { t: "Style-wise he reminds me of a couple of Euro guards. Style, not quality", mood: "meh" },
  { t: "The motor is there every night. That travels", mood: "up" },
  { t: "Decision-making in the pick and roll is ahead of his age", mood: "up", when: (x) => x.age <= 25 },
  { t: "I'd like to see him against better rim protection before buying in", mood: "meh" },
  { t: "Teams will look at the numbers and ask who he was playing against", mood: "meh" },
  { t: "Shot selection is the one thing holding him back right now", mood: "meh" },
];

/* ---------- 영어 이름 ---------- */

const EN_LEAGUE: Record<LeagueKey, string> = {
  nba: "NBA",
  gleague: "G League",
  euro: "EuroLeague",
  ncaa: "NCAA",
  kbl: "KBL",
  kuniv: "Korean college",
  hs: "Korean high school",
};

const INITIAL = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const VOWEL = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const FINAL = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];

/** 성씨는 흔히 쓰는 영문 표기로 써요. 없으면 로마자 표기법대로예요. */
const SURNAME: Record<string, string> = {
  김: "Kim", 이: "Lee", 박: "Park", 최: "Choi", 정: "Jung", 강: "Kang", 조: "Cho", 윤: "Yoon", 장: "Jang", 임: "Lim", 한: "Han", 오: "Oh",
  서: "Seo", 신: "Shin", 권: "Kwon", 황: "Hwang", 안: "Ahn", 송: "Song", 류: "Ryu", 유: "Yoo", 홍: "Hong", 전: "Jeon", 고: "Ko", 문: "Moon",
  양: "Yang", 손: "Son", 배: "Bae", 백: "Baek", 허: "Heo", 남: "Nam", 심: "Shim", 노: "Noh", 하: "Ha", 곽: "Kwak", 성: "Sung", 차: "Cha",
  주: "Joo", 우: "Woo", 구: "Koo", 민: "Min", 진: "Jin", 나: "Na", 지: "Ji", 엄: "Eom", 채: "Chae", 원: "Won", 천: "Chun", 방: "Bang",
  공: "Kong", 현: "Hyun", 변: "Byun", 염: "Yeom", 여: "Yeo", 추: "Choo", 도: "Do", 석: "Seok", 설: "Seol", 마: "Ma", 길: "Gil", 표: "Pyo",
  명: "Myung", 기: "Ki", 반: "Ban", 왕: "Wang", 금: "Keum", 옥: "Ok", 육: "Yook", 인: "In", 제: "Je", 모: "Mo", 탁: "Tak", 국: "Kook",
  남궁: "Namgoong", 제갈: "Jegal", 선우: "Sunwoo", 황보: "Hwangbo", 독고: "Dokgo",
};

const isHangul = (ch: string) => ch >= "가" && ch <= "힣";

function romanizeSyllable(ch: string): string {
  const code = ch.charCodeAt(0) - 0xac00;
  return INITIAL[Math.floor(code / 588)] + VOWEL[Math.floor((code % 588) / 28)] + FINAL[code % 28];
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** 한글 이름을 영어식으로: 김농구 → Nong-gu Kim (이름-성 순서). 한글이 아니면 그대로예요. */
export function romanizeName(name: string): string {
  const n = name.replace(/\s/g, "");
  if (n.length < 2 || ![...n].every(isHangul)) return name;
  const two = n.length >= 3 && SURNAME[n.slice(0, 2)] ? 2 : 1;
  const sur = n.slice(0, two);
  const given = [...n.slice(two)].map(romanizeSyllable).join("-");
  const surname = SURNAME[sur] ?? cap([...sur].map(romanizeSyllable).join(""));
  return `${cap(given)} ${surname}`;
}

/* ---------- 커뮤니티 ---------- */

interface Site {
  site: string;
  style: SiteStyle;
}

const DC_NBA: Site = { site: "디시인사이드 NBA 갤러리", style: "dc" };
const DC_BASKET: Site = { site: "디시인사이드 농구 갤러리", style: "dc" };
const FM_SITE: Site = { site: "에펨코리아 농구 게시판", style: "fm" };
const PARK_SITE: Site = { site: "MLBPARK 불펜", style: "mlbpark" };

/** 국내 커뮤니티: 리그마다 시즌 반응이 올라오는 곳 가운데 하나 */
const KR_SITES: Record<LeagueKey, Site[]> = {
  nba: [DC_NBA, FM_SITE, PARK_SITE],
  gleague: [DC_NBA, FM_SITE],
  euro: [DC_BASKET, FM_SITE],
  ncaa: [DC_BASKET, FM_SITE],
  kbl: [DC_BASKET, FM_SITE, PARK_SITE],
  kuniv: [DC_BASKET],
  hs: [DC_BASKET],
};

/** 해외 포럼: 리그 서브레딧, 국내 무대 선수를 눈여겨볼 때는 RealGM 국제 농구 포럼 */
const EN_SITES: Partial<Record<LeagueKey, Site>> = {
  nba: { site: "레딧 r/nba", style: "reddit" },
  gleague: { site: "레딧 r/nba", style: "reddit" },
  euro: { site: "레딧 r/Euroleague", style: "reddit" },
  ncaa: { site: "레딧 r/CollegeBasketball", style: "reddit" },
};
const SCOUT_SITE: Site = { site: "RealGM 국제 농구 포럼", style: "realgm" };

const VOICES: Record<Exclude<SiteStyle, "realgm">, Voice> = { dc: DC, fm: FM, mlbpark: PARK, reddit: REDDIT };

/** 추천 표시: RealGM은 And1(추천 점수)이에요. */
const UP_LABEL: Record<SiteStyle, string> = { dc: "추천", fm: "추천", mlbpark: "추천", reddit: "▲", realgm: "And1" };

/* ---------- 닉네임 ---------- */

/** 디시 유동 닉 뒤에 붙는 IP 앞자리 */
const DC_IPS = ["118.235", "223.38", "211.36", "175.223", "121.140", "39.7", "106.101", "110.70", "58.150", "172.225"];
const DC_NICKS = ["놐놐", "덩크덩크", "슈퍼서브", "물로켓", "농붕이", "새벽직관", "갤주아님", "벤치워머", "자유투10할", "앤드원"];
const DC_FIXED = ["갤터줏대감", "골밑장인", "3점은과학", "농구는인생"];
const FM_NICKS = [
  "햇살가나디", "과즙덩크", "빙정빙정", "거인리바", "-Dunk23-", "61.슛도사", "S3SK0", "A_Gordon", "블록맛집", "포텐요정", "{nick}붕이", "{nick}시즌권",
];
const PARK_NICKS = ["fivestar", "덕아웃", "블루윙즈", "느바초보", "Tolan", "불펜지기", "광주키드", "주말직관", "오프시즌"];
const EN_NICKS = [
  "HoopsHead23", "BucketsOnly", "LowPostLarry", "CourtsideKev", "DunkCity_88", "PickAndRollMo", "ZoneBuster", "BoxOutBen", "FadeawayFran",
  "GlassCleaner", "DimeDropper", "SixthManSam", "ClutchTimeCarl", "TankCommander", "AnkleBreakr", "BaselineBrooke", "FullCourtPress", "HalfCourtHeave",
];
const REALGM_NICKS = ["EuroStep_09", "FIBA_Watcher", "OverseasGM", "TallGuyTouch", "BaselineScout", "Analyst88", "PnR_Pete", "Motor14"];

const NICKS: Record<SiteStyle, string[]> = { dc: DC_NICKS, fm: FM_NICKS, mlbpark: PARK_NICKS, reddit: EN_NICKS, realgm: REALGM_NICKS };

/** 커뮤니티 말투대로 닉네임을 다듬어요. 디시는 유동 ㅇㅇ(IP)와 닉(IP), 가끔 고정닉이고, 레딧은 u/를 붙여요. */
function styleNick(nick: string, style: SiteStyle, rand: Rand): string {
  if (style === "dc") {
    const ip = DC_IPS[Math.floor(rand() * DC_IPS.length)];
    const r = rand();
    if (r < 0.55) return `ㅇㅇ(${ip})`;
    if (r < 0.85) return `${nick}(${ip})`;
    return DC_FIXED[Math.floor(rand() * DC_FIXED.length)];
  }
  if (style === "reddit") return `u/${nick}`;
  return nick;
}

/* ---------- 만들기 ---------- */

function tierOf(rec: SeasonRecord, awards: Set<AwardKey>, bench: boolean): Tier {
  if (awards.has("mvp") || awards.has("mvp_nba") || awards.has("fmvp")) return 4;
  let t: Tier = rec.rating >= 8.3 ? 4 : rec.rating >= 7.5 || awards.has("allleague") ? 3 : rec.rating >= 6.7 ? 2 : rec.rating >= 5.8 ? 1 : 0;
  // 벤치 선수는 평점이 높아도 리그를 지배했다고 하진 않아요.
  if (bench && t > 2 && !awards.size) t = 2;
  return t;
}

function contextOf(c: Career, rec: SeasonRecord): Ctx {
  const lg = rec.lg!;
  const awards = new Set(c.awardLog.filter((a) => a.y === rec.year).map((a) => a.k));
  const bench = rec.role === "벤치" || rec.role === "엔드 오브 벤치";
  const at = c.hist.findIndex((h) => h === rec || (h.year === rec.year && h.lg === rec.lg && h.team === rec.team));
  const before = at >= 0 ? c.hist.slice(0, at) : c.hist;
  return {
    name: c.p.name,
    ename: romanizeName(c.p.name),
    elg: EN_LEAGUE[lg],
    team: rec.team,
    nick: rec.team.split(" ").pop() ?? rec.team,
    lg,
    lgName: LEAGUES[lg].short,
    year: rec.year,
    pts: String(r1(rec.pts)),
    reb: String(r1(rec.reb)),
    ast: String(r1(rec.ast)),
    rating: String(r1(rec.rating)),
    tpp: Math.round(rec.tpp ?? 0),
    age: rec.age,
    role: rec.role,
    tier: tierOf(rec, awards, bench),
    awards,
    champ: rec.result.endsWith("우승") && !rec.result.endsWith("준우승"),
    finalLoss: rec.result.endsWith("준우승"),
    missed: rec.result === "플레이오프 진출 실패" || rec.result === "전국대회 예선 탈락",
    korean: c.p.nat === "대한민국",
    injured: rec.gp < LEAGUES[lg].games * 0.6,
    three: (rec.tpp ?? 0) >= 40 && (rec.tpm ?? 0) >= 1.5,
    growth: rec.ovr1 - rec.ovr0,
    debut: rec.pro && !before.some((h) => h.pro),
    fromKbl: lg === "nba" && before.some((h) => h.lg === "kbl"),
    bench,
  };
}

/** {name}처럼 값을 넣어요. {name|이/가}면 받침에 맞는 조사를 붙여요. */
function fill(t: string, x: Ctx): string {
  const vals: Record<string, string> = {
    name: x.name, ename: x.ename, elg: x.elg, team: x.team, nick: x.nick, lg: x.lgName, year: String(x.year),
    pts: x.pts, reb: x.reb, ast: x.ast, rating: x.rating, tpp: String(x.tpp), age: String(x.age),
  };
  return t.replace(/\{(\w+)(?:\|([^/}]*)\/([^}]*))?\}/g, (_, k: string, a?: string, b?: string) => {
    const v = vals[k] ?? "";
    return a !== undefined ? josa(v, a, b ?? "") : v;
  });
}

type Rand = () => number;
const shuffle = <T>(xs: T[], rand: Rand): T[] => xs.map((v) => ({ v, r: rand() })).sort((a, b) => a.r - b.r).map((o) => o.v);
const usable = (lines: Line[], x: Ctx) => lines.filter((l) => !l.when || l.when(x));

/** 되도록 피할 글: 최근 두 시즌에 나온 것(recent)과 그중 직전 시즌 것(last). 모자라서 다시 쓸 때는 직전 시즌 것부터 피해요. */
interface Avoid {
  recent: Set<string>;
  last: Set<string>;
}
const NO_AVOID: Avoid = { recent: new Set(), last: new Set() };

/** 쓸 수 있는 줄을 최근에 나오지 않은 것(fresh)과 나왔던 것(used, 직전 시즌 것은 뒤로)으로 나눠 섞어요. */
function split(lines: Line[], x: Ctx, rand: Rand, avoid: Avoid): { fresh: Line[]; used: Line[] } {
  const ok = usable(lines, x);
  const fresh = shuffle(ok.filter((l) => !avoid.recent.has(l.t)), rand);
  const older = shuffle(ok.filter((l) => avoid.recent.has(l.t) && !avoid.last.has(l.t)), rand);
  const last = shuffle(ok.filter((l) => avoid.last.has(l.t)), rand);
  return { fresh, used: [...older, ...last] };
}

/** 최근에 나오지 않은 줄부터 n개. 모자라면 나왔던 줄로 채워요. */
function pickFrom(lines: Line[], x: Ctx, rand: Rand, n: number, avoid: Avoid): Line[] {
  const { fresh, used } = split(lines, x, rand, avoid);
  return [...fresh, ...used].slice(0, Math.max(0, n));
}

/**
 * 상황 댓글 최대 3개, 성적 댓글, 농담·밈 댓글 jokes개를 골라 n개로 맞춰요.
 * 상황 댓글은 몇 개 안 되는 경우가 많아서(한국 선수의 NBA 시즌 등) 최근에 나온 건 쓰지 않고 성적 댓글로 채워요.
 * 그래도 모자랄 때만 나왔던 줄을 다시 써요.
 */
function pickLines(x: Ctx, rand: Rand, n: number, v: Voice, jokes: number, avoid: Avoid): Line[] {
  const lol = split(v.lol, x, rand, avoid);
  const ev = split(v.event, x, rand, avoid);
  const tr = split(v.tier, x, rand, avoid);
  const jokesPicked = [...lol.fresh, ...lol.used].slice(0, jokes);
  const evPicked = ev.fresh.slice(0, Math.min(3, n - jokesPicked.length - 1));
  const need = n - evPicked.length - jokesPicked.length;
  const rest = [...tr.fresh, ...tr.used, ...ev.used].slice(0, Math.max(0, need));
  return [...evPicked, ...rest, ...jokesPicked];
}

function pickTitle(titles: string[], rand: Rand, avoid: Avoid): string {
  const fresh = titles.filter((t) => !avoid.recent.has(t));
  const notLast = titles.filter((t) => !avoid.last.has(t));
  const pool = fresh.length ? fresh : notLast.length ? notLast : titles;
  return pool[Math.floor(rand() * pool.length)];
}

/** 추천 수: 화제가 클수록 많고, 시즌 분위기와 맞는 댓글이 더 받아요. */
function likesOf(l: Line, x: Ctx, hype: number, rand: Rand): number {
  const fit =
    l.mood === "lol" ? 0.9 + rand() * 0.6 : l.mood === "up" ? (x.tier >= 2 ? 1 + rand() * 0.6 : 0.3 + rand() * 0.3) : l.mood === "down" ? (x.tier <= 1 ? 1 + rand() * 0.6 : 0.2 + rand() * 0.3) : 0.6 + rand() * 0.4;
  return Math.max(0, Math.round(hype * 40 * fit * (0.4 + rand())));
}

function board(kind: CommunityBoard["kind"], at: Site, title: string, lines: Line[], x: Ctx, hype: number, rand: Rand): CommunityBoard {
  const pool = shuffle(NICKS[at.style].map((n) => fill(n, x)), rand);
  const comments = lines
    .map((l, i) => ({ nick: styleNick(pool[i % pool.length], at.style, rand), text: fill(l.t, x), mood: l.mood, likes: likesOf(l, x, hype, rand) }))
    .sort((a, b) => b.likes - a.likes)
    .map((cm, i) => (i < 2 && cm.likes >= 30 ? { ...cm, best: true } : cm));
  const views = Math.round(hype * 900 * (0.8 + rand() * 0.5));
  return {
    kind,
    site: at.site,
    style: at.style,
    upLabel: UP_LABEL[at.style],
    title: fill(title, x),
    views,
    total: Math.max(comments.length, Math.round(views / 35)),
    comments,
  };
}

/** 리그마다 화제성: 국내 커뮤니티와 해외 포럼에서 */
const BUZZ: Record<LeagueKey, [number, number]> = {
  nba: [6, 6],
  euro: [2.5, 2.5],
  gleague: [1.8, 1.5],
  ncaa: [2, 2.5],
  kbl: [3, 0.6],
  kuniv: [1, 0.3],
  hs: [0.6, 0.2],
};

/** 한 시즌의 댓글 계획: 어느 커뮤니티에 어떤 제목과 댓글이 달리는지. 난수를 쓰는 순서가 정해져 있어서 지난 시즌 것도 똑같이 다시 만들 수 있어요. */
interface Plan {
  x: Ctx;
  rand: Rand;
  kr: { site: Site; title: string; lines: Line[] };
  en: { site: Site; title: string; lines: Line[] } | null;
}

function planSeason(c: Career, rec: SeasonRecord, avoid: Avoid): Plan | null {
  if (!rec.lg || rec.gp <= 0) return null;
  const x = contextOf(c, rec);
  const rand = seededPick(`${c.id}:${rec.year}:community`);
  const krSites = KR_SITES[x.lg];
  const krSite = krSites[Math.floor(rand() * krSites.length)];
  const kr = VOICES[krSite.style as keyof typeof VOICES];
  const krTitle = pickTitle(x.champ ? kr.champTitle : kr.title[x.tier], rand, avoid);
  const krLines = pickLines(x, rand, 6, kr, 2, avoid);

  let en: Plan["en"] = null;
  const enSite = EN_SITES[x.lg];
  if (abroad(x) && enSite) {
    const v = VOICES.reddit;
    en = { site: enSite, title: pickTitle(x.champ ? v.champTitle : v.title[x.tier], rand, avoid), lines: pickLines(x, rand, 5, v, 1, avoid) };
  } else if (x.tier >= 3) {
    en = { site: SCOUT_SITE, title: x.tier === 4 ? "The curious case of {ename}" : "{ename} ({elg})", lines: pickFrom(REALGM, x, rand, 4, avoid) };
  }
  return { x, rand, kr: { site: krSite, title: krTitle, lines: krLines }, en };
}

/** 이 계획에 쓴 제목과 댓글 원문 */
const usedIn = (p: Plan): string[] => [p.kr.title, ...p.kr.lines.map((l) => l.t), ...(p.en ? [p.en.title, ...p.en.lines.map((l) => l.t)] : [])];

/** 직전 몇 시즌에 나온 댓글은 피해요. */
const AVOID_SEASONS = 2;

/**
 * 이 시즌 앞의 시즌들에 달렸던 제목과 댓글. 첫 시즌부터 차례로 같은 규칙으로 다시 골라서,
 * 그 시즌의 결산을 열었을 때 보였던 것과 똑같이 맞춰요.
 */
function recentlyUsed(c: Career, rec: SeasonRecord): Avoid {
  const at = c.hist.findIndex((h) => h === rec || (h.year === rec.year && h.lg === rec.lg && h.team === rec.team));
  const before = at >= 0 ? c.hist.slice(0, at) : c.hist.filter((h) => h.year < rec.year);
  const window: string[][] = [];
  const avoidOf = (): Avoid => (window.length ? { recent: new Set(window.flat()), last: new Set(window[window.length - 1]) } : NO_AVOID);
  for (const h of before) {
    const p = planSeason(c, h, avoidOf());
    if (!p) continue;
    window.push(usedIn(p));
    if (window.length > AVOID_SEASONS) window.shift();
  }
  return avoidOf();
}

/**
 * 시즌 커뮤니티 반응. 국내 커뮤니티는 늘 열리고, 해외 포럼은 해외 리그(NBA·유로리그·G리그·NCAA)에서 뛰거나
 * 국내 무대에서 훌륭한 시즌을 보냈을 때만 열려요. 해외 포럼이 없으면 overseas는 null이에요.
 * 직전 두 시즌에 나온 제목과 댓글은 되도록 다시 쓰지 않아요.
 */
export function seasonCommunity(c: Career, rec: SeasonRecord): { domestic: CommunityBoard; overseas: CommunityBoard | null } | null {
  const p = planSeason(c, rec, recentlyUsed(c, rec));
  if (!p) return null;
  const { x, rand } = p;
  const award = Math.min(3, x.awards.size) * 0.5;
  const [krBuzz, enBuzz] = BUZZ[x.lg];
  const hype = (b: number) => b * (0.6 + x.tier * 0.35 + award + (x.champ ? 0.6 : 0));
  const domestic = board("domestic", p.kr.site, p.kr.title, p.kr.lines, x, hype(krBuzz), rand);
  const overseas = p.en ? board("overseas", p.en.site, p.en.title, p.en.lines, x, hype(enBuzz), rand) : null;
  return { domestic, overseas };
}
