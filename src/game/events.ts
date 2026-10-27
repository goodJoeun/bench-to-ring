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
/** 연봉의 pct만큼, lo~hi 억 사이로 정한 금액 */
const cut = (c: Career, pct: number, lo: number, hi: number) => roundSalary(clamp(salary(c) * pct, lo, hi));

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

  {
    id: "yoga",
    make: (c) => {
      const fee = cut(c, 0.01, 0.01, 1);
      return {
        title: "요가 클래스 체험권",
        body: "팀 트레이너가 유연성이 부족하다며 요가 클래스를 추천했어요. 주변에선 '농구 선수가 무슨 요가냐'며 웃어요.",
        opts: [
          opt("한 달 등록한다", { health: 6, money: -fee, msg: "몸이 부드러워지니 착지가 한결 편해졌어요." }),
          pass("웃고 넘긴다", "요가 매트 대신 농구공을 잡았어요."),
        ],
      };
    },
  },
  {
    id: "gaming",
    make: () => ({
      title: "새로 나온 농구 게임",
      body: "친구들이 새로 나온 농구 게임을 밤새 같이 하자고 해요. 게임 속 내 능력치가 실제보다 낮게 나와서 은근히 자존심이 상해요.",
      opts: [
        risky(
          "딱 한 판만 한다",
          0.5,
          { attrs: { iq: 1 }, msg: "게임 속 전술 화면에서 의외의 힌트를 얻었어요." },
          { health: -5, msg: "한 판이 열 판이 됐어요. 다음 날 훈련이 지옥이었어요.", t: "bad" },
        ),
        opt("게임 능력치를 넘어서겠다며 체육관으로", { rand: 1, amt: 1, msg: "자존심이 최고의 훈련 동기였어요." }),
      ],
    }),
  },
  {
    id: "dunkshow",
    when: (c) => !isFree(c),
    make: () => ({
      title: "덩크 콘테스트 초청",
      body: "올스타 행사 덩크 콘테스트에 나와 달래요. 마스코트 위를 넘는 덩크를 기대하는 눈치예요.",
      opts: [
        risky(
          "마스코트를 넘는다",
          0.5,
          { attrs: { ath: 1 }, trust: 1, msg: "마스코트를 훌쩍 넘는 덩크로 하이라이트를 장식했어요." },
          { health: -6, msg: "착지하다 발목을 접질렸어요. 마스코트는 무사해요.", t: "bad" },
        ),
        opt("심사위원석에 앉는다", { attrs: { iq: 1 }, msg: "남의 덩크를 보며 몸의 쓰임새를 공부했어요." }),
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

  {
    id: "transfer-hs",
    when: isHs,
    make: () => ({
      title: "명문고 감독의 전화",
      body: "다른 명문고 감독이 전학 오면 주전을 보장하겠대요. 지금 팀 동료들은 아직 이 사실을 몰라요.",
      opts: [
        opt("의리를 지킨다", { trust: 1, msg: "남기로 했어요. 감독님이 어깨를 두드려 줬어요." }),
        risky(
          "연습 경기만 같이 해 본다",
          0.4,
          { rand: 2, amt: 1, msg: "더 강한 선수들 틈에서 자극을 받고 돌아왔어요." },
          { trust: -1, msg: "전학 소문이 퍼져 팀에서 눈총을 받았어요.", t: "bad" },
        ),
      ],
    }),
  },
  {
    id: "letter",
    when: isHs,
    make: () => ({
      title: "사물함 속 편지",
      body: "사물함에 '경기 잘 보고 있어요'라는 편지가 들어 있어요. 보낸 사람 이름은 없어요.",
      opts: [
        opt("답장을 써서 붙여 둔다", { health: 4, msg: "답장이 사라졌어요. 다음 경기 관중석이 신경 쓰여요." }),
        opt("설렘을 슈팅 연습으로 바꾼다", { attrs: { sht: 1 }, msg: "두근거릴 때마다 슛을 던졌더니 손끝이 좋아졌어요." }),
      ],
    }),
  },
  {
    id: "growthplate",
    when: (c) => isHs(c) && c.age <= 18,
    make: () => ({
      title: "성장판 검사",
      body: "병원에서 성장판이 아직 조금 열려 있대요. 의사 선생님은 잠과 스트레칭을 강조해요.",
      opts: [
        opt("밤 11시 취침을 지킨다", { health: 5, attrs: { ath: 1 }, msg: "일찍 자는 습관이 생겼어요. 몸이 가벼워요." }),
        opt("밤에도 슛을 던진다", { attrs: { sht: 1 }, health: -3, msg: "잠보다 슛이 좋았어요." }),
      ],
    }),
  },
  {
    id: "alumni",
    when: isHs,
    make: () => ({
      title: "프로 선배의 모교 방문",
      body: "모교 출신 프로 선배가 훈련을 보러 왔어요. 딱 30분 시간이 있대요.",
      opts: [
        opt("1대1 레슨을 부탁한다", { attrs: { hdl: 1 }, msg: "선배의 드리블 요령 하나를 몸에 새겼어요." }),
        opt("프로 생활을 묻는다", { attrs: { iq: 1 }, health: 2, msg: "프로의 하루를 듣고 목표가 또렷해졌어요." }),
      ],
    }),
  },
  {
    id: "relay",
    when: isHs,
    make: () => ({
      title: "체육대회 계주 마지막 주자",
      body: "반 대표 계주 마지막 주자로 뽑혔어요. 우리 반은 지금 꼴찌예요.",
      opts: [
        risky(
          "전력으로 뛴다",
          0.65,
          { attrs: { ath: 1 }, trust: 1, msg: "역전 우승을 이끌어 전교의 영웅이 됐어요." },
          { health: -4, msg: "결승선 앞에서 넘어져 무릎이 까졌어요.", t: "bad" },
        ),
        pass("농구부 체면에 살살 뛴다", "부상 없이 체육대회를 마쳤어요."),
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

  {
    id: "abroadcamp",
    when: isCollege,
    make: () => ({
      title: "해외 대학 연합 캠프",
      body: "여름 방학 해외 대학 연합 캠프에 초청받았어요. 항공권은 내가 내야 해요.",
      opts: [
        opt("참가한다", { rand: 2, amt: 1, health: -4, money: -0.03, msg: "말은 안 통해도 농구는 통했어요." }),
        pass("국내에서 훈련", "익숙한 체육관에서 여름을 보냈어요."),
      ],
    }),
  },
  {
    id: "roommate",
    when: isCollege,
    make: () => ({
      title: "기숙사 룸메이트",
      body: "새 룸메이트가 밤마다 기타를 쳐요. 실력은 꽤 늘고 있는데 잠은 줄고 있어요.",
      opts: [
        opt("대화로 규칙을 정한다", { health: 4, msg: "밤 10시 이후엔 이어폰 연습으로 합의했어요." }),
        opt("새벽 체육관으로 피신", { attrs: { sht: 1 }, health: -3, msg: "잠 못 드는 밤마다 체육관에서 슛을 던졌어요." }),
      ],
    }),
  },
  {
    id: "lab",
    when: isCollege,
    make: () => ({
      title: "스포츠과학 연구 참여",
      body: "스포츠과학과 교수님이 운동 데이터 연구에 참여해 달래요. 온몸에 센서를 붙여야 해요.",
      opts: [
        opt("실험에 참여한다", { attrs: { iq: 1 }, health: 2, msg: "내 몸의 데이터를 보고 훈련법을 고쳤어요." }),
        pass("수업만 듣는다", "연구 참여는 정중히 거절했어요."),
      ],
    }),
  },
  {
    id: "universiade",
    when: isCollege,
    make: () => ({
      title: "유니버시아드 대표 선발전",
      body: "대학 대표 선발전이 열려요. 뽑히면 여름 내내 국제 대회에 나가요.",
      opts: [
        risky(
          "선발전에 나간다",
          0.45,
          { rand: 1, amt: 2, trust: 1, msg: "대학 대표로 뽑혀 국제 무대를 경험했어요." },
          { health: -3, msg: "아쉽게 떨어졌지만 좋은 경험이었어요.", t: "info" },
        ),
        pass("팀 훈련에 집중", "선발전 대신 소속팀 훈련을 택했어요."),
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

  {
    id: "dog",
    when: isPro,
    once: true,
    make: () => ({
      title: "보호소의 강아지",
      body: "봉사활동 간 보호소에서 한 강아지가 계속 따라와요. 원정 경기가 많아 걱정이에요.",
      opts: [
        opt("입양한다", { health: 5, msg: "새 가족이 생겨 원정길이 덜 외로워졌어요." }),
        pass("자주 보러 온다고 약속한다", "주말마다 보호소에 들르기로 했어요."),
      ],
    }),
  },
  {
    id: "charity",
    when: isPro,
    make: () => ({
      title: "자선 경기 초청",
      body: "소아암 환우를 돕는 자선 경기에 초청받았어요. 오프시즌 휴가와 겹쳐요.",
      opts: [
        opt("뛴다", { trust: 1, health: -2, msg: "아이들의 응원 속에 의미 있는 경기를 뛰었어요." }),
        opt("휴가를 지킨다", { health: 5, msg: "가족과 푹 쉬며 휴가를 보냈어요.", t: "info" }),
      ],
    }),
  },
  {
    id: "scheme",
    when: isPro,
    make: (c) => {
      const stake = cut(c, 0.2, 0.05, 50);
      return {
        title: "지인의 투자 권유",
        body: "오랜 지인이 '절대 안 망하는' 사업이라며 투자를 권해요. 설명을 들을수록 더 헷갈려요.",
        opts: [
          risky(
            "투자한다",
            0.3,
            { money: stake, msg: "놀랍게도 사업이 대박 났어요." },
            { money: -stake, msg: "역시나 사업이 망했어요. 돈은 돌아오지 않았어요.", t: "bad" },
          ),
          pass("정중히 거절한다", "농구로 버는 돈이 가장 확실하다고 생각했어요."),
        ],
      };
    },
  },
  {
    id: "diet-shift",
    when: isPro,
    make: () => ({
      title: "식단 혁명",
      body: "영양사가 탄수화물을 확 줄이는 새 식단을 권해요. 동료 하나는 효과를 봤대요.",
      opts: [
        risky(
          "식단을 바꾼다",
          0.6,
          { health: 6, attrs: { ath: 1 }, msg: "몸이 가벼워지고 회복이 빨라졌어요." },
          { health: -3, msg: "체중이 너무 빠져 몸싸움에서 밀렸어요.", t: "bad" },
        ),
        pass("먹던 대로 먹는다", "어머니표 집밥이 최고라고 믿기로 했어요."),
      ],
    }),
  },
  {
    id: "captain",
    when: (c) => isPro(c) && c.age >= 27,
    make: () => ({
      title: "주장 제안",
      body: "감독이 다음 시즌 주장을 맡아 달래요. 후배들 고민 상담까지 해야 해요.",
      opts: [
        opt("주장 완장을 찬다", { trust: 2, health: -3, msg: "주장이 됐어요. 책임감이 무거워요." }),
        opt("경기에만 집중하겠다고 말한다", { health: 2, msg: "주장은 고사하고 코트에서 보여주기로 했어요.", t: "info" }),
      ],
    }),
  },
  {
    id: "shoe",
    when: (c) => isPro(c) && ovr(c.p) >= 78,
    once: true,
    make: (c) => {
      const pay = roundSalary(clamp((ovr(c.p) - 75) * 2, 2, 60));
      return {
        title: "시그니처 농구화 제안",
        body: "스포츠 브랜드가 내 이름을 단 농구화를 만들고 싶대요. 디자인 회의에 자주 나와야 해요.",
        opts: [
          opt("디자인까지 참여한다", { money: pay, health: -3, msg: "내 이름이 새겨진 농구화가 나왔어요." }, "시그니처"),
          opt("이름만 빌려준다", { money: roundSalary(pay * 0.4), msg: "농구화는 나왔지만 디자인은 조금 아쉬워요." }),
        ],
      };
    },
  },
  {
    id: "podcast",
    when: isPro,
    make: (c) => {
      const pay = cut(c, 0.02, 0.02, 3);
      return {
        title: "농구 팟캐스트 게스트",
        body: "인기 농구 팟캐스트에서 게스트로 나와 달래요. 진행자가 돌직구 질문으로 유명해요.",
        opts: [
          risky(
            "거침없이 말한다",
            0.5,
            { money: pay, trust: 1, msg: "솔직한 입담으로 화제가 됐어요." },
            { trust: -1, msg: "전 소속팀 이야기가 기사화돼 곤란했어요.", t: "bad" },
          ),
          opt("무난하게 마친다", { money: roundSalary(pay * 0.5), msg: "무난한 방송이었어요.", t: "info" }),
        ],
      };
    },
  },
  {
    id: "summerleague",
    when: (c) => isPro(c) && c.age <= 27,
    make: () => ({
      title: "해외 서머리그 초청",
      body: "해외 서머리그 팀이 오프시즌에 함께 뛰자고 해요. 휴가는 반납해야 해요.",
      opts: [
        opt("참가한다", { rand: 2, amt: 1, health: -5, msg: "낯선 리그에서 새로운 스타일을 익혔어요." }),
        pass("쉬면서 시즌을 준비한다", "서머리그 대신 몸을 만들었어요."),
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
  {
    id: "tryout",
    when: isFree,
    make: () => ({
      title: "구단 공개 테스트",
      body: "한 구단이 무소속 선수 공개 테스트를 연대요. 지원자가 백 명이 넘어요.",
      opts: [
        risky(
          "테스트를 받는다",
          0.5,
          { rand: 1, amt: 1, trust: 1, msg: "좋은 인상을 남겼어요. 시장이 열리면 연락하겠대요." },
          { health: -3, msg: "긴장한 탓에 실력을 다 보여주지 못했어요.", t: "info" },
        ),
        pass("다음 기회를 노린다", "테스트 대신 개인 훈련을 이어 갔어요."),
      ],
    }),
  },
  {
    id: "asialeague",
    when: isFree,
    make: () => ({
      title: "아시아 리그 단기 계약 제안",
      body: "해외 아시아 리그 팀이 몇 주간 함께 훈련해 보자고 해요. 숙소비는 내가 내야 해요.",
      opts: [
        opt("현지 훈련에 합류한다", { rand: 2, amt: 1, money: -0.05, health: -3, msg: "낯선 코트에서 경기 감각을 되찾았어요." }),
        opt("국내에서 준비한다", { health: 4, msg: "익숙한 곳에서 몸을 만들었어요.", t: "info" }),
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
    id: "s-buzzer",
    when: inGames,
    make: () => ({
      title: "놓친 버저비터",
      body: "지난 경기 마지막 슛이 림을 돌아 나왔어요. 하이라이트 영상이 계속 돌아다녀요.",
      opts: [
        opt("영상을 백 번 돌려 본다", { attrs: { iq: 1 }, form: -0.3, msg: "무엇이 문제였는지 알았지만 아직 마음이 무거워요." }),
        risky(
          "잊고 다음 경기만 본다",
          0.6,
          { form: 1, msg: "털어 내고 나니 오히려 몸이 가벼워졌어요." },
          { form: -0.7, msg: "잊으려 할수록 그 장면이 떠올랐어요.", t: "bad" },
        ),
      ],
    }),
  },
  {
    id: "s-argue",
    when: inGames,
    make: () => ({
      title: "동료와 언쟁",
      body: "수비 실수를 두고 동료와 벤치에서 언성을 높였어요. 중계 카메라에 그대로 잡혔어요.",
      opts: [
        opt("먼저 사과한다", { form: 0.5, msg: "먼저 손을 내밀었더니 팀 분위기가 좋아졌어요." }),
        risky(
          "제대로 짚고 넘어간다",
          0.5,
          { form: 1, msg: "속을 털어놓고 나니 손발이 더 잘 맞게 됐어요." },
          { form: -1, msg: "냉랭한 분위기가 경기력에 묻어났어요.", t: "bad" },
        ),
      ],
    }),
  },
  {
    id: "s-flu",
    when: inGames,
    make: () => ({
      title: "원정길 몸살",
      body: "원정 숙소에서 열이 올라요. 다음 경기는 꼭 이겨야 하는 경기예요.",
      opts: [
        opt("하루 쉰다", { sit: 1, health: 5, msg: "한 경기를 쉬며 몸살을 털어 냈어요.", t: "info" }),
        opt("약 먹고 뛴다", { health: -6, form: -0.5, msg: "열을 참고 뛰었지만 몸이 무거웠어요.", t: "bad" }),
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
    id: "s-press",
    when: (c) => inGames(c) && (isPro(c) || isCollege(c)),
    make: (c) => {
      const run = c.run!;
      // 팀 성적에 따라 기자의 질문이 달라져요. 성적이 고만고만하면 짓궂은 질문이 나와요.
      if (run.w >= run.l + 3)
        return {
          title: "기자회견: 우승 후보?",
          body: `${run.w}승 ${run.l}패로 순항 중이에요. 경기 뒤 기자회견에서 기자가 물어요. "우승 후보라는 평가, 동의하나요?"`,
          opts: [
            opt("한 경기씩 집중하겠다고 답한다", { form: 0.5, msg: "겸손한 답변에 동료들도 고개를 끄덕였어요." }),
            risky(
              "우승하겠다고 선언한다",
              0.5,
              { form: 1.2, trust: 1, msg: "우승 선언이 라커룸에 불을 붙였어요." },
              { form: -0.8, msg: "'우승 선언' 헤드라인이 부담으로 돌아왔어요.", t: "bad" },
            ),
          ],
        };
      if (run.l >= run.w + 3)
        return {
          title: "기자회견: 부진의 이유",
          body: `${run.w}승 ${run.l}패로 고전하고 있어요. 기자회견에서 기자가 물어요. "부진의 원인이 어디에 있다고 보나요?"`,
          opts: [
            opt("내가 더 잘해야 한다고 답한다", { form: 0.5, trust: 1, msg: "책임을 짊어진 답변에 코칭스태프가 믿음을 보였어요." }),
            risky(
              "작전에 아쉬움이 있다고 말한다",
              0.4,
              { form: 1, msg: "솔직한 발언 뒤 감독이 전술을 손봤고, 팀이 살아났어요." },
              { form: -0.5, trust: -1, msg: "감독과의 불화설 기사가 쏟아졌어요.", t: "bad" },
            ),
          ],
        };
      return {
        title: "기자회견: 짓궂은 질문",
        body: "경기 뒤 기자회견에서 한 기자가 농구와 상관없는 사생활 질문을 던졌어요. 카메라가 모두 나를 향해요.",
        opts: [
          risky(
            "재치 있는 농담으로 넘긴다",
            0.6,
            { form: 0.7, msg: "센스 있는 답변이 화제가 되며 기분 좋게 다음 경기를 맞았어요." },
            { form: -0.5, msg: "농담이 엉뚱하게 받아들여져 해명하느라 진땀을 뺐어요.", t: "bad" },
          ),
          opt("농구 얘기만 하겠다고 답한다", { form: 0.3, msg: "단호한 답변으로 경기에만 집중했어요." }),
        ],
      };
    },
  },
  {
    id: "s-trade-rumor",
    when: inProGames,
    make: () => ({
      title: "트레이드 루머",
      body: "트레이드 마감 직전, 기자들이 내 이름이 협상 테이블에 올랐다고 물어요.",
      opts: [
        opt("코트에서 답한다", { form: 0.5, msg: "루머에 흔들리지 않고 경기로 답했어요." }),
        risky(
          "에이전트에게 확인한다",
          0.5,
          { health: 3, msg: "헛소문으로 확인돼 마음이 놓였어요." },
          { form: -1, msg: "실제로 논의가 오갔다는 말에 마음이 복잡해졌어요.", t: "bad" },
        ),
      ],
    }),
  },
  {
    id: "s-fanmeet",
    when: inProGames,
    make: () => ({
      title: "올스타 팬 투표 독려",
      body: "구단이 올스타 팬 투표를 앞두고 팬 사인회를 열재요. 휴식일이 하루 줄어요.",
      opts: [
        opt("사인회를 연다", { form: 0.7, health: -3, msg: "팬들의 응원에 힘이 났어요." }),
        pass("쉬겠다고 말한다", "휴식일을 지키며 다음 경기를 준비했어요."),
      ],
    }),
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
    id: "s-chant",
    when: inSchoolGames,
    make: () => ({
      title: "응원단의 깜짝 응원가",
      body: "학교 응원단이 내 이름으로 응원가를 만들었대요. 다음 홈경기에서 처음 부른대요.",
      opts: [
        risky(
          "세리머니까지 준비한다",
          0.5,
          { form: 1.2, msg: "세리머니까지 완벽한 홈경기였어요." },
          { form: -0.5, msg: "세리머니 생각하다 쉬운 슛을 놓쳤어요.", t: "bad" },
        ),
        opt("평소처럼 집중한다", { form: 0.5, msg: "응원가를 등에 업고 침착하게 뛰었어요." }),
      ],
    }),
  },
  {
    id: "s-newrole",
    when: inSchoolGames,
    make: () => ({
      title: "감독님의 포지션 실험",
      body: "감독님이 남은 경기 동안 볼 운반을 맡겨 보겠대요. 실수하면 바로 교체래요.",
      opts: [
        opt("해 본다", { attrs: { pas: 1 }, form: -0.5, msg: "낯선 역할에 진땀을 뺐지만 코트를 보는 시야가 넓어졌어요." }),
        opt("원래 역할을 원한다고 말한다", { form: 0.3, msg: "익숙한 자리에서 자신 있게 뛰었어요." }),
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
    id: "s-gymclosed",
    when: (c) => offCourt(c) && isFree(c),
    make: () => ({
      title: "다니던 체육관 공사",
      body: "매일 가던 사설 체육관이 공사로 한 달간 문을 닫아요.",
      opts: [
        opt("야외 코트에서 훈련한다", { attrs: { ath: 1 }, health: -3, msg: "바람 부는 야외 코트에서 하체가 단단해졌어요." }),
        opt("돈을 내고 프로 훈련장을 빌린다", { rand: 1, amt: 1, money: -0.1, msg: "좋은 시설에서 훈련을 이어 갔어요." }),
      ],
    }),
  },
  {
    id: "s-unitcup",
    when: (c) => offCourt(c) && c.stage === "military",
    make: () => ({
      title: "부대 대항 체육대회",
      body: "부대 대항 농구 대회에 부대 대표로 나가 달래요. 우승하면 포상 휴가가 걸려 있어요.",
      opts: [
        risky(
          "부대의 명예를 걸고 뛴다",
          0.6,
          { attrs: { iq: 1 }, health: 3, msg: "부대를 우승으로 이끌어 포상 휴가를 받았어요." },
          { health: -5, msg: "거친 몸싸움에 몸만 상했어요.", t: "bad" },
        ),
        opt("심판을 맡는다", { attrs: { iq: 1 }, msg: "심판을 보며 경기를 읽는 눈을 길렀어요." }),
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

/** 클러치 플레이: 공격 셋, 수비 둘. 각자 맡은 능력치가 높을수록 성공하기 쉬워요. */
const CLUTCH_PLAYS: { attr: AttrKey; side: "공격" | "수비"; label: string; play: string }[] = [
  { attr: "sht", side: "공격", label: "풀업 점퍼로 끝낸다", play: "종료 버저와 함께 풀업 점퍼" },
  { attr: "hdl", side: "공격", label: "아이솔레이션으로 돌파한다", play: "수비 둘을 제치는 돌파 레이업" },
  { attr: "pas", side: "공격", label: "더블팀을 끌어내 빈 동료에게 준다", play: "더블팀 사이로 찌른 결승 어시스트" },
  { attr: "def", side: "수비", label: "상대 에이스를 끝까지 막는다", play: "상대 에이스의 마지막 슛을 막아 낸 수비" },
  { attr: "ath", side: "수비", label: "블록슛을 노린다", play: "마지막 슛을 쳐 낸 블록슛" },
];

/**
 * 주전 이상일 때 중요한 경기에서 마지막 플레이를 맡는 결정. 고른 플레이의 능력치가 리그 평균보다 높을수록 성공하기 쉬워요.
 * 성공하면 그 경기를 이기고 그 능력치가 오르고, 실패하면 져요. 확률은 숫자로 보여주지 않아요.
 */
export function clutchDecision(c: Career, label: string, leagueAvg: number): Decision {
  const a = c.p.attrs;
  return {
    title: `클러치 · ${label}`,
    body: "동점으로 맞선 4쿼터 마지막 24초. 감독이 작전 타임에서 당신에게 마지막 플레이를 맡겼어요. 어디에 모든 걸 걸까요?",
    opts: CLUTCH_PLAYS.map((x) => ({
      label: x.label,
      sub: `${SHORT[x.attr]} ${Math.round(a[x.attr])} · 성공하면 경기 승리, ${SHORT[x.attr]} +1 · 실패하면 패배`,
      tag: x.side,
      act: {
        k: "clutch",
        attr: x.attr,
        play: x.play,
        p: clamp(0.45 + (a[x.attr] - leagueAvg) / 40 + (c.p.trait === "승부사" ? 0.1 : 0), 0.12, 0.88),
      },
    })),
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
