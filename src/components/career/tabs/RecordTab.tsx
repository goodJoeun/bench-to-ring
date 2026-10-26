import { LEAGUES, careerSummary, fmtNum, r1, stripYear, type Career } from "@/game";
import { militaryLine } from "@/components/common/format";
import { TeamBadge } from "@/components/common/TeamBadge";
import { Panel, StatTiles } from "@/components/common/ui";

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
                <th>FG%</th>
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
                  <td>{h.fg || "–"}</td>
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
      <NationalLog career={c} />
    </>
  );
}
