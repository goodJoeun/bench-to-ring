"use client";

import { useState } from "react";
import {
  LEAGUES,
  careerSplits,
  careerSummary,
  fmtNum,
  missingPlayoffs,
  r1,
  playoffLines,
  stripYear,
  sumPlayoffs,
  sumShooting,
  type Career,
  type PlayoffTotals,
  type RecordSplit,
  type ShootingLine,
  type SplitKey,
} from "@/game";
import { militaryLine } from "@/shared/lib/format";
import { TeamBadge } from "@/shared/ui/badge/TeamBadge";
import { Panel, StatTiles } from "@/shared/ui/ui";
import styles from "../career.module.css";

function NationalLog({ career: c }: { career: Career }) {
  const log = [...c.natLog].reverse();
  const mil = militaryLine(c);
  return (
    <Panel
      title={
        <span className="team-cell">
          <TeamBadge name={c.p.nat} size={20} />
          국가대표 기록 · {c.nat.caps}경기
        </span>
      }
    >
      {log.length ? (
        <ul className={styles.natlog}>
          {log.map((t, i) => {
            const w = t.games.filter((g) => g.win).length;
            return (
              <li key={`${t.year}-${t.ev}-${i}`} data-medal={t.medal ?? undefined} data-joined={t.joined || undefined}>
                <details>
                  <summary>
                    <span className={styles.ny}>{t.year}</span>
                    <span className={styles.nb}>
                      <b>{stripYear(t.name)}</b>
                      <span>
                        {t.joined ? "합류" : "불참"} · {t.label}
                        {t.games.length > 0 && ` · ${w}승 ${t.games.length - w}패`}
                      </span>
                    </span>
                    {t.medal && <span className="aw">{t.medal}메달</span>}
                  </summary>
                  <p className="hint">{t.story}</p>
                  {t.games.length > 0 && (
                    <ol className={styles.natgames}>
                      {t.games.map((g, k) => (
                        <li key={k} data-win={g.win || undefined}>
                          <span>{g.stage}</span>
                          <span className="team-cell">
                            <TeamBadge name={g.opp} kind="nat" size={16} />
                            vs {g.opp}
                          </span>
                          <span className={styles.sc}>
                            {g.us}-{g.them} {g.win ? "승" : "패"}
                          </span>
                          {g.pts !== undefined && <span className={styles.pt}>{g.pts}점</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                </details>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty">아직 국가대표로 뽑힌 적이 없어요.</p>
      )}
      {mil && <p className="hint">병역 · {mil}</p>}
    </Panel>
  );
}

const splitName = (k: SplitKey) => (k === "mil" ? "군 복무" : LEAGUES[k].short);

/** 고른 리그나 팀의 정규시즌 통산과 플레이오프 통산 */
function SplitSummary({ scope, lg, split: s }: { scope: string; lg: SplitKey; split: RecordSplit }) {
  const t = s.regular;
  const mil = lg === "mil";
  const poName = s.rows[0].pro ? "플레이오프" : "전국대회 본선";
  const period = s.from === s.to ? `${s.from}` : `${s.from}–${s.to}`;
  const note =
    `${t.seasons}시즌(${period}) · 팀 ${t.w}승 ${t.l}패${s.titles ? ` · 우승 ${s.titles}회` : ""} · ` +
    `통산 ${fmtNum(t.pts)}득점 ${fmtNum(t.reb)}리바운드 ${fmtNum(t.ast)}어시스트 ${fmtNum(t.stl)}스틸 ${fmtNum(t.blk)}블록`;
  return (
    <>
      <PlayoffSummary label={`${scope} ${mil ? "D리그" : "정규시즌"} 통산`} t={t} shot={s.regularShot} note={note} />
      {s.playoffs.seasons > 0 ? (
        <PlayoffSummary label={`${scope} ${poName} 통산`} t={s.playoffs} shot={s.playoffShot} />
      ) : (
        !mil && <p className="hint">{scope}에서 남은 {poName} 기록이 없어요.</p>
      )}
    </>
  );
}

/** 시즌별 기록 표. 리그와 그 안의 팀을 골라 볼 수 있고, 최근 시즌부터 보여줘요. 진행 중 기록 탭과 은퇴 화면이 함께 써요. */
export function SeasonTable({ career: c }: { career: Career }) {
  const [pick, setPick] = useState<{ lg: SplitKey; team: string | null } | null>(null);
  const splits = careerSplits(c);
  const league = splits.find((s) => s.key === pick?.lg) ?? null;
  // 한 팀에서만 뛴 리그는 리그 합계와 팀 기록이 같아서 바로 그 팀을 보여줘요.
  const team = league?.teams.length === 1 ? league.teams[0] : (league?.teams.find((t) => t.team === pick?.team) ?? null);
  const shown = team ?? league;
  const rows = shown?.rows ?? c.hist;
  return (
    <Panel title="시즌별 기록">
      {splits.length > 0 && (
        <div className={styles.splitNav}>
          <div className={styles.splitTabs} role="group" aria-label="리그 선택">
            <button type="button" aria-pressed={!league} onClick={() => setPick(null)}>
              전체
            </button>
            {splits.map((s) => (
              <button key={s.key} type="button" aria-pressed={league?.key === s.key} onClick={() => setPick({ lg: s.key, team: null })}>
                {splitName(s.key)}
                <small>{s.regular.seasons}시즌</small>
              </button>
            ))}
          </div>
          {league && (
            <div className={`${styles.splitTabs} teams`} role="group" aria-label={`${splitName(league.key)} 팀 선택`}>
              {league.teams.length > 1 && (
                <button type="button" aria-pressed={!team} onClick={() => setPick({ lg: league.key, team: null })}>
                  리그 전체
                </button>
              )}
              {league.teams.map((t) => (
                <button
                  key={t.team}
                  type="button"
                  aria-pressed={team?.team === t.team}
                  onClick={() => setPick({ lg: league.key, team: t.team })}
                >
                  <TeamBadge name={t.team} size={16} />
                  {t.team}
                  <small>{t.regular.seasons}시즌</small>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {league && shown && (
        <SplitSummary
          scope={team ? `${splitName(league.key)} · ${team.team}` : splitName(league.key)}
          lg={league.key}
          split={shown}
        />
      )}
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th className="l">시즌</th>
              <th>나이</th>
              <th className="l">팀</th>
              <th className="l">리그</th>
              <th className="l">역할</th>
              <th>경기</th>
              <th>분</th>
              <th>득점</th>
              <th>리바</th>
              <th>어시</th>
              <th>스틸</th>
              <th>블록</th>
              <th>FG%</th>
              <th>3P%</th>
              <th>FT%</th>
              <th>턴오버</th>
              <th>평점</th>
              <th>OVR</th>
              <th className="l">수상</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((h) => (
              <tr key={h.year}>
                <td className="l">{h.year}</td>
                <td>{h.age}</td>
                <td className="l t">
                  <span className="team-cell">
                    <TeamBadge name={h.team} size={16} />
                    {h.team}
                  </span>
                </td>
                <td className="l t">{h.lg ? LEAGUES[h.lg].short : "–"}</td>
                <td className="l t">{h.role}</td>
                <td>{h.gp}</td>
                <td>{h.min}</td>
                <td>{h.pts}</td>
                <td>{h.reb}</td>
                <td>{h.ast}</td>
                <td>{h.stl}</td>
                <td>{h.blk}</td>
                <td>{h.fg || "–"}</td>
                <td>{h.tpp ?? "–"}</td>
                <td>{h.ftp ?? "–"}</td>
                <td>{h.tov ?? "–"}</td>
                <td>{h.rating || "–"}</td>
                <td>
                  {h.ovr0}→{h.ovr1}
                </td>
                <td className="l t">{h.awards.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.some((h) => h.gp > 0 && h.ftp === undefined && !h.shots) && <p className="hint">자유투율과 턴오버는 이 기록이 생긴 뒤 치른 시즌부터 남아요. 통산도 그 시즌들로 계산해요.</p>}
    </Panel>
  );
}

const pct = (v: number | null) => (v === null ? "–" : `${v.toFixed(1)}%`);

/** 야투율·3점 성공률·자유투율·경기당 턴오버 타일 */
function ShotTiles({ s }: { s: ShootingLine }) {
  const tiles: [string, string][] = [
    ["야투율", pct(s.fg)],
    ["3점슛", pct(s.tpp)],
    ["자유투", pct(s.ftp)],
    ["턴오버", s.tov === null ? "–" : s.tov.toFixed(1)],
  ];
  return (
    <div className={`tiles ${styles.shotTiles}`}>
      {tiles.map(([k, v]) => (
        <div className="tile" key={k}>
          <span className="label">{k}</span>
          <span className="n">{v}</span>
        </div>
      ))}
    </div>
  );
}

/** 통산 한 묶음: "프로 플레이오프 통산 21경기 평균"과 경기당 기록·슈팅 타일, 아래 설명(없으면 진출 시즌과 팀 플레이오프 승패) */
function PlayoffSummary({ label, t, shot, note }: { label: string; t: PlayoffTotals; shot: ShootingLine; note?: string }) {
  const avg = (v: number) => (t.gp ? r1(v / t.gp).toFixed(1) : "–");
  const tiles: [string, string][] = [
    ["득점", avg(t.pts)],
    ["리바운드", avg(t.reb)],
    ["어시스트", avg(t.ast)],
    ["스틸", avg(t.stl)],
    ["블록", avg(t.blk)],
    ["출전 시간", avg(t.min)],
  ];
  return (
    <section className={styles.poSum} aria-label={label}>
      <h3>
        {label} <b>{fmtNum(t.gp)}경기</b> 평균
      </h3>
      <div className={`tiles ${styles.poTiles}`}>
        {tiles.map(([k, v]) => (
          <div className="tile" key={k}>
            <span className="label">{k}</span>
            <span className="n">{v}</span>
          </div>
        ))}
      </div>
      <ShotTiles s={shot} />
      <p className="hint">
        {note ??
          `진출 ${t.seasons}시즌 · 팀 플레이오프 ${t.w}승 ${t.l}패 · 통산 ${fmtNum(t.pts)}득점 ${fmtNum(t.reb)}리바운드 ${fmtNum(t.ast)}어시스트 ${fmtNum(t.stl)}스틸 ${fmtNum(t.blk)}블록`}
      </p>
    </section>
  );
}

/**
 * 플레이오프 기록: 프로 플레이오프 통산 평균, 고교·대학 전국대회 본선 통산, 시즌별 플레이오프 기록 표.
 * 정규시즌 기록(시즌별 기록 표, 프로 통산)과 따로 세요. 진행 중 기록 탭과 은퇴 화면이 함께 써요.
 */
export function PlayoffPanel({ career: c }: { career: Career }) {
  const rows = c.hist.filter((h) => h.po);
  const proRows = c.hist.filter((h) => h.pro);
  const amateurRows = c.hist.filter((h) => !h.pro);
  const pro = sumPlayoffs(proRows);
  const amateur = sumPlayoffs(amateurRows);
  const missing = missingPlayoffs(c.hist).length;
  const noShot = rows.some((h) => h.po!.gp > 0 && h.po!.ftp === undefined && !h.po!.shots);
  return (
    <Panel title="플레이오프 기록">
      {pro.seasons > 0 ? (
        <PlayoffSummary label="프로 플레이오프 통산" t={pro} shot={sumShooting(playoffLines(proRows))} />
      ) : (
        <p className="hint">아직 프로 플레이오프 무대를 밟지 못했어요. 정규시즌 성적이 좋으면 플레이오프에 올라요.</p>
      )}
      {amateur.seasons > 0 && <PlayoffSummary label="고교·대학 전국대회 본선 통산" t={amateur} shot={sumShooting(playoffLines(amateurRows))} />}
      {rows.length > 0 && (
        <div className="tbl-wrap">
          <table>
            <caption className="sr-only">시즌별 플레이오프 기록</caption>
            <thead>
              <tr>
                <th className="l">시즌</th>
                <th>나이</th>
                <th className="l">팀</th>
                <th className="l">리그</th>
                <th className="l">성적</th>
                <th>팀 승패</th>
                <th>경기</th>
                <th>분</th>
                <th>득점</th>
                <th>리바</th>
                <th>어시</th>
                <th>스틸</th>
                <th>블록</th>
                <th>FG%</th>
                <th>3P%</th>
                <th>FT%</th>
                <th>턴오버</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((h) => {
                const po = h.po!;
                const out = po.gp === 0;
                return (
                  <tr key={h.year}>
                    <td className="l">{h.year}</td>
                    <td>{h.age}</td>
                    <td className="l t">
                      <span className="team-cell">
                        <TeamBadge name={h.team} size={16} />
                        {h.team}
                      </span>
                    </td>
                    <td className="l t">{h.lg ? LEAGUES[h.lg].short : "–"}</td>
                    <td className="l t">{h.result}</td>
                    <td>
                      {po.w}-{po.l}
                    </td>
                    <td>{out ? "결장" : po.gp}</td>
                    <td>{out ? "–" : po.min}</td>
                    <td>{out ? "–" : po.pts}</td>
                    <td>{out ? "–" : po.reb}</td>
                    <td>{out ? "–" : po.ast}</td>
                    <td>{out ? "–" : po.stl}</td>
                    <td>{out ? "–" : po.blk}</td>
                    <td>{po.fg ?? "–"}</td>
                    <td>{po.tpp ?? "–"}</td>
                    <td>{po.ftp ?? "–"}</td>
                    <td>{po.tov ?? "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {noShot && <p className="hint">플레이오프 야투율·3점슛·자유투율·턴오버는 이 기록이 생긴 뒤 치른 시즌부터 남아요. 통산도 그 시즌들로 계산해요.</p>}
      {missing > 0 && <p className="hint">플레이오프 기록이 생기기 전에 치른 {missing}시즌의 플레이오프는 기록에 없어요.</p>}
    </Panel>
  );
}

export function RecordTab({ career: c }: { career: Career }) {
  if (!c.hist.length)
    return (
      <Panel>
        <p className="empty">아직 기록이 없어요. 첫 시즌을 진행해 보세요.</p>
      </Panel>
    );
  const s = careerSummary(c);
  const ppg = s.gp ? r1(s.pts / s.gp) : 0;
  const tiles: [string, string | number][] = [
    ["출전", fmtNum(s.gp)],
    ["득점", fmtNum(s.pts)],
    ["평균 득점", ppg],
    ["최고 오버롤", c.peakOvr],
  ];
  return (
    <>
      <Panel title="프로 통산">
        <StatTiles items={tiles} />
        {s.gp > 0 && <ShotTiles s={sumShooting(c.hist.filter((h) => h.pro))} />}
        {c.draft && (
          <p className="hint">
            {c.draft.year} {c.draft.lg} 드래프트 {c.draft.round}라운드 {c.draft.inRound}순위 · {c.draft.team}
          </p>
        )}
      </Panel>
      <SeasonTable career={c} />
      <PlayoffPanel career={c} />
      <NationalLog career={c} />
    </>
  );
}
