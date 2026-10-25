import { LEAGUES, currentExpectedMinutes, militaryUnit, r1, roleOf, seasonProgress, type Career, type SeasonRecord, type SeasonRun } from "@/game";
import { TeamBadge } from "@/components/common/TeamBadge";
import { Panel } from "@/components/common/ui";
import { ContractPanel } from "../ContractPanel";
import { ShopPanel } from "../ShopPanel";

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
        <div className="rc-title">
          <TeamBadge name={r.team} size={40} />
          <div>
            <span className="label">
              {r.year} 시즌 · {r.team} · {r.lg ? LEAGUES[r.lg].short : "D리그"}
            </span>
            <h2 className="sec">
              {r.role} · {r.w}승 {r.l}패 · {r.result}
            </h2>
          </div>
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
        <>
          <span className="label">시즌 수상</span>
          <div className="awards">
            {r.awards.map((a, i) => (
              <span className="aw" key={`${a}-${i}`}>
                {a}
              </span>
            ))}
          </div>
        </>
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
        <li>출전 시간이 많을수록 더 크게 성장해요. 성인이 된 뒤 벤치에만 있으면 성장이 더뎌질 수 있어요.</li>
        <li>건강이 낮으면 부상 위험이 커져요. 가끔은 회복 훈련을 고르세요.</li>
      </ul>
    </Panel>
  );
}

/** 팀 없이 보내는 시즌(무소속·군 복무)의 일정 */
function RunPlan({ career: c, run }: { career: Career; run: SeasonRun }) {
  const title = c.stage === "military" ? militaryUnit(c.mil.kind).name : "무소속 · 개인 훈련";
  return (
    <Panel kicker={`${run.year} 시즌 진행 중`} title={title}>
      <ol className="plan">
        {run.plan.map((p, i) => (
          <li key={i} data-state={i < run.step ? "done" : i === run.step ? "now" : undefined}>
            {p}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

const formLabel = (f: number) => (f >= 0.3 ? "상승세" : f <= -0.3 ? "하락세" : null);

/** 진행 중인 팀 시즌: 지금까지의 평균 기록, 팀 성적, 플레이오프 라운드, 최근 경기 */
function RunCard({ career: c, run }: { career: Career; run: SeasonRun }) {
  const t = run.tot;
  const avg = (v: number) => (t.gp ? r1(v / t.gp) : "-");
  const stats: [string, number | string][] = [
    ["PTS", avg(t.pts)],
    ["REB", avg(t.reb)],
    ["AST", avg(t.ast)],
    ["STL", avg(t.stl)],
    ["BLK", avg(t.blk)],
    ["MIN", avg(t.min)],
  ];
  const team = c.team;
  const form = formLabel(run.form);
  return (
    <section className="panel">
      <div className="rc-head">
        <div className="rc-title">
          {team && <TeamBadge name={team.name} kind={team.lg} color={team.color} size={40} />}
          <div>
            <span className="label">
              {run.year} 시즌 · {team?.name} · {team ? LEAGUES[team.lg].short : ""}
            </span>
            <h2 className="sec">
              {seasonProgress(run).label} · {run.w}승 {run.l}패
            </h2>
          </div>
        </div>
        <div className="rating">
          <span className="label">평점</span>
          <b>{avg(t.rating)}</b>
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
          출전 <b>{t.gp}경기</b>
        </span>
        <span data-warn={c.health < 50 || undefined}>
          건강 <b>{Math.round(c.health)}</b>
          {c.health < 60 && " · 지쳐서 경기력이 떨어져요"}
        </span>
        {run.out > 0 && (
          <span>
            {run.outWhy} <b>{run.out}경기 결장 예정</b>
          </span>
        )}
        {form && (
          <span>
            경기력 <b>{form}</b>
          </span>
        )}
      </div>
      {run.shown > 0 && (
        <ul className="rounds">
          {run.post.slice(0, run.shown).map((r) => (
            <li key={r.name} data-win={r.win}>
              <span>{r.name}</span>
              <span className="gopp">
                <TeamBadge name={r.opp} color={r.color} size={18} />
                {r.opp}
              </span>
              <b>
                {r.score} {r.win ? "승" : "패"}
              </b>
            </li>
          ))}
        </ul>
      )}
      {run.log.length > 0 ? (
        <ol className="games" aria-label="최근 경기">
          {run.log.map((g) => (
            <li key={g.n} data-win={g.win}>
              <span className="gn">{g.n}</span>
              <span className="gwl">{g.win ? "승" : "패"}</span>
              <span className="gopp">
                <TeamBadge name={g.opp} size={18} />
                {g.opp}
                <small>
                  {g.us}-{g.them}
                </small>
                {g.clutch && <em className="gclutch">클러치</em>}
              </span>
              <span className="gme">{g.me ? `${g.me.pts}점 ${g.me.reb}리바 ${g.me.ast}어시 · ${g.me.rating}` : `결장 · ${g.out}`}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="hint">프리시즌 훈련 중이에요. 곧 개막전이에요.</p>
      )}
    </section>
  );
}

export function SeasonTab({ career: c }: { career: Career }) {
  const run = c.run;
  return (
    <>
      {run ? (
        run.plan.length ? (
          <RunPlan career={c} run={run} />
        ) : (
          <RunCard career={c} run={run} />
        )
      ) : c.last ? (
        <ResultCard r={c.last} />
      ) : (
        <Preseason career={c} />
      )}
      {!run && <ContractPanel career={c} />}
      <ShopPanel career={c} />
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
