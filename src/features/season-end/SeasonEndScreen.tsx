"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LEAGUES, seasonCommunity, seasonReport, seasonStandings, type Career, type CareerSummary, type SeasonRecord, type StandingRow, type StandingsTable } from "@/game";
import { gameActions } from "@/shared/store/game-store";
import { TeamBadge } from "@/shared/ui/badge/TeamBadge";
import { CommunityView, ReportView } from "./SeasonReport";

/** 진출선 안의 자리: 4강 직행, 플레이오프 진출 */
function zoneOf(t: StandingsTable, r: StandingRow): "bye" | "po" | undefined {
  if (t.bye && r.rank <= t.bye) return "bye";
  if (t.cut && r.rank <= t.cut) return "po";
}

type View = "report" | "standings" | "community";
const VIEWS: [View, string][] = [
  ["report", "시즌 리포트"],
  ["standings", "순위표"],
  ["community", "커뮤니티"],
];

/**
 * 시즌 결산 화면: 시즌 → 시즌 결산 → 오프시즌 순서의 가운데 화면이에요.
 * 방금 끝난 시즌의 리포트(개인 스탯·누적 기록·수상), 정규시즌 순위, 커뮤니티 반응을 탭으로 보여줘요. 리포트가 먼저 보여요.
 * 시즌이 끝나면 저절로 넘어오고, 오프시즌 홈의 시즌 결과에서 다시 열 수도 있어요.
 * 순위표는 NBA면 내 컨퍼런스가 먼저 보이고, 다른 컨퍼런스로 바꿔 볼 수 있어요.
 */
export function SeasonEndScreen({ career: c, rec, hall }: { career: Career; rec: SeasonRecord; hall: CareerSummary[] }) {
  const st = useMemo(() => seasonStandings(c, rec), [c, rec]);
  const report = useMemo(() => seasonReport(c, rec, hall), [c, rec, hall]);
  const community = useMemo(() => seasonCommunity(c, rec), [c, rec]);
  const [view, setView] = useState<View>("report");
  const [tab, setTab] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // 화면이 통째로 바뀌니 맨 위에서 시작하고, 화면 읽기 프로그램이 새 화면 제목부터 읽게 초점을 옮겨요.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    titleRef.current?.focus({ preventScroll: true });
  }, []);
  // 순위를 만들 수 없는 시즌이면 빈 화면에 갇히지 않게 바로 오프시즌으로 넘어가요.
  useEffect(() => {
    if (!st) gameActions.closeSeasonEnd();
  }, [st]);

  /** 오프시즌 홈으로. 화면이 바뀌니 맨 위에서 시작해요. */
  const close = () => {
    gameActions.closeSeasonEnd();
    window.scrollTo({ top: 0 });
  };

  if (!st) return null;
  const L = LEAGUES[st.lg];
  const table = st.tables[tab];
  const nba = st.lg === "nba";
  const short = (t: StandingsTable) => t.name.replace(/ 컨퍼런스$/, "");
  const metLabel = (m: StandingRow["met"]) => (m === "final" ? (nba ? "파이널 상대" : "결승 상대") : L.pro ? "PO 상대" : "본선 상대");
  const views = VIEWS.filter(([v]) => v !== "community" || community);

  return (
    <main className="se" aria-labelledby="se-title">
      <div className="se-card">
        <div className="se-head">
          <TeamBadge name={rec.team} kind={st.lg} size={56} />
          <span className="sim-team">
            {rec.year} 시즌 결산 · {L.name}
          </span>
          <h2 id="se-title" ref={titleRef} tabIndex={-1}>
            {nba ? short(st.tables[0]) : "정규시즌"} {st.rank}위
          </h2>
          <p className="sim-phase">
            {rec.team} · {rec.w}승 {rec.l}패 · {rec.result}
          </p>
        </div>
        <div className="st-views" role="tablist" aria-label="시즌 결산">
          {views.map(([v, label]) => (
            <button
              type="button"
              role="tab"
              key={v}
              id={`se-tab-${v}`}
              aria-selected={view === v}
              aria-controls="se-panel"
              onClick={() => setView(v)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="se-panel" role="tabpanel" id="se-panel" aria-labelledby={`se-tab-${view}`}>
          {view === "report" && (
            <div className="rp-wrap">
              <ReportView report={report} />
            </div>
          )}
          {view === "community" && community && (
            <div className="rp-wrap">
              <CommunityView domestic={community.domestic} overseas={community.overseas} name={c.p.name} />
            </div>
          )}
          {view === "standings" && (
            <>
              {st.tables.length > 1 && (
                <div className="st-tabs" role="group" aria-label="컨퍼런스">
                  {st.tables.map((t, i) => (
                    <button type="button" key={t.name} aria-pressed={tab === i} onClick={() => setTab(i)}>
                      {short(t)}
                      {i === 0 && " · 내 팀"}
                    </button>
                  ))}
                </div>
              )}
              <table className="st-table">
                <caption className="sr-only">
                  {rec.year} 시즌 {table.name} 정규시즌 순위
                </caption>
                <thead>
                  <tr>
                    <th scope="col">순위</th>
                    <th scope="col" className="l">
                      팀
                    </th>
                    <th scope="col">승</th>
                    <th scope="col">패</th>
                    <th scope="col">승차</th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((r) => (
                    <tr
                      key={r.team}
                      data-me={r.me}
                      data-zone={zoneOf(table, r)}
                      data-cut={(table.cut && r.rank === table.cut) || undefined}
                      style={{ "--tc": r.color } as React.CSSProperties}
                    >
                      <td className="st-rank">{r.rank}</td>
                      <th scope="row" className="st-team">
                        <span className="st-tc">
                          <TeamBadge name={r.team} kind={st.lg} color={r.color} size={18} />
                          <span className="st-name">{r.team}</span>
                          {r.me && <em data-me>내 팀</em>}
                          {r.met && <em data-final={r.met === "final" || undefined}>{metLabel(r.met)}</em>}
                        </span>
                      </th>
                      <td>{r.w}</td>
                      <td>{r.l}</td>
                      <td className="st-gb">{r.gb ? r.gb : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {table.cut > 0 && (
                <p className="st-legend">
                  {table.bye > 0 && (
                    <span>
                      <i data-zone="bye" aria-hidden="true" />
                      {table.bye}위까지 4강 직행
                    </span>
                  )}
                  <span>
                    <i data-zone="po" aria-hidden="true" />
                    {table.cut}위까지 플레이오프
                  </span>
                </p>
              )}
            </>
          )}
        </div>
        <button type="button" className="live-go se-go" onClick={close}>
          오프시즌으로
        </button>
      </div>
    </main>
  );
}
