import { LEAGUES } from "./leagues";
import type { Career, PosKey } from "./types";
import { clamp } from "./util";

/*
 * 은퇴 화면의 "닮은 꼴 선수". 내 프로 커리어를 실제 KBL·NBA 선수의 커리어 성향과 비교해 가장 비슷한 선수를 골라요.
 * 실제 선수 값은 정규리그 경기당 평균과 프로 시즌 수, MVP·우승 횟수를 반올림한 대략적인 성향이에요(2025-26 시즌 종료 무렵 기준).
 * 정확한 기록을 보여주려는 게 아니라서 화면에는 실제 선수의 숫자를 띄우지 않아요.
 */

export type CompLeague = "nba" | "kbl";

export interface CompPlayer {
  name: string;
  pos: PosKey;
  ppg: number;
  rpg: number;
  apg: number;
  /** 그 리그에서 뛴 시즌 수 */
  seasons: number;
  /** 정규리그 MVP */
  mvp: number;
  rings: number;
  /** 그 리그 안에서의 위상: 5 역대급, 4 스타, 3 주전급 레전드, 2 롤 플레이어, 1 짧은 커리어 */
  tier: number;
  /** 한 줄 소개 */
  blurb: string;
}

const p = (
  name: string, pos: PosKey, ppg: number, rpg: number, apg: number, seasons: number, mvp: number, rings: number, tier: number, blurb: string,
): CompPlayer => ({ name, pos, ppg, rpg, apg, seasons, mvp, rings, tier, blurb });

export const COMPS: Record<CompLeague, ReadonlyArray<CompPlayer>> = {
  nba: [
    p("마이클 조던", "SG", 30.1, 6.2, 5.3, 15, 5, 6, 5, "득점왕과 우승을 모두 쓸어 담은 역대 최고의 슈팅가드"),
    p("르브론 제임스", "SF", 27, 7.5, 7.4, 23, 4, 4, 5, "모든 걸 다 하는 포워드, NBA 통산 최다 득점자"),
    p("코비 브라이언트", "SG", 25, 5.2, 4.7, 20, 1, 5, 5, "한 팀에서 20시즌, 다섯 번 우승한 승부사"),
    p("카림 압둘자바", "C", 24.6, 11.2, 3.6, 20, 6, 6, 5, "스카이훅으로 MVP 여섯 번을 받은 센터"),
    p("매직 존슨", "PG", 19.5, 7.2, 11.2, 13, 3, 5, 5, "장신 포인트가드로 쇼타임 농구를 이끈 리더"),
    p("래리 버드", "SF", 24.3, 10, 6.3, 13, 3, 3, 5, "슛·리바운드·패스를 다 갖춘 영리한 포워드"),
    p("팀 덩컨", "PF", 19, 10.8, 3, 19, 2, 5, 5, "기본기의 교과서, 다섯 번 우승한 파워포워드"),
    p("샤킬 오닐", "C", 23.7, 10.9, 2.5, 19, 1, 4, 5, "힘으로 골밑을 지배한 괴물 센터"),
    p("스테판 커리", "PG", 24.7, 4.7, 6.4, 17, 2, 4, 5, "3점슛으로 농구를 바꾼 포인트가드"),
    p("니콜라 요키치", "C", 21.3, 10.9, 7, 11, 3, 1, 5, "센터 자리에서 경기를 설계하는 패스의 달인"),
    p("케빈 듀랜트", "SF", 27.2, 7, 4.4, 18, 1, 2, 5, "막을 수 없는 장신 스코어러"),
    p("하킴 올라주원", "C", 21.8, 11.1, 2.5, 18, 1, 2, 5, "드림 셰이크와 블록슛의 센터"),
    p("덕 노비츠키", "PF", 20.7, 7.5, 2.4, 21, 1, 1, 4, "한 팀에서 21시즌을 뛴 슈팅 빅맨"),
    p("칼 말론", "PF", 25, 10.1, 3.6, 19, 2, 0, 4, "꾸준함의 대명사, 반지 없는 득점 기계"),
    p("찰스 바클리", "PF", 22.1, 11.7, 3.9, 16, 1, 0, 4, "작은 키로 리바운드를 지배한 파워포워드"),
    p("앨런 아이버슨", "SG", 26.7, 3.7, 6.2, 14, 1, 0, 4, "작은 체구로 득점왕을 네 번 차지한 스코어러"),
    p("스티브 내쉬", "PG", 14.3, 3, 8.5, 18, 2, 0, 4, "MVP 두 번을 받은 패스의 마술사"),
    p("존 스탁턴", "PG", 13.1, 2.7, 10.5, 19, 0, 0, 4, "역대 최다 어시스트와 스틸의 철인 가드"),
    p("크리스 폴", "PG", 17.5, 4.5, 9.2, 21, 0, 0, 4, "포인트 갓으로 불린 정통 포인트가드"),
    p("드웨인 웨이드", "SG", 22, 4.7, 5.4, 16, 0, 3, 4, "돌파와 블록으로 마이애미를 이끈 가드"),
    p("러셀 웨스트브룩", "PG", 21.5, 7, 8.2, 18, 1, 0, 4, "트리플더블을 밥 먹듯 한 에너자이저"),
    p("제임스 하든", "SG", 24.5, 5.6, 7, 17, 1, 0, 4, "스텝백으로 득점왕을 차지한 공격형 가드"),
    p("스카티 피펜", "SF", 16.1, 6.4, 5.2, 17, 0, 6, 4, "조던 곁에서 여섯 번 우승한 만능 포워드"),
    p("카와이 레너드", "SF", 19.9, 6.3, 3, 14, 0, 2, 4, "공수 겸장, 두 팀에서 파이널 MVP를 받은 포워드"),
    p("레이 앨런", "SG", 18.9, 4.1, 3.4, 18, 0, 2, 3, "아름다운 폼의 3점 슈터"),
    p("레지 밀러", "SG", 18.2, 3, 3, 18, 0, 0, 3, "한 팀에서 18시즌, 클러치 3점의 사나이"),
    p("클레이 톰슨", "SG", 19, 3.5, 2.3, 13, 0, 4, 3, "스플래시 브라더스의 3&D 슈터"),
    p("빈스 카터", "SF", 16.7, 4.3, 3.1, 22, 0, 0, 3, "덩크로 시작해 22시즌을 뛴 롱런의 상징"),
    p("야오밍", "C", 19, 9.2, 1.6, 8, 0, 0, 3, "아시아 출신 장신 센터의 상징"),
    p("데릭 로즈", "PG", 17.4, 3.2, 5.2, 15, 1, 0, 3, "최연소 MVP의 폭발적인 돌파형 가드"),
    p("마누 지노빌리", "SG", 13.3, 3.5, 3.8, 16, 0, 4, 3, "벤치에서 나와 경기를 바꾼 식스맨 레전드"),
    p("드와이트 하워드", "C", 15.7, 11.8, 1.3, 18, 0, 1, 3, "리바운드와 블록의 운동능력 센터"),
    p("벤 월러스", "C", 5.7, 9.6, 1.3, 16, 0, 1, 3, "드래프트 미지명에서 수비로 올라선 빅맨"),
    p("데니스 로드먼", "PF", 7.3, 13.1, 1.8, 14, 0, 5, 3, "리바운드 하나로 다섯 번 우승한 수비수"),
    p("안드레 이궈달라", "SF", 11.3, 4.9, 4.2, 19, 0, 4, 3, "궂은일로 우승을 부른 다재다능한 윙"),
    p("셰인 배티에", "SF", 8.6, 4.4, 1.8, 13, 0, 2, 2, "기록 밖에서 이기는 법을 아는 수비형 포워드"),
    p("브루스 보웬", "SF", 6.1, 2.8, 1, 13, 0, 3, 2, "코너 3점과 끈질긴 대인 수비의 스페셜리스트"),
    p("로버트 오리", "PF", 7, 4.8, 2, 16, 0, 7, 2, "결정적인 한 방으로 일곱 번 우승한 빅샷 롭"),
    p("카일 코버", "SG", 9.7, 3.3, 1.7, 17, 0, 0, 2, "17시즌을 3점 하나로 버틴 정통 슈터"),
    p("제레미 린", "PG", 11.6, 2.8, 4.3, 9, 0, 1, 2, "벤치 끝에서 단숨에 스타가 된 린새니티"),
    p("패티 밀스", "PG", 9.4, 1.6, 2.1, 15, 0, 1, 2, "벤치에서 나와 흐름을 바꾸는 호주 출신 스코어러"),
    p("J.R. 스미스", "SG", 12.4, 3.4, 2.1, 16, 0, 2, 2, "뜨거운 손으로 두 번 우승한 식스맨 슈터"),
    p("트레버 아리자", "SF", 10.7, 4.8, 2, 19, 0, 1, 2, "19시즌을 뛴 3&D 윙"),
    p("스티븐 애덤스", "C", 9, 8, 1.5, 12, 0, 0, 2, "스크린과 리바운드로 궂은일을 도맡은 빅맨"),
    p("마크 매드슨", "PF", 2.2, 2.3, 0.6, 9, 0, 2, 1, "우승 축하 퍼레이드 춤으로 기억되는 벤치 멤버"),
    p("브라이언 스칼라브라인", "PF", 3.1, 2.2, 0.8, 11, 0, 1, 1, "팬들에게 가장 사랑받은 벤치 멤버"),
    p("하승진", "C", 1.5, 1.5, 0.2, 2, 0, 0, 1, "한국인 최초로 NBA 코트를 밟은 센터"),
  ],
  kbl: [
    p("서장훈", "C", 19.2, 7.6, 1.5, 15, 1, 2, 5, "KBL 통산 최다 득점의 득점형 센터"),
    p("김주성", "C", 13.9, 6, 2.6, 16, 2, 3, 5, "블록슛과 수비로 한 팀을 지킨 원클럽 빅맨"),
    p("양동근", "PG", 11.8, 3.3, 5, 14, 4, 6, 5, "우승 반지 여섯 개의 철인 가드"),
    p("주희정", "PG", 9.1, 4, 5.2, 20, 1, 1, 4, "역대 최다 출전과 최다 어시스트의 꾸준함"),
    p("이상민", "PG", 11.5, 3.5, 6.4, 13, 1, 3, 4, "컴퓨터 가드로 불린 인기 포인트가드"),
    p("김승현", "PG", 12, 3, 7.2, 11, 1, 1, 4, "데뷔 시즌에 신인왕과 MVP를 함께 받은 천재 가드"),
    p("허재", "SG", 13, 3, 4, 8, 0, 1, 4, "농구 대통령으로 불린 전설의 슈팅가드"),
    p("문경은", "SG", 14, 2, 2, 14, 0, 1, 3, "람보 슈터, 3점슛의 대명사"),
    p("추승균", "SF", 13.6, 2.6, 2.4, 15, 0, 5, 4, "한 팀에서 다섯 번 우승한 소리 없는 강자"),
    p("김선형", "PG", 13, 3, 4.5, 14, 2, 3, 4, "폭발적인 돌파의 SK 프랜차이즈 스타"),
    p("허훈", "PG", 14, 2.5, 5.5, 8, 1, 0, 4, "득점과 패스를 겸비한 공격형 포인트가드"),
    p("오세근", "C", 13, 7, 2, 13, 1, 4, 4, "안양의 우승을 이끈 골밑의 기둥"),
    p("라건아", "C", 20, 11.6, 2, 12, 0, 4, 4, "리바운드 머신, 귀화 후 국가대표로도 뛴 센터"),
    p("애런 헤인즈", "SF", 20, 8.2, 2.5, 12, 0, 2, 4, "KBL에서 오래 뛴 외국인 득점 기계"),
    p("함지훈", "PF", 10, 5, 3.5, 17, 1, 5, 4, "영리한 패스로 현대모비스 왕조를 받친 빅맨"),
    p("문태영", "SF", 18, 6, 2, 9, 0, 3, 3, "득점력으로 우승을 이끈 포워드"),
    p("최준용", "PF", 11, 6, 3.5, 8, 1, 2, 4, "장신에 볼 핸들링까지 갖춘 올라운드 포워드"),
    p("송교창", "SF", 12, 5, 2, 9, 1, 2, 4, "고졸 신인에서 MVP까지 오른 포워드"),
    p("이정현", "SG", 13, 3, 3.5, 13, 0, 1, 3, "승부처에 강한 해결사"),
    p("조성민", "SG", 12, 2.5, 2.5, 11, 0, 0, 3, "정교한 3점으로 이름난 슈터"),
    p("이승현", "PF", 11, 5, 2, 10, 0, 1, 3, "궂은일을 도맡은 두목 호랑이"),
    p("하승진", "C", 12, 8, 1, 9, 0, 2, 3, "221cm 국내 최장신 센터"),
    p("양희종", "SF", 6, 4, 2, 15, 0, 3, 3, "수비 하나로 팀을 바꾼 캡틴"),
    p("문성곤", "SF", 6, 4, 1, 9, 0, 2, 2, "수비로 이름을 알린 스페셜리스트"),
  ],
};

/** 비교에 쓰는 내 커리어 성향 */
export interface CompProfile {
  pos: PosKey;
  ppg: number;
  rpg: number;
  apg: number;
  seasons: number;
  mvp: number;
  rings: number;
  tier: number;
  /** 그 리그에서 실제로 뛰었는지. 아니면 프로 커리어 전체로 "그 리그로 치면" 비교해요. */
  played: boolean;
}

/** 최고 오버롤로 매기는 위상. 리그 수준이 다르니 KBL은 기준이 낮아요. */
const TIER_AT: Record<CompLeague, number[]> = { nba: [90, 85, 79, 73], kbl: [80, 76, 71, 66] };

/** 그 리그에서 뛴 프로 시즌으로 성향을 만들어요. 그 리그 기록이 없으면 프로 커리어 전체를 써요. 프로 기록이 없으면 null이에요. */
export function careerProfile(c: Career, lg: CompLeague): CompProfile | null {
  const pro = c.hist.filter((h) => h.pro && h.gp > 0);
  if (!pro.length) return null;
  const inLg = pro.filter((h) => h.lg === lg);
  const rows = inLg.length ? inLg : pro;
  const gp = rows.reduce((t, h) => t + h.gp, 0);
  const avg = (f: "pts" | "reb" | "ast") => rows.reduce((t, h) => t + h[f] * h.gp, 0) / gp;
  const short = LEAGUES[lg].short;
  const count = (k: "ring" | "mvp_nba" | "mvp") =>
    c.awardLog.filter((a) => a.k === k && (!inLg.length || k === "mvp_nba" || a.n.startsWith(short))).length;
  const mvp = lg === "nba" ? count("mvp_nba") + (inLg.length ? 0 : count("mvp")) : count("mvp") + (inLg.length ? 0 : count("mvp_nba"));
  const peak = Math.max(...rows.map((h) => h.ovr1), ...rows.map((h) => h.ovr0));
  const tier = 5 - TIER_AT[lg].filter((at) => peak < at).length;
  return {
    pos: c.p.pos,
    ppg: avg("pts"),
    rpg: avg("reb"),
    apg: avg("ast"),
    seasons: rows.length,
    mvp,
    rings: count("ring"),
    tier,
    played: inLg.length > 0,
  };
}

const POS_ORDER: PosKey[] = ["PG", "SG", "SF", "PF", "C"];
const posGap = (a: PosKey, b: PosKey) => Math.abs(POS_ORDER.indexOf(a) - POS_ORDER.indexOf(b));

/** 항목마다 얼마나 다른지 (1이면 "꽤 다르다"쯤). 횟수는 제곱근으로 줄여 MVP 0회와 1회의 차이를 크게 봐요. */
function gaps(me: CompProfile, o: CompPlayer) {
  const root = (a: number, b: number) => Math.abs(Math.sqrt(a) - Math.sqrt(b));
  return {
    pos: Math.min(2, posGap(me.pos, o.pos)) * 0.8,
    ppg: Math.abs(me.ppg - o.ppg) / 4,
    rpg: Math.abs(me.rpg - o.rpg) / 2.5,
    apg: Math.abs(me.apg - o.apg) / 2,
    seasons: Math.abs(me.seasons - o.seasons) / 5,
    mvp: root(me.mvp, o.mvp) * 1.2,
    rings: root(me.rings, o.rings),
    tier: Math.abs(me.tier - o.tier) * 0.9,
  };
}

export interface CompMatch {
  player: CompPlayer;
  /** 닮은 정도 (30~99) */
  score: number;
  /** 닮은 점 (많아야 셋) */
  reasons: string[];
}

/** 닮은 점으로 꼽을 항목과 문구. 둘 다 그 성향이 있을 때만 꼽아요. */
function reasonsOf(me: CompProfile, o: CompPlayer, g: ReturnType<typeof gaps>): string[] {
  const out: string[] = [];
  if (me.mvp > 0 && o.mvp > 0 && g.mvp < 0.6) out.push("MVP 수상");
  if (me.rings > 0 && o.rings > 0 && g.rings < 0.6) out.push(me.rings >= 3 && o.rings >= 3 ? "우승 청부사" : "우승 경력");
  if (g.ppg < 0.5 && o.ppg >= 15) out.push("득점력");
  if (g.rpg < 0.5 && o.rpg >= 7) out.push("리바운드");
  if (g.apg < 0.5 && o.apg >= 5) out.push("경기 운영");
  if (g.seasons < 0.4 && o.seasons >= 15) out.push("롱런");
  if (g.tier === 0) out.push("커리어 위상");
  if (g.pos === 0) out.push("같은 포지션");
  if (g.ppg < 0.5 && o.ppg < 15) out.push("비슷한 득점 규모");
  return out.slice(0, 3);
}

/** 그 리그 선수 가운데 내 커리어와 가장 닮은 순서로 n명 */
export function similarPlayers(c: Career, lg: CompLeague, n = 3): CompMatch[] {
  const me = careerProfile(c, lg);
  if (!me) return [];
  return COMPS[lg]
    .map((o) => {
      const g = gaps(me, o);
      const d = Math.sqrt(Object.values(g).reduce((t, v) => t + v * v, 0));
      return { player: o, score: Math.round(clamp(100 * Math.exp(-d * 0.22), 30, 99)), reasons: reasonsOf(me, o, g), d };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map(({ player, score, reasons }) => ({ player, score, reasons }));
}
