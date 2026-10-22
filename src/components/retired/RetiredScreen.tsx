"use client";

import { AWARDS, fmtNum, money, titleHistory, type Career, type CareerSummary } from "@/game";
import { gameActions } from "@/lib/game-store";
import { NO_TEAM_COLOR, militaryShort } from "@/components/common/format";
import { RecordBoards } from "./RecordBoards";
import { SimilarPlayers } from "./SimilarPlayers";
import { HallOfFame } from "@/components/common/HallOfFame";
import { TeamBadge } from "@/components/common/TeamBadge";
import { CourtStage, Panel, StatTiles } from "@/components/common/ui";

export function RetiredScreen({ career: c, hall }: { career: Career; hall: CareerSummary[] }) {
  const s = c.summary;
  if (!s) return null;
  const p = c.p;
  const titles = titleHistory(c);
  const mil = militaryShort(c);
  const tiles: [string, string | number][] = [
    ["최고 오버롤", s.peak],
    ["NBA MVP", s.mvp],
    ["우승 반지", s.rings],
    ["개인상", s.personal],
    ["프로 시즌", s.seasons],
    ["통산 득점", fmtNum(s.pts)],
    ["통산 리바운드", fmtNum(s.reb)],
    ["통산 어시스트", fmtNum(s.ast)],
  ];
  return (
    <main className="ret">
      <CourtStage player={p} color={c.team?.color ?? NO_TEAM_COLOR}>
        {c.team && <TeamBadge className="plate-badge" name={c.team.name} kind={c.team.lg} color={c.team.color} size={52} />}
        <span className="label">
          {s.retYear}년 · {s.retAge}세 은퇴
        </span>
        <div className="name">
          {p.name} #{p.num}
        </div>
        <div className="legacy">{s.legacy}</div>
        <div className="sub">
          {p.pos} · {p.nat} · 누적 수입 {money(s.earn)} · 국가대표 {s.caps}경기
          {mil && ` · 병역 ${mil}`}
        </div>
      </CourtStage>

      <Panel title="커리어 요약">
        <StatTiles items={tiles} />
        <div className="awards">
          {AWARDS.filter(([k]) => c.awards[k]).map(([k, name]) => (
            <span className="aw" key={k}>
              {name} ×{c.awards[k]}
            </span>
          ))}
        </div>
        <p className="hint">거쳐간 팀 · {s.teams.join(" → ")}</p>
        {(s.academy || !!s.donated) && (
          <p className="hint">
            코트 밖에서 · {[s.academy && "유소년 농구 아카데미 설립", s.donated && `유소년 농구 기부 ${money(s.donated)}`].filter(Boolean).join(" · ")}
          </p>
        )}
      </Panel>

      <SimilarPlayers career={c} />

      <Panel title={`우승 기록 · ${titles.length}회`}>
        {titles.length ? (
          <ol className="titles">
            {titles.map((t, i) => (
              <li key={`${t.year}-${t.name}-${i}`} className="title-row" data-kind={t.kind}>
                <span className="ty">{t.year}</span>
                <TeamBadge name={t.team} size={30} />
                <span className="tb">
                  <b>{t.name}</b>
                  <span>
                    {t.team}
                    {t.league && ` · ${t.league}`}
                    {t.age !== null && ` · ${t.age}세`}
                  </span>
                </span>
                {t.fmvp && <span className="aw">파이널 MVP</span>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="hint">우승 경험 없이 커리어를 마쳤어요.</p>
        )}
        {!s.seasons && <p className="hint">프로 무대 기록이 없어 명예의 전당에는 오르지 않아요.</p>}
      </Panel>

      <RecordBoards career={c} />

      <div className="row">
        <button type="button" className="start" onClick={gameActions.newCareer}>
          새 커리어 시작
        </button>
      </div>

      <HallOfFame hall={hall} />
    </main>
  );
}
