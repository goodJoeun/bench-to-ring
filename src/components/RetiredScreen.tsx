"use client";

import { AWARDS, money, type Career, type CareerSummary } from "@/game";
import { gameActions } from "@/lib/game-store";
import { Sprite } from "./Sprite";
import { HallOfFame } from "./tabs/HallOfFame";

export function RetiredScreen({ career: c, hall }: { career: Career; hall: CareerSummary[] }) {
  const s = c.summary;
  if (!s) return null;
  const p = c.p;
  const color = c.team?.color ?? "#5A6577";
  const tiles: [string, string | number][] = [
    ["최고 오버롤", s.peak],
    ["GBL MVP", s.mvp],
    ["우승 반지", s.rings],
    ["개인상", s.personal],
    ["프로 시즌", s.seasons],
    ["통산 득점", s.pts.toLocaleString("ko-KR")],
    ["통산 리바운드", s.reb.toLocaleString("ko-KR")],
    ["통산 어시스트", s.ast.toLocaleString("ko-KR")],
  ];
  return (
    <main className="ret">
      <section className="court" style={{ "--team": color } as React.CSSProperties}>
        <div className="key" aria-hidden="true" />
        <Sprite skin={p.skin} hair={p.hair} color={color} label={`${p.name} 도트 캐릭터`} />
        <div className="plate">
          <span className="label">
            {s.retYear}년 · {s.retAge}세 은퇴
          </span>
          <div className="name">
            {p.name} #{p.num}
          </div>
          <div className="legacy">{s.legacy}</div>
          <div className="sub">
            {p.pos} · {p.nat} · 누적 수입 {money(s.earn)} · 국가대표 {s.caps}경기
          </div>
        </div>
      </section>

      <section className="panel">
        <h2 className="sec">커리어 요약</h2>
        <div className="tiles">
          {tiles.map(([k, v]) => (
            <div className="tile" key={k}>
              <span className="label">{k}</span>
              <span className="n">{v}</span>
            </div>
          ))}
        </div>
        <div className="awards">
          {AWARDS.filter(([k]) => c.awards[k]).map(([k, name]) => (
            <span className="aw" key={k}>
              {name} ×{c.awards[k]}
            </span>
          ))}
        </div>
        <p className="hint">거쳐간 팀 · {s.teams.join(" → ")}</p>
        {!s.seasons && <p className="hint">프로 무대 기록이 없어 명예의 전당에는 오르지 않아요.</p>}
      </section>

      <div className="row">
        <button type="button" className="start" onClick={gameActions.newCareer}>
          새 커리어 시작
        </button>
      </div>

      <HallOfFame hall={hall} />
    </main>
  );
}
