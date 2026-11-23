"use client";

import { fmtNum, type CareerSummary } from "@/game";
import type { BoardEntry } from "@/shared/leaderboard/types";
import { Sheet } from "./Sheet";
import { Sprite } from "./sprite/Sprite";
import { jerseyOf, lookOf } from "./sprite/look";

/** 커리어 카드에 보여주는 값. 순위표 한 줄에 이미 들어 있어서 따로 불러오지 않아요. 랭킹 점수는 보여주지 않아요. */
export type CareerCard = Pick<
  BoardEntry,
  "id" | "name" | "num" | "pos" | "mvp" | "fmvp" | "leagueMvp" | "peak" | "personal" | "pts" | "reb" | "ast" | "rings" | "seasons" | "legacy" | "team" | "look"
>;

/** 이 브라우저에 남은 은퇴 기록을 커리어 카드 값으로 바꿔요. */
export const cardFromSummary = (s: CareerSummary): CareerCard => ({
  id: s.id,
  name: s.name,
  num: s.num,
  pos: s.pos,
  mvp: s.mvp,
  fmvp: s.awards.fmvp ?? 0,
  leagueMvp: s.awards.mvp ?? 0,
  peak: s.peak,
  personal: s.personal,
  pts: s.pts,
  reb: s.reb,
  ast: s.ast,
  rings: s.rings,
  seasons: s.seasons,
  legacy: s.legacy,
  team: s.teams.at(-1) ?? null,
  look: s.look ?? null,
});

interface CareerCardSheetProps {
  career: CareerCard;
  /** 맨 위 작은 줄에 쓰는 순위. 예: "올타임 전체 12위 · PG 3위" */
  ranks: string;
  mine?: boolean;
  onClose: () => void;
}

/** 순위표에서 선수를 누르면 올라오는 커리어 카드 */
export function CareerCardSheet({ career: e, ranks, mine = false, onClose }: CareerCardSheetProps) {
  const stats: [string, string][] = [
    ["시즌", fmtNum(e.seasons)],
    ["최고 OVR", String(e.peak)],
    ["통산 득점", fmtNum(e.pts)],
    ["통산 리바운드", fmtNum(e.reb)],
    ["통산 어시스트", fmtNum(e.ast)],
    ["개인상", fmtNum(e.personal)],
  ];
  const awards = (
    [
      ["NBA MVP", e.mvp],
      ["파이널 MVP", e.fmvp],
      ["리그 MVP", e.leagueMvp],
      ["우승 반지", e.rings],
    ] as const
  ).filter(([, n]) => n > 0);
  return (
    <Sheet labelledBy="career-card-title" onClose={onClose}>
      <div className="cc-head">
        <Sprite look={lookOf(e.id, e.look)} color={jerseyOf(e.team)} scale={4} className="cc-sprite" label={`${e.name} 캐릭터`} />
        <div className="cc-who">
          <span className="sheet-kicker">{ranks}</span>
          <h2 id="career-card-title">
            {e.name} <span className="cc-num">#{e.num}</span>
            {mine && <span className="me">나</span>}
          </h2>
          <span className="cc-sub">
            {e.pos}
            {e.team && ` · ${e.team}`}
          </span>
        </div>
      </div>
      <p className="cc-legacy">{e.legacy}</p>
      <dl className="cc-stats">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {awards.length > 0 && (
        <ul className="cc-awards" aria-label="큰 상">
          {awards.map(([k, n]) => (
            <li key={k}>
              {k} <b>{n}</b>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="sheet-go" onClick={onClose}>
        닫기
      </button>
    </Sheet>
  );
}
