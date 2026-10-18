import { LEAGUES, careerSummary, r1, type Career } from "@/game";

/** 병역 상태 한 줄. 대한민국 선수만 보여줘요. */
export function militaryLine(c: Career): string | null {
  if (c.p.nat !== "대한민국") return null;
  const m = c.mil;
  if (m.s === "exempt") return "병역 특례 (예술체육요원)";
  if (m.s === "served") return m.kind === "sangmu" ? "상무 복무 마침" : "현역 복무 마침";
  if (m.s === "serving") return m.kind === "sangmu" ? "상무 복무 중" : "현역 복무 중";
  return "병역 미필 · 만 28세까지 입대해야 해요";
}

function NationalLog({ career: c }: { career: Career }) {
  const log = [...c.natLog].reverse();
  return (
    <section className="panel">
      <h2 className="sec">국가대표 기록 · {c.nat.caps}경기</h2>
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
                      <b>{t.name.replace(/^d{4} /, "")}</b>
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
                          <span>vs {g.opp}</span>
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
      {militaryLine(c) && <p className="hint">병역 · {militaryLine(c)}</p>}
    </section>
  );
}

export function RecordTab({ career: c }: { career: Career }) {
  if (!c.hist.length)
    return (
      <section className="panel">
        <p className="empty">아직 기록이 없어요. 첫 시즌을 진행해 보세요.</p>
      </section>
    );
  const s = careerSummary(c);
  const ppg = s.gp ? r1(s.pts / s.gp) : 0;
  const tiles: [string, string | number][] = [
    ["출전", s.gp.toLocaleString("ko-KR")],
    ["득점", s.pts.toLocaleString("ko-KR")],
    ["평균 득점", ppg],
    ["최고 오버롤", c.peakOvr],
  ];
  return (
    <>
      <section className="panel">
        <h2 className="sec">프로 통산</h2>
        <div className="tiles">
          {tiles.map(([k, v]) => (
            <div className="tile" key={k}>
              <span className="label">{k}</span>
              <span className="n">{v}</span>
            </div>
          ))}
        </div>
        {c.draft && (
          <p className="hint">
            {c.draft.year} {c.draft.lg} 드래프트 {c.draft.round}라운드 {c.draft.inRound}순위 · {c.draft.team}
          </p>
        )}
      </section>
      <section className="panel">
        <h2 className="sec">시즌별 기록</h2>
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
                  <td className="l t">{h.team}</td>
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
      </section>
      <NationalLog career={c} />
    </>
  );
}
