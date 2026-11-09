import { clampAttr } from "../player/condition";
import { ATTR_KEYS } from "../core/data";
import { ovrOf } from "../player/ratings";
import { refreshShop } from "../economy/shop";
import { EMPTY_LIFETIME, LIFETIME_PREFIX, addLifetime, fromCareer, subLifetime, type Lifetime } from "../legacy/lifetime";
import type { BrowserRecord, LifeView } from "../legacy/achievements";
import type { Action, AttrKey, Attrs, Boost, Career, CareerSummary, PosKey } from "../core/types";

const SAVE_KEY = "b2r-save-v1";
const HALL_KEY = "b2r-hall-v1";
const HALL_LIMIT = 60;
/** 은퇴한 커리어 전체. 엔딩을 다시 볼 때 써요. 한 명에 50KB쯤이라 최근 것만 둬요. */
const ENDING_KEY = "b2r-endings-v1";
const ENDING_LIMIT = 20;
/** 이 브라우저에서 딴 업적. 업적 id → 처음 딴 때와 선수 */
const ACHV_KEY = "b2r-achv-v1";
/** 이 브라우저에서 플레이한 모든 커리어의 누적 기록. v1은 예전 은퇴 기록까지 옮겨 담던 것이라 버리고 새로 세요. */
const LIFETIME_KEY = "b2r-lifetime-v2";
const OLD_LIFETIME_KEY = "b2r-lifetime-v1";

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
  c.natFinal ??= null;
  c.live ??= null;
  c.cheers ??= [];
  c.achv ??= [];
  c.raises ??= 0;
  c.clutchWins ??= 0;
  c.clutchStreak ??= 0;
  c.finalClutchWins ??= 0;
  c.rivalWins ??= 0;
  // 이 기능 전의 저장이면, 이미 NBA를 밟았는지 기록에서 찾아 입성 축하를 건너뛰어요. 트레이드로 팀을 옮길 때 다시 뜨지 않게요.
  if (!c.milestones) c.milestones = c.team?.lg === "nba" || c.hist.some((h) => h.lg === "nba") ? ["nba"] : [];
  c.draftShow ??= null;
  c.invest ??= [];
  c.spent ??= 0;
  // 이 기능 전의 저장이면 지금 계약 연봉을 이미 받아 온 것으로 쳐요 (전과 같은 투자 비용).
  c.paidSalary ??= c.contract?.salary ?? 0;
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
  recordLifetime(c);
  if (c) recordAchievements(c);
}

/**
 * 누적 기록 저장: 끝난 커리어를 더한 base와, 지금 커리어의 몫 cur.
 * 다른 커리어를 저장하거나 새로 시작하면(null) cur를 base에 더해요. 그래서 은퇴하지 않고 그만둔 커리어도 남아요.
 */
interface LifetimeStore {
  /** 누적 기록을 세기 시작한 시각(ms). 이보다 먼저 딴 업적은 업적 사냥꾼이 세지 않아요. */
  since: number;
  base: Lifetime;
  cur: { id: string; t: Lifetime } | null;
  /** 세기 시작할 때 진행 중이던 커리어와 그때까지 쌓은 기록. 그 커리어는 이 뒤로 쌓은 만큼만 쳐요. */
  start: { id: string; t: Lifetime } | null;
}

function readLifetime(): LifetimeStore | null {
  try {
    const o = JSON.parse(read(LIFETIME_KEY) ?? "null") as LifetimeStore | null;
    if (!o || typeof o !== "object" || !o.base || typeof o.since !== "number") return null;
    return { since: o.since, base: { ...EMPTY_LIFETIME, ...o.base }, cur: o.cur ?? null, start: o.start ?? null };
  } catch {
    return null;
  }
}

/**
 * 누적 기록을 지금부터 세기 시작해요. 이미 세고 있으면 그대로예요.
 * 예전 은퇴 기록은 옮기지 않고, 진행 중인 커리어 c가 이미 쌓은 기록은 start로 남겨 빼요.
 * 예전 버전(v1)이 옮겨 담은 기록으로 딴 누적 기록 업적은 브라우저 기록과 c에서 지워 새로 따게 해요.
 * 앱이 처음 불러올 때 불러요.
 */
export function startLifetime(c: Career | null): void {
  if (readLifetime()) return;
  const got = loadAchievements();
  const stale = Object.keys(got).filter((id) => id.startsWith(LIFETIME_PREFIX));
  if (stale.length) {
    for (const id of stale) delete got[id];
    write(ACHV_KEY, JSON.stringify(got));
  }
  if (c) c.achv = c.achv.filter((id) => !id.startsWith(LIFETIME_PREFIX));
  write(OLD_LIFETIME_KEY, null);
  const store: LifetimeStore = { since: Date.now(), base: EMPTY_LIFETIME, cur: null, start: c ? { id: c.id, t: fromCareer(c) } : null };
  write(LIFETIME_KEY, JSON.stringify(store));
}

function lifetimeStore(c: Career | null): LifetimeStore {
  const saved = readLifetime();
  if (saved) return saved;
  startLifetime(c);
  return readLifetime() ?? { since: Date.now(), base: EMPTY_LIFETIME, cur: null, start: c ? { id: c.id, t: fromCareer(c) } : null };
}

/** 세기 시작할 때 진행 중이던 커리어면, 그때까지 쌓은 기록 */
const startOf = (store: LifetimeStore, c: Career): Lifetime | undefined => (store.start?.id === c.id ? store.start.t : undefined);

function recordLifetime(c: Career | null): void {
  const store = lifetimeStore(c);
  let base = store.base;
  if (store.cur && store.cur.id !== c?.id) base = addLifetime(base, store.cur.t);
  let cur: LifetimeStore["cur"] = null;
  if (c) {
    const start = startOf(store, c);
    cur = { id: c.id, t: start ? subLifetime(fromCareer(c), start) : fromCareer(c) };
  }
  write(LIFETIME_KEY, JSON.stringify({ ...store, base, cur } satisfies LifetimeStore));
}

/** 이 브라우저에서 누적 기록을 세기 시작한 뒤로 딴 업적 수 */
function recentAchievements(store: LifetimeStore, got: Record<string, AchievementRecord>): number {
  return Object.values(got).filter((r) => r.at >= store.since).length;
}

/** 업적 창에 보여줄 누적 기록: 모든 커리어(마지막으로 저장한 커리어 포함)를 더한 기록과, 세기 시작한 뒤로 딴 업적 수 */
export function loadLifeView(): LifeView {
  const store = readLifetime();
  if (!store) return { t: EMPTY_LIFETIME, achv: 0 };
  return { t: store.cur ? addLifetime(store.base, store.cur.t) : store.base, achv: recentAchievements(store, loadAchievements()) };
}

/** 업적 판정에 쓰는 브라우저 기록: 이미 딴 업적과, 이 커리어를 뺀 누적 기록 */
export function browserRecord(c: Career): BrowserRecord {
  const store = lifetimeStore(c);
  const got = loadAchievements();
  const { base, cur } = store;
  return {
    unlocked: new Set(Object.keys(got)),
    recent: recentAchievements(store, got),
    others: cur && cur.id !== c.id ? addLifetime(base, cur.t) : base,
    start: startOf(store, c),
  };
}

/** 이 브라우저에서 처음 딴 업적 하나: 딴 시각(ms), 딴 선수 이름, 커리어 id */
export interface AchievementRecord {
  at: number;
  name: string;
  career: string;
}

/** 이 브라우저에서 딴 업적. 업적 id → 처음 딴 기록 */
export function loadAchievements(): Record<string, AchievementRecord> {
  try {
    const o: unknown = JSON.parse(read(ACHV_KEY) ?? "{}");
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, AchievementRecord>) : {};
  } catch {
    return {};
  }
}

/**
 * 커리어 밖에서 정해지는 업적(역대 랭킹)을 이 브라우저 기록에 남겨요. 이미 딴 업적은 건너뛰고, 처음 딴 id를 돌려줘요.
 * who는 딴 선수 이름과 커리어 id예요.
 */
export function unlockAchievements(ids: string[], who: { name: string; career: string }): string[] {
  const got = loadAchievements();
  const fresh = ids.filter((id) => !got[id]);
  if (!fresh.length) return [];
  for (const id of fresh) got[id] = { at: Date.now(), ...who };
  write(ACHV_KEY, JSON.stringify(got));
  return fresh;
}

/** 커리어가 딴 업적 가운데 이 브라우저에서 처음인 것을 남겨요. 커리어를 저장할 때마다 불러요. */
function recordAchievements(c: Career): void {
  if (!c.achv?.length) return;
  const got = loadAchievements();
  const fresh = c.achv.filter((id) => !got[id]);
  if (!fresh.length) return;
  for (const id of fresh) got[id] = { at: Date.now(), name: c.p.name, career: c.id };
  write(ACHV_KEY, JSON.stringify(got));
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
