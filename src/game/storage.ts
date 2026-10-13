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

export function isCareer(o: unknown): o is Career {
  if (!o || typeof o !== "object") return false;
  const c = o as Partial<Career>;
  return c.v === 1 && !!c.p && Array.isArray(c.hist) && typeof c.age === "number";
}

/** 예전 저장 파일에 빠진 필드를 채워요. */
function normalize(c: Career): Career {
  c.queue ??= [];
  c.news ??= [];
  c.posAsked ??= {};
  c.awardLog ??= [];
  c.lastDelta ??= {};
  return c;
}

export function loadCareer(): Career | null {
  const raw = read(SAVE_KEY);
  if (!raw) return null;
  try {
    const o: unknown = JSON.parse(raw);
    return isCareer(o) ? normalize(o) : null;
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
    const o: unknown = JSON.parse(json);
    return isCareer(o) ? normalize(o) : null;
  } catch {
    return null;
  }
}
