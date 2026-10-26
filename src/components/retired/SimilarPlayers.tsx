import { LEAGUES, POS, careerProfile, namuWikiUrl, similarPlayers, type Career, type CompLeague } from "@/game";
import { Panel } from "@/components/common/ui";

const LEAGUE_ORDER: CompLeague[] = ["kbl", "nba"];

/** 은퇴 화면의 닮은 꼴 선수: KBL·NBA에서 내 커리어와 가장 비슷한 실제 선수 */
export function SimilarPlayers({ career: c }: { career: Career }) {
  const rows = LEAGUE_ORDER.map((lg) => ({ lg, matches: similarPlayers(c, lg), played: !!careerProfile(c, lg)?.played }));
  if (!rows.some((r) => r.matches.length))
    return (
      <Panel title="닮은 꼴 선수">
        <p className="hint">프로 무대 기록이 없어 닮은 꼴 선수를 찾지 못했어요.</p>
      </Panel>
    );

  return (
    <Panel title="닮은 꼴 선수">
      <div className="comps">
        {rows.map(({ lg, matches, played }) => {
          const [top, ...rest] = matches;
          if (!top) return null;
          const name = LEAGUES[lg].short;
          return (
            <article className="comp" key={lg}>
              <span className="label">{played ? `${name}에서` : `${name}로 치면`}</span>
              <div className="comp-head">
                <b className="comp-name">
                  {/* 이름을 누르면 그 선수의 나무위키 문서를 새 탭으로 열어요. */}
                  <a href={namuWikiUrl(top.player.name)} target="_blank" rel="noopener noreferrer" aria-label={`${top.player.name} 나무위키 문서 (새 탭)`}>
                    {top.player.name}
                    <span className="ext" aria-hidden="true">
                      ↗
                    </span>
                  </a>
                </b>
                <span className="comp-score">
                  닮은 정도 <b>{top.score}%</b>
                </span>
              </div>
              <span className="comp-pos">
                {top.player.pos} · {POS[top.player.pos].name}
              </span>
              <p className="comp-blurb">{top.player.blurb}</p>
              {top.reasons.length > 0 && (
                <div className="awards">
                  {top.reasons.map((r) => (
                    <span className="aw" key={r}>
                      {r}
                    </span>
                  ))}
                </div>
              )}
              {rest.length > 0 && <p className="hint">이런 선수와도 닮았어요 · {rest.map((m) => m.player.name).join(", ")}</p>}
            </article>
          );
        })}
      </div>
      <p className="hint">
        평균 기록, 프로 시즌 수, MVP·우승 횟수, 커리어 위상(최고 오버롤)을 실제 선수의 대략적인 커리어 성향과 비교했어요. 그 리그에서
        뛰지 않았으면 프로 커리어 전체로 견줘요.
      </p>
    </Panel>
  );
}
