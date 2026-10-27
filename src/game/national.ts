import { addHealth } from "./condition";
import { addNews, decisionTag, giveAward } from "./log";
import { chance, pick, random, ri, rnd } from "./random";
import { ovr } from "./ratings";
import { makeLiveGame } from "./live";
import { grantExemption, owesService } from "./military";
import type { Career, Decision, NatEventKey, NatGame, Nation, NatTournament } from "./types";
import { clamp, josa, sigmoid } from "./util";

/*
 * 국가대표 대회. 대회마다 실제와 비슷한 출전국 전력(대략 FIBA 랭킹 순)을 두고,
 * 조별리그와 토너먼트를 한 경기씩 시뮬레이션해요.
 * 전력 차 4.5마다 승률이 약 73%로 벌어져서, 한 선수가 아무리 잘해도 약체국이 세계 대회를 우승하긴 매우 어려워요.
 */

/** 고를 수 있는 국적. power는 대표팀 전력, threshold는 대표팀 발탁 기준 오버롤이에요. */
export const NATIONS: Nation[] = [
  { name: "대한민국", power: 66, threshold: 64, region: "asia" },
  { name: "일본", power: 70, threshold: 64, region: "asia" },
  { name: "필리핀", power: 67, threshold: 63, region: "asia" },
  { name: "중국", power: 71, threshold: 66, region: "asia" },
  { name: "호주", power: 82, threshold: 72, region: "asia" },
  { name: "캐나다", power: 85, threshold: 79, region: "americas" },
  { name: "미국", power: 95, threshold: 86, region: "americas" },
  { name: "프랑스", power: 85, threshold: 79, region: "europe" },
  { name: "스페인", power: 84, threshold: 77, region: "europe" },
  { name: "세르비아", power: 86, threshold: 77, region: "europe" },
];

export const NAT_EVENTS: Record<NatEventKey, string> = {
  olympics: "올림픽",
  worldcup: "FIBA 농구 월드컵",
  wcq: "FIBA 월드컵 예선",
  asiacup: "FIBA 아시아컵",
  eurobasket: "유로바스켓",
  americup: "FIBA 아메리컵",
  asiangames: "아시안게임",
};

type Field = [string, number][];

/** 대회별 출전국과 전력. 선수의 나라는 대회 때 이 목록에서 빠지고 대신 들어가요. */
const FIELDS: Record<Exclude<NatEventKey, "wcq">, Field> = {
  olympics: [
    ["미국", 95], ["세르비아", 86], ["독일", 86], ["프랑스", 85], ["캐나다", 85], ["스페인", 84],
    ["호주", 82], ["그리스", 80], ["브라질", 77], ["남수단", 75], ["푸에르토리코", 74], ["일본", 72],
  ],
  worldcup: [
    ["미국", 88], ["세르비아", 86], ["독일", 86], ["캐나다", 85], ["프랑스", 85], ["스페인", 84],
    ["호주", 82], ["리투아니아", 80], ["슬로베니아", 80], ["그리스", 80], ["이탈리아", 79], ["라트비아", 77],
    ["브라질", 77], ["아르헨티나", 77], ["몬테네그로", 76], ["푸에르토리코", 74], ["도미니카공화국", 74],
    ["조지아", 74], ["남수단", 74], ["뉴질랜드", 72], ["일본", 72], ["중국", 71], ["멕시코", 70],
    ["레바논", 70], ["베네수엘라", 68], ["이란", 67], ["필리핀", 67], ["대한민국", 66], ["앙골라", 66],
    ["이집트", 66], ["요르단", 64], ["카보베르데", 64],
  ],
  asiacup: [
    ["호주", 76], ["뉴질랜드", 72], ["중국", 71], ["레바논", 70], ["일본", 70], ["이란", 67],
    ["필리핀", 67], ["대한민국", 66], ["요르단", 65], ["카타르", 61], ["대만", 61], ["사우디아라비아", 58],
    ["카자흐스탄", 58], ["시리아", 57], ["인도", 55], ["괌", 54],
  ],
  eurobasket: [
    ["세르비아", 86], ["독일", 86], ["프랑스", 85], ["스페인", 84], ["리투아니아", 80], ["슬로베니아", 80],
    ["그리스", 80], ["이탈리아", 79], ["튀르키예", 79], ["라트비아", 77], ["몬테네그로", 76], ["핀란드", 76],
    ["조지아", 74], ["크로아티아", 74], ["폴란드", 74], ["체코", 72], ["이스라엘", 72], ["보스니아", 72],
    ["벨기에", 70], ["우크라이나", 70], ["스웨덴", 68], ["에스토니아", 66], ["영국", 66], ["포르투갈", 64],
  ],
  americup: [
    ["아르헨티나", 78], ["미국", 78], ["캐나다", 77], ["브라질", 77], ["푸에르토리코", 74],
    ["도미니카공화국", 74], ["멕시코", 70], ["베네수엘라", 68], ["우루과이", 66], ["파나마", 64],
    ["바하마", 64], ["콜롬비아", 62],
  ],
  asiangames: [
    ["중국", 71], ["필리핀", 68], ["일본", 68], ["이란", 66], ["대한민국", 66], ["레바논", 66],
    ["요르단", 64], ["대만", 62], ["카타르", 60], ["카자흐스탄", 58], ["몽골", 56], ["인도네시아", 55],
  ],
};

/**
 * 올림픽 최종예선 상대. 조별리그·준결승·결승마다 만나는 나라의 수준이 달라요.
 * 대한민국(66)은 KBL 에이스(OVR 75)가 합류하면 열 번에 한 번, NBA급(OVR 80 이상)이면 다섯 번에 한 번쯤 본선에 올라요.
 */
const OQT: Record<"group" | "semi" | "final", Field> = {
  group: [["필리핀", 67], ["이집트", 66], ["앙골라", 66], ["요르단", 64], ["카보베르데", 64], ["바하마", 64]],
  semi: [["조지아", 74], ["뉴질랜드", 72], ["멕시코", 70], ["레바논", 70], ["베네수엘라", 68]],
  final: [["라트비아", 77], ["브라질", 77], ["크로아티아", 74], ["푸에르토리코", 74], ["도미니카공화국", 74]],
};

/** 대회에 따라 대표팀 구성이 달라지는 나라 (NBA 선수 차출 여부 등) */
const EVENT_ADJ: Partial<Record<NatEventKey, Record<string, number>>> = {
  worldcup: { 미국: -7 },
  americup: { 미국: -17, 캐나다: -8 },
  asiacup: { 호주: -6 },
  asiangames: { 일본: -2 },
};

/** 본선 진출 기준 전력. 이보다 강하면 대부분 통과해요. */
const WC_QUAL: Record<Nation["region"], number> = { asia: 67, europe: 76, americas: 70 };

export interface NatCall {
  ev: NatEventKey;
  year: number;
}

/** 이 해(시즌 연도)에 열리는 대회. 2027 월드컵, 2028 올림픽, 2029 대륙컵, 2030 아시안게임… */
export function natEventFor(year: number, n: Nation): NatEventKey {
  const cycle = year % 4;
  if (cycle === 0) return "olympics";
  if (cycle === 3) return "worldcup";
  if (cycle === 1) return n.region === "asia" ? "asiacup" : n.region === "europe" ? "eurobasket" : "americup";
  return n.region === "asia" && n.name !== "호주" ? "asiangames" : "wcq";
}

export const nationOf = (c: Career): Nation => NATIONS.find((n) => n.name === c.p.nat) ?? NATIONS[0];

/** 선수 한 명이 대표팀 전력에 더하는 값. 발탁 기준을 넘을수록 커지지만 7이 한계예요. */
export function playerBoost(o: number, n: Nation): number {
  return clamp(1 + (o - n.threshold) * 0.3, 1, 7);
}

/** 대회에 나서는 대표팀 전력. 선수가 합류하면(o = 선수 오버롤) 그만큼 더해져요. */
export function teamPower(n: Nation, ev: NatEventKey, o?: number): number {
  return n.power + (EVENT_ADJ[ev]?.[n.name] ?? 0) + (o === undefined ? 0 : playerBoost(o, n));
}

const fieldFor = (ev: Exclude<NatEventKey, "wcq">, n: Nation): Field =>
  FIELDS[ev].filter(([name]) => name !== n.name).sort((a, b) => b[1] - a[1]);

/** 대표팀 전망 문구. 출전국 사이에서 몇 번째 전력인지로 정해요. */
function outlook(ev: NatEventKey, n: Nation, power: number): string {
  if (ev === "wcq") return power >= WC_QUAL[n.region] + 6 ? "본선 진출이 유력해요." : "본선 진출을 다투는 접전이 예상돼요.";
  const field = fieldFor(ev, n);
  const rank = field.filter(([, p]) => p > power).length + 1;
  if (ev === "olympics" && power < 83) return "올림픽은 최종예선부터 통과해야 해요. 본선 진출 자체가 쉽지 않아요.";
  if (ev === "worldcup" && power < WC_QUAL[n.region] + 2) return "먼저 지역 예선을 통과해야 해요. 본선 진출이 1차 목표예요.";
  if (rank === 1) return "우승 후보로 꼽혀요.";
  if (rank <= 3) return "메달 후보로 꼽혀요.";
  if (rank <= 6) return "메달권을 노려볼 만한 다크호스예요.";
  if (rank <= 10) return "8강 진출이 현실적인 목표예요.";
  return "조별리그 통과가 목표예요.";
}

/** 병역을 마치지 않은 대한민국 선수에게 병역 특례가 걸린 대회임을 알려줘요. */
function exemptHint(c: Career, ev: NatEventKey): string {
  if (!owesService(c)) return "";
  if (ev === "asiangames") return " 금메달을 따면 병역 특례를 받아요.";
  if (ev === "olympics") return " 메달을 따면 병역 특례를 받아요.";
  return "";
}

/** 국가대표 발탁 결정. 발탁 기준에 못 미치거나 시즌을 못 뛰었으면 null이에요. */
export function nationalCallUp(c: Career, ov: number, gp: number, year: number): Decision | null {
  const n = nationOf(c);
  if (c.age < 19 || gp <= 0 || ov < n.threshold) return null;
  const ev = natEventFor(year, n);
  const name = NAT_EVENTS[ev];
  const power = teamPower(n, ev, ov);
  const first = !c.nat.caps;
  return {
    title: `${first ? "국가대표 첫 발탁" : "국가대표 발탁"} · ${year} ${name}`,
    body: `${n.name} 대표팀 최종 명단에 이름을 올렸어요. ${outlook(ev, n, power)}${exemptHint(c, ev)}`,
    opts: [
      {
        label: "대표팀 합류",
        sub: "여름 내내 대표팀 경기를 뛰어요 · 피로가 쌓이고 부상 위험이 조금 있어요",
        tag: name,
        act: { k: "national", ev, year, join: true },
      },
      {
        label: "이번 대회는 불참",
        sub: "소속팀 일정과 몸 관리를 위해 쉬어요 · 건강 +6",
        act: { k: "national", ev, year, join: false },
      },
    ],
  };
}

/* ---------- 경기 시뮬레이션 ---------- */

/** 대표팀 유니폼 색. 중계 화면에서 써요. */
const NAT_COLOR: Record<string, string> = {
  대한민국: "#C8102E", 일본: "#1B2A6B", 필리핀: "#0038A8", 중국: "#D62828", 호주: "#00843D",
  캐나다: "#D80621", 미국: "#0A3161", 프랑스: "#1F3C88", 스페인: "#AA151B", 세르비아: "#C6363C",
};
export const natColor = (name: string): string => NAT_COLOR[name] ?? "#3A3F4B";

/** 내 선수가 뛰면 경기마다 득점이 붙어요. boost가 클수록(대표팀 에이스일수록) 많이 넣어요. */
interface Me {
  boost: number;
}

function play(power: number, [opp, op]: [string, number], stage: string, me?: Me): NatGame {
  const win = random() < sigmoid((power - op) / 4.5);
  const loser = ri(62, 84);
  const margin = ri(1, 18);
  const pts = me ? Math.round(clamp(4 + me.boost * 2.2 + rnd(-5, 6), 0, 42)) : undefined;
  return win ? { stage, opp, win, us: loser + margin, them: loser, pts } : { stage, opp, win, us: loser, them: loser + margin, pts };
}

const score = (g: NatGame) => `${g.us}-${g.them}`;

export interface NatResult {
  /** 최종 성적: 금메달, 8강, 조별리그 탈락… */
  label: string;
  medal: "금" | "은" | "동" | null;
  games: NatGame[];
  /** 결과를 한 문장으로 */
  story: string;
  /** 결승에 올랐으면 결승 경기 */
  final?: NatGame;
}

/**
 * 대회 하나를 처음부터 끝까지 치러요. power는 그 대회 대표팀 전력이에요.
 * qualified는 월드컵 예선을 이미 치렀을 때의 본선 진출 여부예요. 없으면 예선도 여기서 치러요.
 */
export function simulateTournament(ev: NatEventKey, n: Nation, power: number, qualified?: boolean, me?: Me): NatResult {
  const games: NatGame[] = [];
  const form = power + rnd(-1.5, 1.5);
  const g = (o: [string, number], stage: string) => {
    const r = play(form, o, stage, me);
    games.push(r);
    return r;
  };
  const done = (label: string, medal: NatResult["medal"], story: string, final?: NatGame): NatResult => ({ label, medal, games, story, final });

  if (ev === "wcq") {
    // 지역 예선 6경기. 4승이면 본선행, 3승이면 득실을 따져 반반이에요.
    const pool = fieldFor("worldcup", n).filter(([, p]) => p <= WC_QUAL[n.region] + 4);
    const w = Array.from({ length: 6 }, (_, k) => g(pick(pool), `예선 ${k + 1}차전`)).filter((x) => x.win).length;
    const ok = w >= 4 || (w === 3 && chance(0.5));
    return done(ok ? "본선 진출 확정" : "본선 진출 실패", null, `예선 ${w}승 ${6 - w}패로 월드컵 본선 진출을 ${ok ? "확정했어요." : "놓쳤어요."}`);
  }

  const field = fieldFor(ev, n);
  const top = (k: number) => pick(field.slice(0, k));
  const any = () => pick(field);

  // 본선 진출
  if (ev === "worldcup" && !(qualified ?? chance(sigmoid((form - WC_QUAL[n.region]) / 2.5))))
    return done("본선 진출 실패", null, "지역 예선에서 밀려 월드컵 본선에 오르지 못했어요.");
  if (ev === "olympics" && !chance(sigmoid((form - 83) / 1.5))) {
    // 최종예선: 6개국 중 1위만 본선행. 조별 2경기 뒤 준결승·결승을 모두 이겨야 해요.
    // 실제처럼 조별리그는 약체, 토너먼트로 갈수록 강호를 만나요.
    const oqt = (tier: Field) => pick(tier.filter(([name]) => name !== n.name));
    const gw = [g(oqt(OQT.group), "최종예선 조별리그 1차전"), g(oqt(OQT.group), "최종예선 조별리그 2차전")].filter((x) => x.win).length;
    if (gw === 0) return done("올림픽 최종예선 탈락", null, "올림픽 최종예선 조별리그에서 2패로 탈락했어요.");
    const sf = g(oqt(OQT.semi), "최종예선 준결승");
    if (!sf.win) return done("올림픽 최종예선 탈락", null, `올림픽 최종예선 준결승에서 ${sf.opp}에 져(${score(sf)}) 본선행이 무산됐어요.`);
    const f = g(oqt(OQT.final), "최종예선 결승");
    if (!f.win) return done("올림픽 최종예선 탈락", null, `올림픽 최종예선 결승에서 ${f.opp}에 져(${score(f)}) 아쉽게 본선행을 놓쳤어요.`);
  }

  // 조별리그 (월드컵은 2라운드까지)
  let wins = [1, 2, 3].map((k) => g(any(), `조별리그 ${k}차전`)).filter((x) => x.win).length;
  if (wins < 2 && !(wins === 1 && chance(0.3)))
    return done("조별리그 탈락", null, `조별리그 ${wins}승 ${3 - wins}패로 탈락했어요.`);
  if (ev === "worldcup") {
    wins += [1, 2].map((k) => g(top(16), `2라운드 ${k}차전`)).filter((x) => x.win).length;
    if (wins < 3 && !(wins === 2 && chance(0.3)))
      return done("2라운드 탈락", null, `2라운드에서 밀려 ${wins}승 ${5 - wins}패로 대회를 마쳤어요.`);
  }

  // 토너먼트
  const qf = g(top(8), "8강");
  if (!qf.win) return done("8강", null, `8강에서 ${qf.opp}에 졌어요(${score(qf)}).`);
  const sf = g(top(4), "준결승");
  if (!sf.win) {
    const br = g(pick(field.slice(2, 6)), "3·4위전");
    return br.win
      ? done("동메달", "동", `준결승에서 ${sf.opp}에 졌지만 3·4위전에서 ${josa(br.opp, "을", "를")} 꺾고(${score(br)}) 동메달을 땄어요.`)
      : done("4위", null, `준결승에서 ${sf.opp}에, 3·4위전에서 ${br.opp}에 져 4위로 마쳤어요.`);
  }
  const f = g(top(2), "결승");
  return f.win
    ? done("금메달", "금", `결승에서 ${josa(f.opp, "을", "를")} 꺾고(${score(f)}) 우승했어요!`, f)
    : done("은메달", "은", `결승에서 ${f.opp}에 져(${score(f)}) 은메달을 땄어요.`, f);
}

/* ---------- 결정 적용 ---------- */

const MEDAL_KEY = { 금: "nat_gold", 은: "nat_silver", 동: "nat_bronze" } as const;
const NAT_LOG_LIMIT = 40;

/** 대표팀 합류 또는 불참. 어느 쪽이든 대표팀은 대회를 치르고, 결과를 기록과 소식으로 남겨요. */
export function runNationalTeam(c: Career, ev: NatEventKey, year: number, join: boolean): NatTournament {
  const n = nationOf(c);
  const tag = decisionTag(c);
  const name = `${year} ${NAT_EVENTS[ev]}`;
  const o = ovr(c.p);
  const power = teamPower(n, ev, join ? o : undefined);
  const wcq = c.nat.wcq;
  const r = simulateTournament(ev, n, power, ev === "worldcup" && wcq?.y === year ? wcq.ok : undefined, join ? { boost: playerBoost(o, n) } : undefined);
  if (ev === "wcq") c.nat.wcq = { y: year + 1, ok: r.label === "본선 진출 확정" };
  const t: NatTournament = { year, ev, name, joined: join, label: r.label, medal: r.medal, story: r.story, games: r.games };
  c.natLog = [...c.natLog, t].slice(-NAT_LOG_LIMIT);
  if (!join) {
    addHealth(c, 6);
    addNews(c, tag, "info", `${name}에 불참하고 몸을 추슬렀어요. ${n.name} 대표팀은 ${r.label} · ${r.story}`);
    return t;
  }
  c.nat.caps += r.games.length;
  addHealth(c, -ri(2, 5));
  const rec = c.hist.find((h) => h.year === year);
  if (r.medal) giveAward(c, MEDAL_KEY[r.medal], `${name} ${r.medal}메달`, rec);
  addNews(c, tag, r.medal ? "award" : "good", `${n.name} 대표로 ${name} 출전 · ${r.label} · ${r.story}`);
  if (r.final) {
    const f = r.final;
    c.live = makeLiveGame({
      title: `${name} 결승`,
      key: `nat-${year}`,
      us: n.name,
      them: f.opp,
      usColor: natColor(n.name),
      themColor: natColor(f.opp),
      usScore: f.us,
      themScore: f.them,
      periodMin: 10,
      player: c.p.name,
      mine: { pts: f.pts ?? 0, reb: ri(1, 8), ast: ri(1, 6) },
    });
  }
  if (n.name === "대한민국" && ((ev === "asiangames" && r.medal === "금") || (ev === "olympics" && r.medal)))
    grantExemption(c, tag, `${name} ${r.medal}`);
  if (chance(0.04)) {
    addHealth(c, -10);
    addNews(c, tag, "bad", "대표팀 경기 중 가벼운 부상을 입었어요. 다음 시즌 초반 몸 관리가 필요해요.");
  }
  return t;
}
