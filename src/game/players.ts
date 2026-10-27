import { chance, pick, shuffle } from "./random";
import type { Archetype, BeardStyle, HairStyle, Look, LookKey, LookRecord, Player, PosKey, Trait } from "./types";

/* 선수 생성 데이터: 플레이 유형, 숨은 특성, 외모 */

/**
 * 포지션별 플레이 유형. e는 후보를 만들 때 능력치에 곱하는 배수이고, 배수가 시작 능력치 상한도 정해요:
 * 1.45 이상은 주특기(55까지), 1.25 이상은 강점(50까지), 1.1 이상은 보조(47까지), 나머지는 45까지.
 * body는 이 유형에 어울리는 성인 키와 윙스팬(키 대비 cm) 범위예요. 없으면 포지션 기본값을 써요.
 * 유형 간 밸런스를 위해 배수 합계(각 배수 - 1의 합)는 0.55~0.65 안에 맞췄어요.
 */
export const ARCHETYPES: Record<PosKey, Archetype[]> = {
  PG: [
    {
      name: "클래식 포인트가드",
      e: { iq: 1.45, pas: 1.2 },
      desc: "경기 흐름을 읽고 템포를 조절하며 실수 없이 팀을 지휘하는 정통 포인트가드",
      kbl: ["이상민", "양동근"],
      nba: ["크리스 폴", "존 스탁턴"],
    },
    {
      name: "스코어링 가드",
      e: { sht: 1.4, hdl: 1.25 },
      desc: "풀업 3점, 미스매치 헌팅 등으로 득점력 좋은 1번",
      kbl: ["허훈", "(작)이정현"],
      nba: ["스테픈 커리", "앨런 아이버슨", "제일런 브런슨"],
    },
    {
      name: "락다운 가드",
      e: { def: 1.45, ath: 1.2 },
      body: { h: [183, 191], wsd: [4, 11] },
      desc: "상대 에이스 가드를 끈질기게 막고 스틸로 흐름을 끊는 수비형 가드",
      kbl: ["신명호", "박찬희"],
      nba: ["게리 페이튼", "즈루 할러데이"],
    },
    {
      name: "패스 마스터",
      e: { pas: 1.4, ath: 1.1, iq: 1.15 },
      desc: "번뜩이는 노룩·비하인드 패스를 즐기는 감각적인 포인트가드",
      kbl: ["김승현", "주희정"],
      nba: ["라존 론도", "제이슨 키드"],
    },
    {
      name: "스피드 가드",
      e: { ath: 1.45, hdl: 1.2 },
      body: { h: [178, 186] },
      desc: "폭발적인 첫 스텝으로 수비를 찢고 들어가 마무리하는 가드",
      kbl: ["김선형"],
      nba: ["자 모란트", "데릭 로즈"],
    },
    {
      name: "빅 가드",
      e: { pas: 1.3, def: 1.2, ath: 1.15 },
      body: { h: [189, 194], wsd: [3, 10] },
      desc: "큰 키와 운동능력으로 미스매치를 만들고 리바운드까지 걷어내는 대형 가드",
      kbl: ["이대성"],
      nba: ["매직 존슨", "러셀 웨스트브룩"],
    },
  ],
  SG: [
    {
      name: "퓨어 슈터",
      e: { sht: 1.5, iq: 1.1 },
      desc: "캐치 앤 슛 한 방으로 수비를 넓히는 정통 슈터",
      kbl: ["문경은", "우지원"],
      nba: ["레이 앨런", "카일 코버"],
    },
    {
      name: "슬래셔",
      e: { ath: 1.3, hdl: 1.2, sht:1.1 },
      body: { wsd: [3, 11] },
      desc: "돌파로 림을 공략해 파울과 앤드원을 얻어내는 공격형 가드",
      kbl: ["정영삼", "김선형"],
      nba: ["앤서니 에드워즈", "제일런 브라운"],
    },
    {
      name: "3&D 윙",
      e: { def: 1.3, sht: 1.3 },
      body: { h: [190, 198], wsd: [4, 11] },
      desc: "끈질긴 대인 수비와 코너 3점으로 팀에 보탬이 되는 롤 플레이어",
      kbl: ["문성곤", "유기상"],
      nba: ["데릭 화이트", "켄타비우스 콜드웰-포프"],
    },
    {
      name: "아이솔레이션 스코어러",
      e: { sht: 1.4, hdl: 1.15, iq: 1.1 },
      desc: "1대1로 미드레인지와 페이드어웨이를 꽂는 득점 기계",
      kbl: ["허재"],
      nba: ["코비 브라이언트", "마이클 조던"],
    },
    {
      name: "콤보 가드",
      e: { hdl: 1.3, pas: 1.15, sht: 1.15 },
      body: { h: [185, 192] },
      desc: "화려한 드리블로 공을 몰고 1번과 2번을 오가며 득점과 운영을 함께 맡는 가드",
      kbl: ["전태풍", "변준형"],
      nba: ["카이리 어빙", "제임스 하든"],
    },
  ],
  SF: [
    {
      name: "투웨이 포워드",
      e: { sht: 1.3, def: 1.25, hdl: 1.1 },
      body: { h: [197, 204], wsd: [4, 11] },
      desc: "스스로 슛을 만들어 내면서 수비에서도 상대 에이스와 맞붙는 공수 겸장",
      kbl: ["안영준", "송교창"],
      nba: ["카와이 레너드", "폴 조지"],
    },
    {
      name: "포인트 포워드",
      e: { pas: 1.45, iq: 1.15 },
      body: { h: [198, 204] },
      desc: "포워드 사이즈로 공을 운반하고 패스를 뿌리는 장신 플레이메이커",
      kbl: ["최준용"],
      nba: ["르브론 제임스", "스카티 피펜"],
    },
    {
      name: "스코어링 포워드",
      e: { sht: 1.45, hdl: 1.2 },
      desc: "어느 위치에서든 슛을 던질 수 있는 득점형 포워드",
      kbl: ["문태영", "애런 헤인즈"],
      nba: ["케빈 듀란트", "제이슨 테이텀"],
    },
    {
      name: "락다운 윙",
      e: { def: 1.5, ath: 1.15 },
      body: { wsd: [6, 12] },
      desc: "상대 주득점원을 전담 마크하는 수비 스페셜리스트",
      kbl: ["양희종"],
      nba: ["브루스 보웬", "루겐츠 도트"],
    },
    {
      name: "글루 가이",
      e: { iq: 1.4, def: 1.15, pas: 1.15 },
      desc: "빈자리를 채워 승리를 만들고 모든 팀에서 필요로 하는 살림꾼",
      kbl: ["추승균", "문정현"],
      nba: ["셰인 배티어", "안드레 이궈달라"],
    },
  ],
  PF: [
    {
      name: "스트레치 빅",
      e: { sht: 1.45, iq: 1.15, },
      body: { h: [203, 208] },
      desc: "외곽슛으로 상대 빅맨을 밖으로 끌어내 골밑 공간을 여는 장신 슈터",
      kbl: ["문태종"],
      nba: ["덕 노비츠키", "라샤드 루이스"],
    },
    {
      name: "포스트 파워",
      e: { sht: 1.25, ath: 1.3, hdl: 1.1 },
      body: { h: [199, 205], wsd: [2, 9] },
      desc: "등지고 밀어붙이는 포스트업과 몸싸움으로 골밑에서 점수를 쌓는 정통 4번",
      kbl: ["조니 맥도웰"],
      nba: ["칼 말론", "찰스 바클리"],
    },
    {
      name: "수비형 빅",
      e: { def: 1.4, iq: 1.1, ath:1.1 },
      body: { wsd: [6, 12] },
      desc: "도움 수비와 스위치로 팀 수비의 기둥이 되는 빅맨",
      kbl: ["이승현", "최부경"],
      nba: ["케빈 가넷", "벤 월러스"],
    },
    {
      name: "하이포스트 플레이메이커",
      e: { pas: 1.35, iq: 1.3 },
      desc: "자유투 라인 근처에서 공을 받아 컷인하는 동료를 찾아주는 패싱 빅맨",
      kbl: ["현주엽"],
      nba: ["크리스 웨버", "드레이먼드 그린"],
    },
    {
      name: "에너지 빅",
      e: { ath: 1.45, def: 1.15 },
      body: { h: [199, 204], wsd: [4, 11] },
      desc: "탄력 넘치는 덩크와 허슬 플레이로 벤치와 관중을 깨우는 빅맨",
      kbl: ["전희철"],
      nba: ["블레이크 그리핀", "숀 켐프"],
    },
    {
      name: "리바운드 머신",
      e: { iq: 1.3, ath: 1.25, def: 1.1 },
      body: { wsd: [6, 12] },
      desc: "공이 떨어지는 자리를 먼저 읽고 박스아웃으로 공수 리바운드를 쓸어 담는 빅맨",
      kbl: ["라건아", "아셈 마레이"],
      nba: ["데니스 로드맨"],
    },
  ],
  C: [
    {
      name: "림 프로텍터",
      e: { def: 1.5, ath: 1.15 },
      body: { h: [208, 216], wsd: [7, 13] },
      desc: "블록슛과 위치 선정으로 골밑을 지키는 수비형 센터",
      kbl: ["김주성", "찰스 로드"],
      nba: ["디켐베 무톰보", "루디 고베어"],
    },
    {
      name: "포스트 스코어러",
      e: { sht: 1.35, hdl: 1.15, iq: 1.1 },
      body: { h: [205, 213] },
      desc: "로포스트에서 훅슛과 화려한 풋워크로 꾸준히 점수를 쌓는 기술형 센터",
      kbl: ["오세근", "김주성"],
      nba: ["하킴 올라주원", "조엘 엠비드"],
    },
    {
      name: "패싱 센터",
      e: { pas: 1.45, iq: 1.2 },
      desc: "뛰어난 BQ와 시야로 센터 자리에서 공격을 조립하는 장신 패서",
      kbl: ["함지훈"],
      nba: ["니콜라 요키치", "도만타스 사보니스"],
    },
    {
      name: "클래식 센터",
      e: { ath: 1.35, sht: 1.1, def:1.15 },
      body: { h: [206, 214], wsd: [3, 10] },
      desc: "끈질기게 골밑을 수비하며 공격에선 덩크로 마무리하는 센터",
      kbl: ["하승진"],
      nba: ["루디 고베어", "빅터 웸반야마"],
    },
    {
      name: "림 러너",
      e: { ath: 1.45, def: 1.15 },
      body: { h: [203, 210], wsd: [5, 12] },
      desc: "픽앤롤 뒤 림으로 달려가 앨리웁을 받아내는 다이나믹한 센터",
      kbl: ["하윤기", "김종규"],
      nba: ["디안드레 조던", "클린트 카펠라"],
    },
    {
      name: "슈팅 센터",
      e: { sht: 1.5, iq: 1.1 },
      body: { h: [206, 214] },
      desc: "중장거리 슛팅 능력으로 상대 빅맨을 외곽으로 끌어내는 센터",
      kbl: ["서장훈", "강상재"],
      nba: ["브룩 로페즈", "칼-앤서니 타운스"],
    },
  ],
};

export const TRAITS: Record<Trait, string> = {
  조기성장: "어릴 때 빠르게 크지만 20대 중반부터 성장이 둔해져요.",
  대기만성: "10대에는 더디지만 20대에 크게 성장하고 노화도 늦어요.",
  꾸준함: "시즌마다 기복이 적고 성장이 조금 더 안정적이에요.",
  강철몸: "부상이 적고 30대에도 능력치가 천천히 떨어져요.",
  유리몸: "부상이 잦아요. 회복 훈련을 자주 챙기세요.",
  승부사: "큰 경기에 강해요. 우승과 파이널 MVP 확률이 올라가요.",
};

export const TRAIT_KEYS = Object.keys(TRAITS) as Trait[];

/** 캐릭터를 고르기 전에 만든 예전 선수의 피부색. 예전 기록의 캐릭터를 짐작할 때 써요. */
export const SKINS = ["#F2D0B1", "#E3B58F", "#C68E63", "#8D5A3B", "#5E3A24"];

/** 캐릭터의 바탕(인종). 눈·코·입 생김새와 피부색·머리색·머리 모양의 범위가 정해져요. 캐릭터는 모두 남성이에요. */
export const LOOKS: Record<LookKey, { skins: string[]; hairs: string[]; styles: HairStyle[]; eyes: string[]; beard: number }> = {
  black: {
    skins: ["#3F2617", "#5A3620", "#6E4128", "#8A5634"],
    hairs: ["#161210", "#161210", "#161210", "#3B2A1E", "#D8B25A"],
    styles: ["buzz", "fade", "afro", "braids", "mohawk", "bald", "twists"],
    eyes: ["#3A2416", "#2A1A10"],
    beard: 0.35,
  },
  white: {
    skins: ["#F8DEC9", "#F4D5BE", "#EBC3A3"],
    hairs: ["#C99A4E", "#E2C88A", "#6B4A2E", "#3B2A1E", "#A4522A", "#1B1B1B"],
    styles: ["swept", "buzz", "spiky", "curtain", "wavy", "fade", "mohawk"],
    eyes: ["#4C7DB8", "#5B8A5A", "#6B4A2E", "#7A8A99"],
    beard: 0.3,
  },
  hispanic: {
    skins: ["#D9A27A", "#C98F62", "#B07A50"],
    hairs: ["#2B1B12", "#1B1B1B", "#4A3020", "#B8914F"],
    styles: ["wavy", "fade", "swept", "buzz", "spiky", "braids"],
    eyes: ["#4A2E1A", "#2A1A10", "#6B4A2E"],
    beard: 0.55,
  },
  asian: {
    skins: ["#F6DABA", "#F1CFA4", "#E6BC8E"],
    hairs: ["#111111", "#111111", "#2A1E18", "#4A3426", "#D9C7A0", "#8C8C96"],
    styles: ["straight", "curtain", "spiky", "buzz", "swept", "fade"],
    eyes: ["#2A1A10", "#3A2416"],
    beard: 0.12,
  },
};

export const LOOK_KEYS = Object.keys(LOOKS) as LookKey[];

export const HAIR_STYLES: Record<HairStyle, string> = {
  buzz: "버즈컷",
  fade: "페이드",
  afro: "아프로",
  braids: "브레이즈",
  twists: "트위스트",
  mohawk: "모히칸",
  bald: "삭발",
  swept: "넘긴 머리",
  spiky: "뾰족 머리",
  curtain: "가르마",
  wavy: "웨이브",
  straight: "앞머리",
};

export const BEARDS: Record<BeardStyle, string> = {
  none: "",
  stubble: "수염 자국",
  goatee: "염소수염",
  mustache: "콧수염",
  full: "턱수염",
};

const BANDS = ["#FFFFFF", "#1B1B1B", "#D7263D", "#F2A900"];

/** 캐릭터 하나를 무작위로 조합해요. 바탕을 정하지 않으면 네 가지 중에서 골라요. */
export function randomLook(kind: LookKey = pick(LOOK_KEYS)): Look {
  const l = LOOKS[kind];
  return {
    kind,
    skin: pick(l.skins),
    hair: pick(l.hairs),
    style: pick(l.styles),
    beard: chance(l.beard) ? pick<BeardStyle>(["stubble", "goatee", "mustache", "full"]) : "none",
    eyes: pick(l.eyes),
    band: chance(0.15) ? pick(BANDS) : undefined,
  };
}

/** 고를 캐릭터 count개. 바탕을 정하지 않으면 네 가지가 고르게 섞여요. */
export function randomLooks(count: number, kind?: LookKey): Look[] {
  if (kind) return Array.from({ length: count }, () => randomLook(kind));
  return shuffle(Array.from({ length: count }, (_, i) => randomLook(LOOK_KEYS[i % LOOK_KEYS.length])));
}

/** 캐릭터 설명. 예: "웨이브 · 염소수염" */
export function lookLabel(l: Look): string {
  return [HAIR_STYLES[l.style], BEARDS[l.beard], l.band ? "헤어밴드" : ""].filter(Boolean).join(" · ");
}

/** 캐릭터를 고르기 전에 만든 선수의 바탕은 피부색이 가장 가까운 것으로 짐작해요. */
export function lookFromSkin(skin: string): LookKey {
  const i = SKINS.indexOf(skin.toUpperCase());
  return i === 0 ? "white" : i === 1 ? "asian" : i === 2 ? "hispanic" : i >= 3 ? "black" : "asian";
}

/** 저장된 색과 얼굴(없을 수 있어요)로 그릴 캐릭터를 만들어요. 예전 선수·기록은 바탕에 맞는 기본 모양이에요. */
export function toLook(l: LookRecord): Look {
  const kind = l.kind ?? lookFromSkin(l.skin);
  return {
    kind,
    skin: l.skin,
    hair: l.hair,
    style: l.style ?? LOOKS[kind].styles[0],
    beard: l.beard ?? "none",
    eyes: l.eyes ?? LOOKS[kind].eyes[0],
    band: l.band,
  };
}

/** 선수의 캐릭터 */
export const playerLook = (p: Player): Look => toLook({ skin: p.skin, hair: p.hair, ...p.face });
