import { clampAttr } from "./condition";
import { ATTR_KEYS } from "./data";
import { ovrOf } from "./ratings";
import { refreshShop } from "./shop";
import type { Action, AttrKey, Attrs, Boost, Career, CareerSummary, PosKey } from "./types";

const SAVE_KEY = "b2r-save-v1";
const HALL_KEY = "b2r-hall-v1";
const HALL_LIMIT = 60;
/** 은퇴한 커리어 전체. 엔딩을 다시 볼 때 써요. 한 명에 50KB쯤이라 최근 것만 둬요. */
const ENDING_KEY = "b2r-endings-v1";
const ENDING_LIMIT = 20;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** 저장하고 성공했는지 알려줘요. 저장소를 쓸 수 없는 환경(시크릿 모드, 용량 초과)에서는 false예요. */
function tryWrite(key: string, value: string | null): boolean {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function write(key: string, value: string | null): void {
  // 저장소를 쓸 수 없으면 조용히 넘어가요.
  tryWrite(key, value);
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

/** 리바운드 능력치가 있던 때의 포지션 가중치. 예전 저장의 오버롤을 다시 계산할 때만 써요. */
const OLD_WEIGHTS: Record<PosKey, Record<string, number>> = {
  PG: { sht: 0.22, hdl: 0.32, def: 0.14, reb: 0.04, ath: 0.14, iq: 0.14 },
  SG: { sht: 0.34, hdl: 0.18, def: 0.16, reb: 0.05, ath: 0.15, iq: 0.12 },
  SF: { sht: 0.24, hdl: 0.14, def: 0.2, reb: 0.12, ath: 0.18, iq: 0.12 },
  PF: { sht: 0.14, hdl: 0.08, def: 0.22, reb: 0.26, ath: 0.18, iq: 0.12 },
  C: { sht: 0.06, hdl: 0.06, def: 0.26, reb: 0.32, ath: 0.18, iq: 0.12 },
};

/** 예전 키를 새 능력치로: 리바운드는 수비(박스아웃)로, 핸들링·패스는 그대로 볼 핸들링으로 */
const oldKey = (k: string): AttrKey => (k === "reb" ? "def" : (k as AttrKey));

function migrateBoost(b: Boost | undefined): void {
  if (!b) return;
  if (b.trainer) b.trainer = oldKey(b.trainer);
  if (b.attrs && "reb" in b.attrs) {
    const old = b.attrs as Record<string, number>;
    old.def = (old.def ?? 0) + old.reb;
    delete old.reb;
  }
}

/**
 * 리바운드가 빠지고 핸들링·패스가 볼 핸들링과 패스로 나뉘기 전의 능력치를 바꿔요.
 * 패스는 예전 핸들링·패스 값에서 시작하고, 모든 능력치를 같은 만큼 옮겨 예전 오버롤을 지켜요.
 */
function migrateAttrs(c: Career): void {
  const old = c.p.attrs as unknown as Record<string, number>;
  if (!("reb" in old) && "pas" in old) return;
  const oldOvr = Object.entries(OLD_WEIGHTS[c.p.pos]).reduce((t, [k, w]) => t + (old[k] ?? 0) * w, 0);
  const a = {} as Attrs;
  for (const k of ATTR_KEYS) a[k] = old[k === "pas" ? "hdl" : k] ?? 40;
  const shift = oldOvr - ovrOf(a, c.p.pos);
  for (const k of ATTR_KEYS) a[k] = clampAttr(a[k] + shift);
  c.p.attrs = a;
  const d = c.lastDelta as Record<string, number>;
  c.lastDelta = { sht: d.sht, hdl: d.hdl, pas: d.hdl, def: d.def, iq: d.iq, ath: d.ath };
  if ((c.focus as string) === "reb") c.focus = "bal";
  if (c.perks.trainer) c.perks.trainer = oldKey(c.perks.trainer);
  // 대기 중인 이벤트 선택지에 남은 예전 키
  for (const q of c.queue)
    if ("opts" in q)
      for (const o of q.opts) {
        const act: Action = o.act;
        if (act.k === "boost") migrateBoost(act);
        if (act.k === "gamble") {
          migrateBoost(act.win);
          migrateBoost(act.lose);
        }
      }
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
  c.cheers ??= [];
  // 이 기능 전의 저장이면, 이미 NBA를 밟았는지 기록에서 찾아 입성 축하를 건너뛰어요. 트레이드로 팀을 옮길 때 다시 뜨지 않게요.
  if (!c.milestones) c.milestones = c.team?.lg === "nba" || c.hist.some((h) => h.lg === "nba") ? ["nba"] : [];
  c.draftShow ??= null;
  c.invest ??= [];
  c.spent ??= 0;
  c.run ??= null;
  if (c.run) {
    c.run.bigs ??= [];
    c.run.clutch ??= false;
    c.run.spec ??= [];
    c.run.shots ??= [];
    c.run.forced ??= null;
    c.run.bonus ??= 0;
  }
  c.owned ??= [];
  c.shop ??= null;
  refreshShop(c);
  c.donated ??= 0;
  c.moveAsked ??= null;
  migrateAttrs(c);
  return c;
}

/** 저장한 JSON을 지금 모양의 커리어로 읽어요. 예전 저장도 바꿔서 읽고, 읽지 못하면 null이에요. */
export function parseCareer(json: string): Career | null {
  try {
    const c = upgrade(JSON.parse(json));
    return c ? normalize(c) : null;
  } catch {
    return null;
  }
}

export function loadCareer(): Career | null {
  const raw = read(SAVE_KEY);
  return raw ? parseCareer(raw) : null;
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

function readEndings(): unknown[] {
  try {
    const o: unknown = JSON.parse(read(ENDING_KEY) ?? "[]");
    return Array.isArray(o) ? o : [];
  } catch {
    return [];
  }
}

const idOf = (o: unknown): unknown => (o && typeof o === "object" ? (o as { id?: unknown }).id : undefined);

/** 엔딩을 다시 볼 수 있는 커리어 id. 오래된 것부터예요. */
export function loadEndingIds(): string[] {
  return readEndings()
    .map(idOf)
    .filter((id): id is string => typeof id === "string");
}

/** 저장해 둔 은퇴 커리어 하나. 없거나 읽지 못하면 null이에요. */
export function loadEnding(id: string): Career | null {
  const o = readEndings().find((x) => idOf(x) === id);
  const c = o ? parseCareer(JSON.stringify(o)) : null;
  return c?.stage === "retired" ? c : null;
}

/** 은퇴한 커리어를 엔딩 보관함에 넣고, 남은 id를 돌려줘요. 자리가 모자라면 오래된 것부터 지워요. */
export function saveEnding(c: Career): string[] {
  const list = [...readEndings().filter((x) => idOf(x) !== c.id), c].slice(-ENDING_LIMIT);
  while (list.length && !tryWrite(ENDING_KEY, JSON.stringify(list))) list.shift();
  return loadEndingIds();
}
