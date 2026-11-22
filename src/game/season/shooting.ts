import { seededPick } from "../core/random";
import type { Career, PlayoffRecord, SeasonRecord, ShotCounts } from "../core/types";
import { clamp, r1 } from "../core/util";

/*
 * 슈팅(야투·3점슛·자유투)과 턴오버. 득점을 2점슛·3점슛·자유투 성공으로 나누고 시도 수까지 정수로 만들어서,
 * 1경기에 3점 0.9개처럼 나올 수 없는 기록이 생기지 않고 성공률은 언제나 성공/시도예요.
 * 모두 기록에만 남고 승패·시상·성장에는 쓰지 않아요. 흔들림은 커리어 id와 연도로 정해서 시즌 진행의 난수 흐름과 밸런스는 그대로예요.
 */

type Player = Career["p"];

/** 경기당 턴오버 상한. 실제 NBA 한 시즌 최고 기록(5.7개)이에요. */
const TOV_CAP = 5.7;
/** 경기당 턴오버가 이 값을 넘으면 넘은 만큼의 절반만 늘어요. 어시스트가 많은 선수의 턴오버가 끝없이 늘지 않게요. */
const TOV_SOFT = 4;
/** 득점 가운데 자유투로 넣는 몫 */
const FREE_THROW_SHARE = 0.18;
/** 시즌 야투율은 3점 성공률보다 적어도 이만큼 높아요(2점슛이 3점슛보다 잘 들어가요). */
const FG_OVER_THREE = 5;

/** 득점 가운데 3점으로 넣은 몫. 슛 능력과 키로 정하고, 많아도 36%까지예요. */
const threeShare = (p: Player) => clamp(0.1 + (p.attrs.sht - 50) * 0.009 - Math.max(0, p.h - 200) * 0.012, 0.02, 0.36);

/** 경기당 3점슛 성공. 슛 70인 190cm 가드가 20점을 넣으면 1.9개, 슛 50인 212cm 센터는 거의 없어요. */
export function threesPerGame(pts: number, p: Player): number {
  return r1((pts * threeShare(p)) / 3);
}

/**
 * 3점슛 성공률의 목표(%). 슛 능력과 리그 평균 대비 슛으로 정하고 시즌마다 ±2.5%p 흔들려요.
 * NBA 평균 수준의 슈터(슛 87)가 약 36%, 슛 99면 약 40%, 고교 평균(슛 50)이 약 29%예요.
 */
export function threePct(c: Career, year: number, leagueAvg: number): number {
  const sht = c.p.attrs.sht;
  const swing = (seededPick(`${c.id}:${year}:3p`)() - 0.5) * 5;
  return r1(clamp(30.5 + (sht - 60) * 0.2 + (sht - leagueAvg) * 0.14 + swing, 22, 46));
}

/**
 * 자유투 성공률의 목표(%). 슛 능력과 리그 평균 대비 슛으로 정하고, 205cm를 넘는 빅맨은 조금 낮아요. 시즌마다 ±3%p 흔들려요.
 * NBA 평균 수준의 슈터(슛 87)가 약 80%, 슛 99면 약 87%, 고교 평균(슛 50)이 약 65%예요.
 */
export function freeThrowPct(c: Career, year: number, leagueAvg: number): number {
  const { attrs, h } = c.p;
  const swing = (seededPick(`${c.id}:${year}:ft`)() - 0.5) * 6;
  return r1(clamp(69 + (attrs.sht - 60) * 0.42 + (attrs.sht - leagueAvg) * 0.1 - Math.max(0, h - 205) * 0.35 + swing, 45, 95));
}

/** 공을 많이 만질수록(득점·어시스트·출전 시간) 턴오버가 늘고, 볼 핸들링과 농구 지능이 높으면 줄어요. */
function turnovers(p: Player, line: { pts: number; ast: number; min: number }, swing: number): number {
  const care = (p.attrs.hdl + p.attrs.iq) / 2;
  const volume = line.pts * 0.055 + line.ast * 0.22 + line.min * 0.015;
  const raw = volume * clamp(1.2 - (care - 50) * 0.008, 0.7, 1.35) * swing;
  return r1(Math.min(TOV_CAP, raw <= TOV_SOFT ? raw : TOV_SOFT + (raw - TOV_SOFT) * 0.5));
}

/** 경기당 턴오버. 시즌마다 ±10% 흔들려요. 에이스 가드(25점 7어시스트 35분)가 3개쯤이고, 상한은 5.7개예요. */
export function turnoversPerGame(c: Career, year: number, line: { pts: number; ast: number; min: number }): number {
  return turnovers(c.p, line, 0.9 + seededPick(`${c.id}:${year}:tov`)() * 0.2);
}

/** 경기당 턴오버를 합계로. 반올림으로 상한을 넘지 않아요. */
const totalTurnovers = (perGame: number, gp: number) => Math.min(Math.floor(TOV_CAP * gp), Math.round(perGame * gp));

/** 성공률 목표로 시도 수를 정해요. 평균을 지키며 정수로 반올림하고, 성공 수보다 적지 않아요. */
const attempts = (made: number, pct: number, rand: () => number) => (made ? Math.max(made, Math.floor((made * 100) / pct + rand())) : 0);

/** 합계 득점을 3점슛·2점슛·자유투 성공으로 나누고(2×2점 + 3×3점 + 자유투 = 득점) 시도 수를 정해요. */
function shotCounts(pts: number, threes: number, target: { fg: number; tp: number; ft: number }, tov: number, rand: () => number): ShotCounts {
  const tpm = Math.min(threes, Math.floor(pts / 3));
  const left = pts - tpm * 3;
  let ftm = Math.min(left, Math.floor(left * FREE_THROW_SHARE + rand()));
  // 나머지는 2점슛이라 짝수여야 해요.
  if ((left - ftm) % 2) ftm++;
  const twos = (left - ftm) / 2;
  const fgm = twos + tpm;
  const tpa = attempts(tpm, target.tp, rand);
  const fta = attempts(ftm, target.ft, rand);
  // 야투 시도에는 3점 시도와 성공한 2점슛이 모두 들어 있어요.
  const fga = fgm ? Math.max(tpa + twos, attempts(fgm, target.fg, rand)) : 0;
  return { fgm, fga, tpm, tpa, ftm, fta, tov };
}

const pctOf = (made: number, tried: number) => r1((made / tried) * 100);

/**
 * 시즌 기록에 슈팅과 턴오버를 채워요. rec.fg는 야투율 목표로 받아 실제 성공/시도로 바꿔요.
 * 경기당 3점슛 성공(rec.tpm)은 랭킹 점수에 들어가니 그대로 둬요. pts는 시즌 합계 득점이에요.
 */
export function applySeasonShooting(c: Career, rec: SeasonRecord, pts: number, leagueAvg: number): void {
  if (!rec.gp) return;
  const rand = seededPick(`${c.id}:${rec.year}:shots`);
  const tp = threePct(c, rec.year, leagueAvg);
  const ft = freeThrowPct(c, rec.year, leagueAvg);
  const tov = totalTurnovers(turnoversPerGame(c, rec.year, rec), rec.gp);
  const s = shotCounts(pts, Math.round((rec.tpm ?? 0) * rec.gp), { fg: Math.max(rec.fg, tp + FG_OVER_THREE), tp, ft }, tov, rand);
  rec.shots = s;
  rec.fg = s.fga ? pctOf(s.fgm, s.fga) : 0;
  // 3점을 거의 쏘지 않은 시즌(경기당 0.2개 미만)은 성공률을 보여주지 않아요.
  if ((rec.tpm ?? 0) >= 0.2 && s.tpa) rec.tpp = pctOf(s.tpm, s.tpa);
  if (s.fta) rec.ftp = pctOf(s.ftm, s.fta);
  rec.tov = r1(tov / rec.gp);
}

/**
 * 플레이오프 슈팅과 턴오버. 정규시즌 기록을 중심으로 수비가 강해져 야투·3점이 1%p 낮고, 턴오버는 5% 늘어요.
 * 경기 수가 적을수록 크게 흔들려요(4경기면 야투 ±4%p, 16경기면 ±2%p). pts는 플레이오프 합계 득점이에요.
 * 성공이 없는 슛은 성공률을 남기지 않아요(화면에 "–").
 */
export function playoffShooting(
  c: Career,
  year: number,
  rec: SeasonRecord,
  po: PlayoffRecord,
  pts: number,
  leagueAvg: number,
): Pick<PlayoffRecord, "fg" | "tpm" | "tpp" | "ftp" | "tov" | "shots"> {
  const rand = seededPick(`${c.id}:${year}:poshot`);
  const noise = (range: number) => ((rand() - 0.5) * 2 * range) / Math.sqrt(po.gp);
  const fg = clamp((rec.fg || 45) - 1 + noise(8), 25, 72);
  const tp = clamp((rec.tpp ?? threePct(c, year, leagueAvg)) - 1 + noise(12), 15, 60);
  const ft = clamp((rec.ftp ?? freeThrowPct(c, year, leagueAvg)) + noise(10), 40, 99);
  const tov = totalTurnovers(turnovers(c.p, po, 1.05 * (0.9 + rand() * 0.2)), po.gp);
  const s = shotCounts(pts, Math.floor((pts * threeShare(c.p)) / 3 + rand()), { fg, tp, ft }, tov, rand);
  return {
    ...(s.fga ? { fg: pctOf(s.fgm, s.fga) } : {}),
    tpm: r1(s.tpm / po.gp),
    ...(s.tpa ? { tpp: pctOf(s.tpm, s.tpa) } : {}),
    ...(s.fta ? { ftp: pctOf(s.ftm, s.fta) } : {}),
    tov: r1(tov / po.gp),
    shots: s,
  };
}

/** 여러 시즌을 합친 슈팅과 턴오버. 값이 있는 시즌이 없으면 null이에요. */
export interface ShootingLine {
  fg: number | null;
  tpp: number | null;
  ftp: number | null;
  tov: number | null;
}

interface ShotRow {
  gp: number;
  pts: number;
  fg?: number;
  tpm?: number;
  tpp?: number;
  ftp?: number;
  tov?: number;
  shots?: ShotCounts;
}

/** 성공·시도 수가 없는 예전 기록은 득점과 성공률로 성공·시도를 어림해요. */
function countsOf(h: ShotRow): ShotCounts {
  if (h.shots) return h.shots;
  const pts = h.pts * h.gp;
  const tpm = h.tpp && h.tpm ? h.tpm * h.gp : 0;
  const ftm = h.ftp ? pts * FREE_THROW_SHARE : 0;
  return {
    fgm: h.fg ? pts / 2 : 0,
    fga: h.fg ? pts / 2 / (h.fg / 100) : 0,
    tpm,
    tpa: tpm ? tpm / (h.tpp! / 100) : 0,
    ftm,
    fta: ftm ? ftm / (h.ftp! / 100) : 0,
    tov: (h.tov ?? 0) * h.gp,
  };
}

/** 시즌들의 슈팅과 턴오버를 합쳐요. 성공률은 합친 성공/시도예요. 이 기록이 생기기 전 시즌의 3점·자유투·턴오버는 빼고 계산해요. */
export function sumShooting(rows: ShotRow[]): ShootingLine {
  const played = rows.filter((h) => h.gp > 0);
  const lines = played.map(countsOf);
  const total = (k: keyof ShotCounts) => lines.reduce((t, x) => t + x[k], 0);
  const ratio = (made: keyof ShotCounts, tried: keyof ShotCounts) => (total(tried) > 0 ? pctOf(total(made), total(tried)) : null);
  const tovGames = played.reduce((t, h) => t + (h.shots || h.tov !== undefined ? h.gp : 0), 0);
  return {
    fg: ratio("fgm", "fga"),
    tpp: ratio("tpm", "tpa"),
    ftp: ratio("ftm", "fta"),
    tov: tovGames ? r1(total("tov") / tovGames) : null,
  };
}

/** 시즌들의 플레이오프 기록만 뽑아요. */
export const playoffLines = (rows: SeasonRecord[]): PlayoffRecord[] => rows.flatMap((h) => (h.po ? [h.po] : []));
