import type { Career, CareerSummary } from "./types";

const SAVE_KEY = "b2r-save-v1";
const HALL_KEY = "b2r-hall-v1";
const HALL_LIMIT = 60;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // 저장소를 쓸 수 없는 환경(시크릿 모드 등)에서는 조용히 넘어가요.
  }
}

/** v1 가상 리그 키 → v2 실제 리그 키 */
const V1_LEAGUES: Record<string, string> = {
  kcol: "kuniv",
  ucol: "ncaa",
  court: "kbl",
  dev: "gleague",
  cont: "euro",
  gbl: "nba",
};

/**
 * v1(가상 리그) 저장 파일을 v2(실제 리그)로 바꿔요.
 * 리그 키와 MVP 키만 바꾸고, 팀 이름과 지난 소식은 그대로 둬요.
 */
function migrateV1(o: Record<string, unknown>): Career {
  const json = JSON.stringify(o, (key, value) => {
    if ((key === "lg" || key === "d") && typeof value === "string" && V1_LEAGUES[value]) return V1_LEAGUES[value];
    if (key === "k" && value === "mvp_gbl") return "mvp_nba";
    return value;
  });
  const c = JSON.parse(json) as Career & { awards: Record<string, number> };
  if (c.awards.mvp_gbl) {
    c.awards.mvp_nba = c.awards.mvp_gbl;
    delete c.awards.mvp_gbl;
  }
  if (c.summary) c.summary.awards = { ...c.awards };
  c.v = 2;
  return c;
}

function upgrade(o: unknown): Career | null {
  if (!o || typeof o !== "object") return null;
  const c = o as Omit<Partial<Career>, "v"> & { v?: number };
  if (!c.p || !Array.isArray(c.hist) || typeof c.age !== "number") return null;
  if (c.v === 1) return migrateV1(o as Record<string, unknown>);
  return c.v === 2 ? (o as Career) : null;
}

/** 예전 저장 파일에 빠진 필드를 채워요. */
function normalize(c: Career): Career {
  c.queue ??= [];
  c.news ??= [];
  c.posAsked ??= {};
  c.awardLog ??= [];
  c.lastDelta ??= {};
  c.events ??= {};
  c.perks ??= {};
  c.mil ??= { s: "none" };
  c.natLog ??= [];
  c.live ??= null;
  return c;
}

export function loadCareer(): Career | null {
  const raw = read(SAVE_KEY);
  if (!raw) return null;
  try {
    const c = upgrade(JSON.parse(raw));
    return c ? normalize(c) : null;
  } catch {
    return null;
  }
}

export function saveCareer(c: Career | null): void {
  write(SAVE_KEY, c ? JSON.stringify(c) : null);
}

export function loadHall(): CareerSummary[] {
  try {
    const o: unknown = JSON.parse(read(HALL_KEY) ?? "[]");
    return Array.isArray(o) ? (o as CareerSummary[]) : [];
  } catch {
    return [];
  }
}

export function saveHall(h: CareerSummary[]): void {
  write(HALL_KEY, JSON.stringify(h.slice(-HALL_LIMIT)));
}

/* ---------- 저장 코드 (UTF-8 JSON → Base64) ---------- */

export function encodeSave(c: Career): string {
  const bytes = new TextEncoder().encode(JSON.stringify(c));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function decodeSave(code: string): Career | null {
  const text = code.trim();
  if (!text) return null;
  try {
    let json = text;
    if (!text.startsWith("{")) {
      const bin = atob(text);
      const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
      json = new TextDecoder().decode(bytes);
    }
    const c = upgrade(JSON.parse(json));
    return c ? normalize(c) : null;
  } catch {
    return null;
  }
}
