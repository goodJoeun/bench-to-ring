import { SHORT } from "./data";
import { pick, ri, rnd } from "./random";
import { ovr } from "./ratings";
import type { AttrKey, Boost, Career, Decision, DecisionOption } from "./types";
import { clamp, josa, money, roundSalary } from "./util";

/* ---------- 선택지 만들기 ---------- */

/** 효과를 선택지 설명으로 바꿔요. 예: "BQ +2 · 건강 +5 · 코치 신뢰 하락" */
export function describeBoost(b: Boost): string {
  const parts: string[] = [];
  if (b.attrs)
    for (const [k, v] of Object.entries(b.attrs) as [AttrKey, number][]) if (v) parts.push(`${SHORT[k]} ${v > 0 ? "+" : ""}${v}`);
  if (b.rand && b.amt) parts.push(`무작위 능력치 ${b.rand}개 +${b.amt}`);
  if (b.health) parts.push(`건강 ${b.health > 0 ? "+" : ""}${b.health}`);
  if (b.money) parts.push(b.money > 0 ? `수입 +${money(b.money)}` : `비용 ${money(-b.money)}`);
  if (b.trust) parts.push(b.trust > 0 ? "코치 신뢰 상승" : "코치 신뢰 하락");
  if (b.agency) parts.push("앞으로 연봉 제안 +10%");
  if (b.trainer) parts.push(`${SHORT[b.trainer]} 성장 꾸준히 +15%`);
  if (b.form) parts.push(b.form > 0 ? "경기력 상승" : "경기력 하락");
  if (b.sit) parts.push(b.sit > 0 ? `${b.sit}경기 휴식` : `결장 ${-b.sit}경기 단축`);
  if (b.injure) parts.push(`부상으로 ${b.injure}경기 결장`);
  return parts.join(" · ") || "변화 없음";
}

const opt = (label: string, b: Boost, tag?: string): DecisionOption => ({
  label,
  sub: describeBoost(b),
  tag,
  act: { k: "boost", ...b },
});

/** 결과가 운에 달린 선택지. 확률은 숫자로 보여주지 않아요. */
const risky = (label: string, p: number, win: Boost, lose: Boost): DecisionOption => ({
  label,
  sub: `잘 되면 ${describeBoost(win)} · 안 되면 ${describeBoost(lose)}`,
  tag: "도전",
  act: { k: "gamble", p, win, lose },
});

const pass = (label: string, msg: string): DecisionOption => opt(label, { msg, t: "info" });

/* ---------- 생활 이벤트 ---------- */

interface LifeEvent {
  id: string;
  /** 이 이벤트를 겪을 수 있는 때. 없으면 언제나 */
  when?: (c: Career) => boolean;
  /** 커리어에서 한 번만 */
  once?: boolean;
  make: (c: Career) => Decision;
}

const isHs = (c: Career) => c.stage === "hs";
const isCollege = (c: Career) => c.stage === "college";
const isPro = (c: Career) => c.stage === "pro" && !!c.team;
const isFree = (c: Career) => c.stage === "free";
const hasTeam = (c: Career) => !!c.team;
/** 이벤트 비용·수입의 기준이 되는 연봉 */
const salary = (c: Career) => c.contract?.salary ?? 1;

const TRAINERS: [AttrKey, string][] = [
  ["ath", "피지컬 전문 트레이너"],
  ["sht", "슈팅 전문 코치"],
  ["hdl", "볼 핸들링 트레이너"],
  ["pas", "플레이메이킹 코치"],
  ["def", "수비 전문 코치"],
];

const EVENTS: LifeEvent[] = [
  /* 어느 단계에서나 */
  {
    id: "camp",
    when: (c) => !isFree(c),
    make: () => ({
      title: "여름 스킬 캠프 초청",
      body: "유명 트레이너의 3주 집중 캠프에 초대받았어요. 강도가 꽤 높아요.",
      opts: [
        opt("캠프 참가", { rand: 2, amt: 1, health: -6, msg: "스킬 캠프를 완주했어요." }),
        opt("푹 쉬기", { health: 8, msg: "여름 내내 몸을 회복했어요." }),
      ],
    }),
  },
  {
    id: "dawn",
    make: () => ({
      title: "새벽 슈팅 루틴",
      body: "매일 새벽 슈팅 500개. 루틴을 시작할까요?",
      opts: [
        opt("시작한다", { attrs: { sht: 2 }, health: -4, msg: "새벽 슈팅 루틴이 몸에 붙었어요." }),
        pass("평소대로", "새벽 루틴은 다음으로 미뤘어요."),
      ],
    }),
  },
  {
    id: "film",
    when: hasTeam,
    make: () => ({
      title: "필름 세션 제안",
      body: "코치가 매주 경기 영상을 함께 분석하자고 해요.",
      opts: [
        opt("함께 한다", { attrs: { iq: 2 }, msg: "경기를 보는 눈이 넓어졌어요." }),
        opt("웨이트에 집중", { attrs: { ath: 1 }, msg: "웨이트로 몸을 키웠어요." }),
      ],
    }),
  },

  /* 고등학생 */
  {
    id: "talent",
    when: isHs,
    make: () => ({
      title: "학교 축제 장기자랑",
      body: "반 친구들이 축제 무대에 같이 서자고 해요. 다들 덩크 쇼를 기대하는 눈치예요.",
      opts: [
        risky(
          "무대에 선다",
          0.6,
          { trust: 1, health: 3, msg: "축제 덩크 쇼로 학교의 스타가 됐어요." },
          { msg: "덩크를 놓쳐 웃음거리가 됐지만 좋은 추억이 됐어요.", t: "info" },
        ),
        opt("체육관에서 훈련", { rand: 1, amt: 1, msg: "축제 대신 체육관을 지켰어요." }),
      ],
    }),
  },
  {
    id: "exam",
    when: isHs,
    make: () => ({
      title: "시험 기간, 공부냐 농구냐",
      body: "기말고사가 코앞이에요. 담임 선생님은 공부를, 코치는 훈련을 바라요.",
      opts: [
        opt("공부에 집중", { attrs: { iq: 2 }, health: 5, trust: -1, msg: "시험공부에 집중했어요. 머리 쓰는 농구가 늘었어요." }),
        opt("훈련에 집중", { attrs: { ath: 1, sht: 1 }, health: -4, trust: 1, msg: "시험보다 훈련을 택했어요." }),
        risky(
          "둘 다 잡는다",
          0.45,
          { attrs: { iq: 1 }, rand: 1, amt: 1, msg: "공부와 훈련을 모두 해냈어요." },
          { health: -8, msg: "밤샘이 이어져 몸이 많이 지쳤어요.", t: "bad" },
        ),
      ],
    }),
  },
  {
    id: "trip",
    when: isHs,
    make: () => ({
      title: "수학여행과 전지훈련",
      body: "수학여행 날짜가 겨울 전지훈련과 겹쳤어요.",
      opts: [
        opt("수학여행 간다", { health: 8, msg: "친구들과 수학여행을 다녀왔어요." }),
        opt("전지훈련 간다", { rand: 2, amt: 1, health: -5, trust: 1, msg: "전지훈련에서 땀을 흘렸어요." }),
      ],
    }),
  },
  {
    id: "senior",
    when: isHs,
    make: () => ({
      title: "선배와의 갈등",
      body: "주전 선배가 유독 나에게만 엄격해요. 팀 분위기가 묘해요.",
      opts: [
        opt("묵묵히 참는다", { trust: 1, health: -3, msg: "묵묵히 버텨 코치의 눈에 들었어요." }),
        risky(
          "코치에게 털어놓는다",
          0.5,
          { trust: 1, msg: "코치가 중재해 팀 분위기가 좋아졌어요." },
          { trust: -1, msg: "고자질로 오해받아 분위기가 어색해졌어요.", t: "bad" },
        ),
      ],
    }),
  },
  {
    id: "parents",
    when: isHs,
    once: true,
    make: () => ({
      title: "부모님의 걱정",
      body: "부모님이 농구보다 공부를 하길 바라세요. 운동선수의 미래가 걱정이래요.",
      opts: [
        risky(
          "내 꿈을 설득한다",
          0.7,
          { rand: 1, amt: 1, health: 4, msg: "부모님이 내 꿈을 응원해 주기로 했어요." },
          { msg: "부모님은 아직 걱정이 크세요. 실력으로 보여줘야겠어요.", t: "info" },
        ),
        opt("학원도 다닌다", { attrs: { iq: 1 }, health: -5, msg: "학원과 훈련을 함께 하기로 했어요." }),
      ],
    }),
  },

  /* 대학생 */
  {
    id: "grades",
    when: isCollege,
    make: () => ({
      title: "학점 경고",
      body: "지난 학기 학점이 기준에 못 미쳐요. 이번에도 낮으면 출전 정지예요.",
      opts: [
        opt("도서관에서 산다", { attrs: { iq: 1 }, health: 3, msg: "학점을 지켜냈어요." }),
        risky(
          "벼락치기로 버틴다",
          0.55,
          { rand: 1, amt: 1, msg: "간신히 기준을 넘기고 훈련도 지켰어요." },
          { trust: -2, msg: "학점 미달로 출전 정지 징계를 받아 코치 신뢰를 잃었어요.", t: "bad" },
        ),
      ],
    }),
  },
  {
    id: "vlog",
    when: isCollege,
    make: () => ({
      title: "농구 브이로그 제안",
      body: "친구가 훈련 브이로그 채널을 함께 만들자고 해요.",
      opts: [
        risky(
          "채널을 연다",
          0.4,
          { money: 0.3, msg: "브이로그가 입소문을 타 구독자가 크게 늘었어요." },
          { health: -3, msg: "촬영에 시간을 뺏겨 피곤한 여름이었어요.", t: "info" },
        ),
        opt("훈련에 집중", { trust: 1, msg: "카메라 대신 공에 집중했어요." }),
      ],
    }),
  },
  {
    id: "nil",
    when: (c) => isCollege(c) && c.team?.lg === "ncaa",
    make: () => {
      const pay = roundSalary(rnd(0.2, 0.8));
      return {
        title: "NIL 후원 제안",
        body: "지역 자동차 딜러가 이름·초상권(NIL) 후원 계약을 제안했어요. 광고 촬영이 몇 번 있어요.",
        opts: [
          opt("계약한다", { money: pay, health: -2, msg: "첫 NIL 후원 계약을 맺었어요." }, "NIL"),
          pass("농구에만 집중", "후원 제안을 정중히 거절했어요."),
        ],
      };
    },
  },
  {
    id: "mt",
    when: isCollege,
    make: () => ({
      title: "MT와 연습 경기",
      body: "학과 MT 날이 팀 연습 경기와 겹쳤어요.",
      opts: [
        opt("MT 간다", { health: 6, msg: "동기들과 MT에서 실컷 웃었어요." }),
        opt("연습 경기 뛴다", { rand: 1, amt: 1, trust: 1, msg: "연습 경기에서 눈도장을 찍었어요." }),
      ],
    }),
  },

  /* 프로 */
  {
    id: "method",
    when: isPro,
    make: () => ({
      title: "훈련 방식 재검토",
      body: "구단 데이터팀이 슈팅 폼과 웨이트 방식을 바꿔보자고 제안해요.",
      opts: [
        risky(
          "새 방식을 받아들인다",
          0.6,
          { rand: 2, amt: 2, msg: "새 훈련 방식이 몸에 잘 맞았어요." },
          { attrs: { sht: -1 }, health: -3, msg: "새 폼이 몸에 안 맞아 슈팅 감각이 흔들렸어요.", t: "bad" },
        ),
        opt("지금 방식을 지킨다", { health: 3, msg: "익숙한 루틴을 지키기로 했어요.", t: "info" }),
      ],
    }),
  },
  {
    id: "agency",
    when: (c) => isPro(c) && !c.perks.agency,
    once: true,
    make: (c) => {
      const fee = roundSalary(clamp(salary(c) * 0.05, 0.1, 20));
      return {
        title: "에이전시 이적 제안",
        body: "대형 스포츠 에이전시에서 연락이 왔어요. 지금 에이전트와는 데뷔 때부터 함께했어요.",
        opts: [
          opt("대형 에이전시와 계약", { agency: true, money: -fee, msg: "대형 에이전시와 손잡았어요. 다음 협상이 기대돼요." }, "에이전시"),
          opt("지금 에이전트와 함께", { health: 3, msg: "오랜 에이전트와 계속 함께하기로 했어요." }),
        ],
      };
    },
  },
  {
    id: "trainer",
    when: isPro,
    make: (c) => {
      const cost = roundSalary(clamp(salary(c) * 0.03, 0.05, 10));
      const now = c.perks.trainer;
      const options = TRAINERS.filter(([k]) => k !== now)
        .slice(0, 3)
        .map(([k, name]) => opt(name, { trainer: k, attrs: { [k]: 1 }, money: -cost, msg: `${name}와 전담 계약을 맺었어요.` }));
      return {
        title: now ? "개인 트레이너 교체" : "전담 트레이너 영입",
        body: now
          ? `지금은 ${SHORT[now]} 위주로 관리받고 있어요. 다른 분야 전문가로 바꿔볼까요?`
          : "더 체계적인 관리를 위해 전담 트레이너를 구할까요?",
        opts: [...options, pass(now ? "지금 트레이너 유지" : "구단 트레이너로 충분해요", "지금 관리 방식을 유지하기로 했어요.")],
      };
    },
  },
  {
    id: "sns",
    when: isPro,
    make: () => ({
      title: "SNS 논란",
      body: "경기 후 올린 게시물이 오해를 사 논란이 됐어요.",
      opts: [
        pass("공식 사과문", "진심 어린 사과로 논란이 가라앉았어요."),
        risky(
          "라이브 방송으로 해명",
          0.5,
          { trust: 1, msg: "솔직한 해명으로 오히려 팬이 늘었어요." },
          { trust: -1, health: -4, msg: "해명이 논란을 키워 한동안 마음고생을 했어요.", t: "bad" },
        ),
      ],
    }),
  },
  {
    id: "ad",
    when: (c) => isPro(c) && ovr(c.p) >= 72,
    make: (c) => {
      const pay = roundSalary(clamp(ovr(c.p) - 70, 1, 20) * 1.5);
      return {
        title: "광고 모델 제안",
        body: "스포츠 브랜드에서 광고 촬영을 제안했어요.",
        opts: [
          opt("수락", { money: pay, health: -3, msg: "광고 촬영을 마쳤어요." }),
          opt("거절하고 훈련", { trust: 1, msg: "시즌 준비에만 집중했어요." }),
        ],
      };
    },
  },
  {
    id: "variety",
    when: (c) => isPro(c) && ovr(c.p) >= 70,
    make: (c) => {
      const pay = roundSalary(clamp((ovr(c.p) - 65) * 0.4, 0.5, 15));
      return {
        title: "예능 출연 제안",
        body: "인기 예능 프로그램에서 출연 제안이 왔어요. 촬영은 오프시즌 내내 이어져요.",
        opts: [
          opt("출연한다", { money: pay, health: -3, trust: -1, msg: "예능 출연으로 얼굴을 알렸어요." }),
          pass("시즌 준비에 집중", "예능 출연을 고사했어요."),
        ],
      };
    },
  },
  {
    id: "mentor",
    when: (c) => isPro(c) && c.age <= 24,
    make: () => ({
      title: "베테랑의 개인 레슨",
      body: "팀 베테랑이 여름 개인 훈련을 함께하자고 해요.",
      opts: [
        opt("따라간다", { attrs: { iq: 1, def: 1 }, msg: "베테랑에게 프로의 습관을 배웠어요." }),
        pass("혼자 훈련", "여름은 혼자 훈련했어요."),
      ],
    }),
  },
  {
    id: "youth",
    when: (c) => isPro(c) && c.age >= 25,
    make: () => ({
      title: "모교 유소년 캠프",
      body: "모교에서 유소년 농구 캠프 일일 코치를 부탁했어요.",
      opts: [
        opt("기꺼이 간다", { attrs: { iq: 1 }, health: -2, msg: "아이들을 가르치며 기본기를 다시 돌아봤어요." }),
        pass("정중히 거절", "일정이 맞지 않아 캠프에 가지 못했어요."),
      ],
    }),
  },

  /* 무소속 */
  {
    id: "coachjob",
    when: isFree,
    make: () => ({
      title: "유소년 코치 아르바이트",
      body: "동네 농구교실에서 주말 코치를 구한대요.",
      opts: [
        opt("코치 일을 한다", { money: 0.2, attrs: { iq: 1 }, health: -2, msg: "아이들을 가르치며 생활비를 벌었어요." }),
        opt("개인 훈련만", { rand: 1, amt: 1, msg: "개인 훈련에만 매달렸어요." }),
      ],
    }),
  },
  {
    id: "street",
    when: isFree,
    make: () => ({
      title: "3대3 길거리 대회",
      body: "상금이 걸린 3대3 길거리 대회가 열려요. 스카우트도 온다는 소문이에요.",
      opts: [
        risky(
          "출전한다",
          0.5,
          { money: 0.1, rand: 1, amt: 1, msg: "3대3 대회에서 우승했어요." },
          { health: -5, msg: "거친 몸싸움에 몸만 상했어요.", t: "bad" },
        ),
        pass("쉬면서 준비한다", "대회 대신 몸을 만들었어요."),
      ],
    }),
  },
];

/* ---------- 시즌 중 이벤트 ---------- */

/** 정규시즌을 치르는 중인지 (경기력·휴식 효과가 의미 있을 때) */
const inGames = (c: Career) => !!c.run && c.run.games > 0;
const inSchoolGames = (c: Career) => inGames(c) && (isHs(c) || isCollege(c));
const inProGames = (c: Career) => inGames(c) && isPro(c);
/** 팀 없이 보내는 시즌 */
const offCourt = (c: Career) => !!c.run && c.run.games === 0;

/** 시즌 도중에 생기는 일. 경기력(form)과 휴식(sit)은 남은 경기에만 영향을 줘요. */
const SEASON_EVENTS: LifeEvent[] = [
  {
    id: "s-slump",
    when: inGames,
    make: (c) => {
      const fee = roundSalary(clamp(salary(c) * 0.02, 0.01, 2));
      return {
        title: "슛 감각 난조",
        body: "최근 몇 경기째 슛이 림을 외면해요. 코치는 별말 없지만 신경이 쓰여요.",
        opts: [
          opt("새벽 추가 훈련", { form: 1, health: -5, msg: "새벽 훈련으로 슛 감각을 되찾았어요." }),
          opt("멘탈 코치와 상담", { form: 0.7, money: -fee, msg: "멘탈 코치와 이야기하며 마음이 편해졌어요." }),
          pass("감을 믿고 기다린다", "조급해하지 않고 평소 루틴을 지켰어요."),
        ],
      };
    },
  },
  {
    id: "s-rival",
    when: inGames,
    make: () => ({
      title: "라이벌의 도발",
      body: "다음 상대 팀 에이스가 인터뷰에서 나를 콕 집어 '별것 아니다'라고 했어요.",
      opts: [
        risky(
          "코트에서 갚아 준다",
          0.55,
          { form: 1, msg: "맞대결에서 완승하며 기세가 올랐어요." },
          { form: -1, msg: "의욕이 앞서 무리하다 경기를 망쳤어요.", t: "bad" },
        ),
        pass("신경 쓰지 않는다", "도발에 반응하지 않고 내 경기를 했어요."),
      ],
    }),
  },
  {
    id: "s-vet",
    when: inGames,
    make: () => ({
      title: "선배의 개인 지도",
      body: "팀 고참 선배가 경기 뒤 따로 남아 함께 연습하자고 해요.",
      opts: [
        opt("경기 영상을 같이 본다", { attrs: { iq: 1 }, msg: "선배와 영상을 보며 경기를 읽는 눈이 생겼어요." }),
        opt("슈팅 연습을 같이 한다", { attrs: { sht: 1 }, health: -2, msg: "선배에게 슈팅 요령을 배웠어요." }),
      ],
    }),
  },
  {
    id: "s-fatigue",
    when: inProGames,
    make: () => ({
      title: "연전 피로",
      body: "원정 연전이 이어지며 다리가 무거워요. 트레이너는 쉬어 가라고 해요.",
      opts: [
        opt("휴식을 요청한다", { sit: 2, health: 8, msg: "두 경기를 쉬며 몸을 추슬렀어요." }),
        opt("참고 계속 뛴다", { form: 0.5, health: -7, msg: "피곤함을 참고 계속 코트에 섰어요." }),
      ],
    }),
  },
  {
    id: "s-media",
    when: inProGames,
    make: (c) => {
      const pay = roundSalary(clamp(salary(c) * 0.03, 0.05, 3));
      return {
        title: "방송 출연 제안",
        body: "인기 예능 프로그램에서 게스트로 나와 달라고 해요. 촬영은 휴식일이에요.",
        opts: [
          opt("출연한다", { money: pay, health: -3, msg: "예능 출연으로 얼굴을 알렸어요." }),
          opt("경기에만 집중", { form: 0.5, msg: "다음 경기 준비에만 집중했어요." }),
        ],
      };
    },
  },
  {
    id: "s-scout",
    when: inSchoolGames,
    make: () => ({
      title: "관중석의 스카우트",
      body: "오늘 경기에 프로 스카우트들이 왔다는 소문이 돌아요.",
      opts: [
        risky(
          "눈도장을 찍으려 몰아붙인다",
          0.5,
          { form: 1, rand: 1, amt: 1, msg: "스카우트 앞에서 인생 경기를 펼쳤어요." },
          { form: -0.5, health: -5, msg: "무리하다 실수가 쏟아졌어요.", t: "bad" },
        ),
        pass("평소처럼 뛴다", "스카우트를 의식하지 않고 평소대로 뛰었어요."),
      ],
    }),
  },
  {
    id: "s-midterm",
    when: inSchoolGames,
    make: () => ({
      title: "중간고사와 원정 경기",
      body: "중간고사 기간에 원정 경기가 이어져요. 버스에서라도 공부해야 할까요?",
      opts: [
        opt("공부도 챙긴다", { attrs: { iq: 1 }, form: -0.5, msg: "시험과 경기를 함께 버텨 냈어요." }),
        opt("농구에 집중", { form: 0.7, msg: "시험은 뒷전으로 하고 경기에 집중했어요." }),
      ],
    }),
  },
  {
    id: "s-pickup",
    when: (c) => offCourt(c) && isFree(c),
    make: () => ({
      title: "실내 체육관 픽업 게임",
      body: "근처 체육관에서 프로 출신 선수들이 픽업 게임을 한다고 해요.",
      opts: [
        risky(
          "끼워 달라고 한다",
          0.6,
          { rand: 1, amt: 1, msg: "프로 출신들과 부딪치며 감각을 지켰어요." },
          { health: -5, msg: "거친 몸싸움에 발목을 삐었어요.", t: "bad" },
        ),
        pass("혼자 훈련한다", "계획한 개인 훈련을 이어 갔어요."),
      ],
    }),
  },
  {
    id: "s-barracks",
    when: (c) => offCourt(c) && c.stage === "military",
    make: () => ({
      title: "부대의 개인 정비 시간",
      body: "주말 개인 정비 시간이 생겼어요. 어떻게 보낼까요?",
      opts: [
        opt("연병장에서 개인 운동", { attrs: { ath: 1 }, health: -3, msg: "주말마다 개인 운동으로 몸을 지켰어요." }),
        opt("푹 쉰다", { health: 6, msg: "모처럼 푹 쉬며 몸을 회복했어요." }),
      ],
    }),
  },
];

/** 의료진이 오래 쉬라고 할 때 고르는 복귀 시점 */
export function injuryDecision(out: number): Decision {
  return {
    title: "부상 복귀 시점",
    body: `의료진은 ${out}경기 정도 쉬어야 한다고 해요. 팀은 하루라도 빨리 돌아오길 바라는 눈치예요.`,
    opts: [
      opt("서둘러 복귀한다", { sit: -Math.round(out * 0.4), health: -6, form: -0.5, msg: "재활을 서둘러 예정보다 일찍 돌아오기로 했어요.", t: "info" }),
      opt("완전히 회복한다", { health: 6, msg: "서두르지 않고 몸을 완전히 회복하기로 했어요." }),
    ],
  };
}

/**
 * 빅매치나 결승을 앞두고 몸을 던질지 고르는 결정. 건강할수록 강행이 성공하기 쉬워요.
 * 성공하면 경기력이 오르고, 실패하면 다쳐서 다음 경기(결승이면 결승)에 나서지 못해요.
 */
export function bigGameDecision(c: Career, label: string, final: boolean): Decision {
  const h = Math.round(c.health);
  const p = clamp(0.3 + c.health / 140 + (c.p.trait === "승부사" ? 0.1 : 0), 0.3, 0.92);
  const hurt = final ? 3 : ri(1, 3);
  const body = h >= 75 ? "몸 상태는 괜찮아요" : h >= 50 ? "다리가 조금 무거워요" : "몸이 많이 지쳐 있어요";
  return {
    title: final ? "결승 출전" : `빅매치 · ${label}`,
    body: `${final ? label : `${josa(label, "이", "가")} 다가와요`}. ${body}(건강 ${h}). 몸을 던지면 경기력이 오르지만, 버티지 못하면 다쳐서 ${final ? "결승에" : "다음 경기에"} 나서지 못해요.`,
    opts: [
      risky(
        final ? "모든 걸 쏟아붓는다" : "출전을 강행한다",
        p,
        { form: 1.2, health: -3, msg: final ? "결승을 앞두고 컨디션을 끌어올렸어요." : `${label}에서 몸을 던져 흐름을 가져왔어요.` },
        { injure: hurt, health: -8, msg: `무리하다 다쳤어요. ${hurt}경기는 쉬어야 해요.`, t: "bad" },
      ),
      final
        ? pass("출전 시간을 조절하며 뛴다", "무리하지 않고 평소처럼 결승을 준비했어요.")
        : opt("이번 경기는 쉰다", { sit: 1, health: 5, msg: `${label}에 나서지 않고 몸을 추슬렀어요.`, t: "info" }),
    ],
  };
}

/** 같은 이벤트는 이 기간 안에 다시 나오지 않아요. */
const COOLDOWN = 3;

/** 겪을 수 있는 이벤트 가운데 하나를 골라요. 고른 이벤트는 기록해 둬요. */
function drawEvent(c: Career, events: LifeEvent[]): Decision | null {
  const seen = c.events;
  const pool = events.filter((e) => {
    const last = seen[e.id];
    if (last !== undefined && (e.once || c.year - last < COOLDOWN)) return false;
    return !e.when || e.when(c);
  });
  if (!pool.length) return null;
  const e = pick(pool);
  seen[e.id] = c.year;
  return e.make(c);
}

/** 지금 단계에 맞는 생활 이벤트를 하나 골라요. 오프시즌에 생겨요. */
export const lifeEvent = (c: Career): Decision | null => drawEvent(c, EVENTS);

/** 시즌 도중에 생기는 이벤트를 하나 골라요. */
export const seasonEvent = (c: Career): Decision | null => drawEvent(c, SEASON_EVENTS);
