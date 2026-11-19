import { LEAGUES, careerSummary, fmtNum, missingPlayoffs, r1, stripYear, sumPlayoffs, type Career, type PlayoffTotals } from "@/game";
import { militaryLine } from "@/shared/lib/format";
import { TeamBadge } from "@/shared/ui/badge/TeamBadge";
import { Panel, StatTiles } from "@/shared/ui/ui";

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
        <ul className="natlog">
          {log.map((t, i) => {
            const w = t.games.filter((g) => g.win).length;
            return (
              <li key={`${t.year}-${t.ev}-${i}`} data-medal={t.medal ?? undefined} data-joined={t.joined || undefined}>
                <details>
                  <summary>
                    <span className="ny">{t.year}</span>
                    <span className="nb">
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
                    <ol className="natgames">
                      {t.games.map((g, k) => (
                        <li key={k} data-win={g.win || undefined}>
                          <span>{g.stage}</span>
                          <span className="team-cell">
                            <TeamBadge name={g.opp} kind="nat" size={16} />
                            vs {g.opp}
                          </span>
                          <span className="sc">
                            {g.us}-{g.them} {g.win ? "승" : "패"}
                          </span>
                          {g.pts !== undefined && <span className="pt">{g.pts}점</span>}
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

/** 시즌별 기록 표. 최근 시즌부터 보여줘요. 진행 중 기록 탭과 은퇴 화면이 함께 써요. */
export function SeasonTable({ career: c }: { career: Career }) {
  return (
    <Panel title="시즌별 기록">
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
              <th>평점</th>
              <th>OVR</th>
              <th className="l">수상</th>
            </tr>
          </thead>
          <tbody>
            {[...c.hist].reverse().map((h) => (
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
    </Panel>
  );
}

/** 플레이오프 통산 한 묶음: "프로 플레이오프 통산 21경기 평균"과 경기당 기록 타일, 진출 시즌과 팀 승패 */
function PlayoffSummary({ label, t }: { label: string; t: PlayoffTotals }) {
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
    <section className="po-sum" aria-label={label}>
      <h3>
        {label} <b>{fmtNum(t.gp)}경기</b> 평균
      </h3>
      <div className="tiles po-tiles">
        {tiles.map(([k, v]) => (
          <div className="tile" key={k}>
            <span className="label">{k}</span>
            <span className="n">{v}</span>
          </div>
        ))}
      </div>
      <p className="hint">
        진출 {t.seasons}시즌 · 팀 플레이오프 {t.w}승 {t.l}패 · 통산 {fmtNum(t.pts)}득점 {fmtNum(t.reb)}리바운드 {fmtNum(t.ast)}어시스트{" "}
        {fmtNum(t.stl)}스틸 {fmtNum(t.blk)}블록
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
  const pro = sumPlayoffs(c.hist.filter((h) => h.pro));
  const amateur = sumPlayoffs(c.hist.filter((h) => !h.pro));
  const missing = missingPlayoffs(c.hist).length;
  return (
    <Panel title="플레이오프 기록">
      {pro.seasons > 0 ? (
        <PlayoffSummary label="프로 플레이오프 통산" t={pro} />
      ) : (
        <p className="hint">아직 프로 플레이오프 무대를 밟지 못했어요. 정규시즌 성적이 좋으면 플레이오프에 올라요.</p>
      )}
      {amateur.seasons > 0 && <PlayoffSummary label="고교·대학 전국대회 본선 통산" t={amateur} />}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
