import { ARMY, NATIONS, SANGMU, findTeam, natColor, type LeagueKey } from "@/game";
import { NO_TEAM_COLOR } from "./format";

/*
 * 구단·학교 엠블럼. 실제 로고는 상표라 쓰지 않고, 팀 이름과 대표색으로 만든 자체 엠블럼이에요.
 * 리그마다 바탕 모양이 다르고, 이름에서 뽑은 짧은 글자(모노그램)와 이름에 따라 정해지는 무늬를 얹어요.
 * 같은 이름이면 언제나 같은 엠블럼이 나와요.
 */

/** 엠블럼 종류: 리그, 군 부대, 국가대표 */
export type EmblemKind = LeagueKey | "mil" | "nat";

export interface Emblem {
  kind: EmblemKind;
  /** 엠블럼 가운데 글자 */
  mono: string;
  /** 모노그램이 영문·숫자인지 (글꼴이 달라요) */
  latin: boolean;
  /** 무늬 번호 (0~5) */
  pattern: number;
  /** 바탕색, 무늬색, 글자색, 테두리색 */
  fill: string;
  accent: string;
  ink: string;
  edge: string;
}

/** 이름만으로는 어색한 KBL 구단은 흔히 부르는 약칭으로 */
const MONO_OVERRIDE: Record<string, string> = {
  "울산 현대모비스 피버스": "모비스",
  "안양 정관장 레드부스터스": "정관장",
  "대구 한국가스공사 페가수스": "가스",
  "필라델피아 76ers": "76",
  ASVEL: "ASV",
};

const NAT_CODE: Record<string, string> = {
  대한민국: "KOR",
  일본: "JPN",
  필리핀: "PHI",
  중국: "CHN",
  호주: "AUS",
  캐나다: "CAN",
  미국: "USA",
  프랑스: "FRA",
  스페인: "ESP",
  세르비아: "SRB",
  대만: "TPE",
};

const isLatin = (w: string) => /^[A-Za-z0-9]+$/.test(w);
/** 모노그램으로 쓰지 않는 영문 단어: 두 팀이 같이 쓰거나 구단 형태를 뜻하는 말 */
const SKIP_LATIN = new Set(["FC", "LA"]);

/**
 * 이름에서 짧은 글자를 뽑아요.
 * - 영문·숫자 단어가 있으면 그대로 (SK, LG, UCLA, 905). FC·LA는 건너뛰어요.
 * - 고교·U-리그는 학교 이름 앞 두 글자 (용산, 고려), NCAA는 첫 글자 (듀)
 * - KBL은 모기업 이름 (삼성, 소노), 그 밖의 프로는 애칭 앞 두 글자 (셀틱, 레이)
 */
function monogram(name: string, kind: EmblemKind): string {
  if (MONO_OVERRIDE[name]) return MONO_OVERRIDE[name];
  if (kind === "nat") return NAT_CODE[name] ?? name.slice(0, 2);
  const words = name.replace(/\(.*?\)/g, "").trim().split(/\s+/);
  const latin = words.find((w) => isLatin(w) && !SKIP_LATIN.has(w));
  if (latin) return latin.slice(0, 4);
  const school = words[0].replace(/(대학교|대|고)$/, "");
  if (kind === "hs" || kind === "kuniv" || kind === "mil") return school.slice(0, 2);
  if (kind === "ncaa") return school.slice(0, 1);
  if (kind === "kbl") return (words[1] ?? words[0]).slice(0, 2);
  if (kind === "euro") return words.filter((w) => w !== "FC")[0].slice(0, 2);
  return words[words.length - 1].slice(0, 2);
}

/** 문자열 해시 (무늬 고르기용) */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

const toHex = (c: number[]) => `#${c.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")}`;
const mix = (hex: string, to: number, t: number) => toHex(rgb(hex).map((x) => x + (to - x) * t));
/** 상대 휘도 (0 어두움 ~ 1 밝음) */
function lum(hex: string): number {
  const [r, g, b] = rgb(hex).map((x) => {
    const c = x / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 이름으로 엠블럼 종류와 색을 찾아요. 모르는 이름이면 null이에요. */
function resolve(name: string): { kind: EmblemKind; color: string } | null {
  const t = findTeam(name);
  if (t) return { kind: t.lg, color: t.color };
  if (name === SANGMU.name) return { kind: "mil", color: SANGMU.color };
  if (name === ARMY.name) return { kind: "mil", color: ARMY.color };
  const nat = name.replace(/ 대표팀$/, "");
  if (NATIONS.some((n) => n.name === nat)) return { kind: "nat", color: natColor(nat) };
  return null;
}

/** 엠블럼을 만들어요. kind·color를 주지 않으면 이름으로 찾고, 그래도 모르면 null이에요. */
export function emblemOf(name: string, kind?: EmblemKind, color?: string): Emblem | null {
  // 국가대표 상대국처럼 이름만 아는 나라도 국가 엠블럼으로 그려요.
  const found =
    kind && color ? { kind, color } : (resolve(name) ?? (kind === "nat" ? { kind, color: natColor(name.replace(/ 대표팀$/, "")) } : null));
  if (!found && !color) return null;
  const k = kind ?? found?.kind ?? "kbl";
  const fill = color ?? found?.color ?? NO_TEAM_COLOR;
  const dark = lum(fill) < 0.18;
  const mono = monogram(name.replace(/ 대표팀$/, ""), k);
  return {
    kind: k,
    mono,
    latin: isLatin(mono),
    pattern: hash(name) % 6,
    fill,
    accent: dark ? mix(fill, 255, 0.38) : mix(fill, 0, 0.32),
    ink: lum(fill) > 0.55 ? "#14203A" : "#FFFFFF",
    edge: mix(fill, 0, 0.45),
  };
}
