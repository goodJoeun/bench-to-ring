"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LEAGUES, seasonStandings, type Career, type SeasonRecord, type StandingRow, type StandingsTable } from "@/game";
import { gameActions } from "@/shared/store/game-store";
import { useEscapeKey } from "@/shared/lib/hooks";
import { TeamBadge } from "@/shared/ui/badge/TeamBadge";
import { Popup } from "./Popup";

/** 진출선 안의 자리: 4강 직행, 플레이오프 진출 */
function zoneOf(t: StandingsTable, r: StandingRow): "bye" | "po" | undefined {
  if (t.bye && r.rank <= t.bye) return "bye";
  if (t.cut && r.rank <= t.cut) return "po";
}

/**
 * 시즌 순위표: 시즌이 끝나면 방금 끝난 시즌의 정규시즌 순위를 보여줘요. 홈의 시즌 결과에서 다시 열 수도 있어요.
 * NBA는 내 컨퍼런스가 먼저 보이고, 다른 컨퍼런스로 바꿔 볼 수 있어요. 내 팀 줄이 보이게 목록을 내려 둬요.
 */
export function StandingsPopup({ career: c, rec }: { career: Career; rec: SeasonRecord }) {
  const st = useMemo(() => seasonStandings(c, rec), [c, rec]);
  const [tab, setTab] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const goRef = useRef<HTMLButtonElement>(null);
  const close = () => gameActions.closeStandings();
  useEscapeKey(close);

  // 확인 버튼에 초점을 두되, 긴 목록 아래로 화면이 밀려 내려가지 않게 해요.
  useEffect(() => {
    goRef.current?.focus({ preventScroll: true });
  }, []);
  // 내 팀 줄을 목록 가운데로. 다른 컨퍼런스는 맨 위부터 보여줘요.
  useEffect(() => {
    const wrap = wrapRef.current;
    const me = wrap?.querySelector<HTMLElement>("tr[data-me]");
    if (wrap) wrap.scrollTop = me ? Math.max(0, me.offsetTop - (wrap.clientHeight - me.offsetHeight) / 2) : 0;
  }, [tab]);

  if (!st) return null;
  const L = LEAGUES[st.lg];
  const table = st.tables[tab];
  const nba = st.lg === "nba";
  const short = (t: StandingsTable) => t.name.replace(/ 컨퍼런스$/, "");
  const metLabel = (m: StandingRow["met"]) => (m === "final" ? (nba ? "파이널 상대" : "결승 상대") : L.pro ? "PO 상대" : "본선 상대");

  return (
    <Popup labelledBy="st-title" className="standings">
      <span className="sim-team">
        {rec.year} 시즌 최종 순위 · {L.name}
      </span>
      <h2 id="st-title">
        {nba ? short(st.tables[0]) : "정규시즌"} {st.rank}위
      </h2>
      <p className="sim-phase">
        {rec.team} · {rec.w}승 {rec.l}패 · {rec.result}
      </p>
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
      <div className="st-wrap" ref={wrapRef}>
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
      </div>
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
      <button type="button" ref={goRef} className="live-go" onClick={close}>
        확인
      </button>
    </Popup>
  );
}
