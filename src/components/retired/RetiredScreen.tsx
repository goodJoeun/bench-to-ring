"use client";

import { useState } from "react";
import { awardGroups, fmtNum, money, titleHistory, type AwardCount, type Career, type CareerSummary } from "@/game";
import { gameActions } from "@/lib/game-store";
import { NO_TEAM_COLOR, militaryShort, nameFit } from "@/components/common/format";
import { RecordBoards } from "./RecordBoards";
import { SimilarPlayers } from "./SimilarPlayers";
import { ShareSheet } from "./ShareSheet";
import { HallOfFame } from "@/components/common/HallOfFame";
import { TeamBadge } from "@/components/common/TeamBadge";
import { AwardName, CourtStage, Panel, StatTiles } from "@/components/common/ui";

/** 커리어 요약의 수상: 팀·개인·국가대표 줄로 나눠, 리그·대회 이름별로 횟수를 보여줘요. 받은 게 없는 줄은 숨겨요. */
function AwardRows({ career: c }: { career: Career }) {
  const g = awardGroups(c);
  const rows: [string, AwardCount[]][] = [
    ["팀", g.team],
    ["개인", g.personal],
    ["국가대표", g.nat],
  ];
  if (!rows.some(([, list]) => list.length)) return null;
  return (
    <dl className="aw-rows">
      {rows
        .filter(([, list]) => list.length)
        .map(([label, list]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="awards">
              {list.map((a) => (
                <span className="aw" key={a.name}>
                  <AwardName name={a.name} after={a.count > 1 && ` ×${a.count}`} />
                </span>
              ))}
            </dd>
          </div>
        ))}
    </dl>
  );
}

/** past: 나의 기록에서 다시 연 지난 엔딩이에요. 새 커리어 대신 돌아가기 단추를 보여줘요. */
export function RetiredScreen({ career: c, hall, past = false }: { career: Career; hall: CareerSummary[]; past?: boolean }) {
  const [sharing, setSharing] = useState(false);
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
        <div className="name" style={nameFit(`${p.name} #${p.num}`)}>
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
        <AwardRows career={c} />
        <p className="hint">거쳐간 팀 · {s.teams.join(" → ")}</p>
        {(() => {
          // 예전 기록은 아카데미 여부만 있어요.
          const legacy = s.legacyItems ?? (s.academy ? ["유소년 농구 아카데미 설립"] : []);
          const parts = [...legacy, s.donated ? `유소년 농구 기부 ${money(s.donated)}` : ""].filter(Boolean);
          return parts.length > 0 && <p className="hint">코트 밖에서 · {parts.join(" · ")}</p>;
        })()}
        <div className="row share-row">
          <button type="button" className="btn" onClick={() => setSharing(true)}>
            기록 카드 공유
          </button>
          <span className="hint">이미지로 저장하거나 카카오톡 등으로 보내요</span>
        </div>
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
                    {t.league && ` · ${t.league}`}
                    {t.age !== null && ` · ${t.age}세`}
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

      <div className="end-bar">
        <button type="button" className="start sub" onClick={gameActions.openFarewell}>
          커리어 회고
        </button>
        {past ? (
          <button type="button" className="start" onClick={gameActions.closeEnding}>
            돌아가기
          </button>
        ) : (
          <button type="button" className="start" onClick={gameActions.newCareer}>
            새 커리어 시작
          </button>
        )}
      </div>

      <HallOfFame hall={hall} />
      {sharing && <ShareSheet career={c} onClose={() => setSharing(false)} />}
    </main>
  );
}
