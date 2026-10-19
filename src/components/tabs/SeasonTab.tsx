import { LEAGUES, currentExpectedMinutes, roleOf, type Career, type SeasonRecord } from "@/game";
import { Panel } from "../ui";

/** 경기를 뛰지 않은 시즌 (현역 복무, 무소속) */
function NoGamesCard({ r, kicker, title }: { r: SeasonRecord; kicker: string; title: string }) {
  return (
    <Panel kicker={kicker} title={title}>
      <p className="hint">
        경기는 뛰지 않았어요. 오버롤 {r.ovr0} → {r.ovr1}
      </p>
    </Panel>
  );
}

function ResultCard({ r }: { r: SeasonRecord }) {
  if (r.mil === "army") return <NoGamesCard r={r} kicker={`${r.year} 시즌 · 군 복무`} title={r.team} />;
  if (!r.lg && !r.mil) return <NoGamesCard r={r} kicker={`${r.year} 시즌`} title="무소속 · 개인 훈련" />;
  const stats: [string, number][] = [
    ["PTS", r.pts],
    ["REB", r.reb],
    ["AST", r.ast],
    ["STL", r.stl],
    ["BLK", r.blk],
    ["FG%", r.fg],
  ];
  return (
    <section className="panel">
      <div className="rc-head">
        <div>
          <span className="label">
            {r.year} 시즌 · {r.team} · {r.lg ? LEAGUES[r.lg].short : "D리그"}
          </span>
          <h2 className="sec">
            {r.role} · {r.w}승 {r.l}패 · {r.result}
          </h2>
        </div>
        <div className="rating">
          <span className="label">평점</span>
          <b>{r.rating}</b>
        </div>
      </div>
      <div className="statline">
        {stats.map(([k, v]) => (
          <div className="stat" key={k}>
            <span className="n">{v}</span>
            <span className="k">{k}</span>
          </div>
        ))}
      </div>
      <div className="meta-row">
        <span>
          출전 <b>{r.gp}경기</b>
        </span>
        <span>
          평균 <b>{r.min}분</b>
        </span>
        <span>
          오버롤{" "}
          <b>
            {r.ovr0} → {r.ovr1}
          </b>
        </span>
      </div>
      {r.final && (
        <p className="hint">
          결승 상대 {r.final.opp} · {r.final.series ? `시리즈 ${r.final.series} · ` : ""}마지막 경기 {r.final.us}-{r.final.them}{" "}
          {r.final.win ? "승리" : "패배"}
        </p>
      )}
      {r.awards.length > 0 && (
        <div className="awards">
          {r.awards.map((a, i) => (
            <span className="aw" key={`${a}-${i}`}>
              {a}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function Preseason({ career: c }: { career: Career }) {
  const min = currentExpectedMinutes(c);
  return (
    <Panel kicker="프리시즌 리포트" title={`${c.team?.name} 농구부의 막내`}>
      <p>
        코치는 아직 당신을 잘 몰라요. 예상 역할은 <b>{roleOf(min)}</b>, 경기당 약 {Math.round(min)}분이에요. 훈련 초점을 정하고
        첫 시즌을 시작하세요.
      </p>
      <ul className="tips">
        <li>출전 시간이 많을수록 더 크게 성장해요. 성인이 된 뒤 벤치에만 있으면 잠재력이 줄어들 수 있어요.</li>
        <li>잠재력은 성장의 상한이에요. 스카우트 추정치는 나이가 들수록 정확해져요.</li>
        <li>건강이 낮으면 부상 위험이 커져요. 가끔은 회복 훈련을 고르세요.</li>
      </ul>
    </Panel>
  );
}

export function SeasonTab({ career: c }: { career: Career }) {
  return (
    <>
      {c.last ? <ResultCard r={c.last} /> : <Preseason career={c} />}
      <Panel title="소식">
        <ul className="news">
          {c.news.slice(0, 18).map((n, i) => (
            <li className={n.t} key={`${n.w}-${i}`}>
              <span className="dot" />
              <div>
                <div className="when">{n.w}</div>
                <div className="m">{n.m}</div>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
