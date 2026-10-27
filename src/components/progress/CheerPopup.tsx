"use client";

import { natColor, playerLook, type Career, type Cheer } from "@/game";
import { gameActions } from "@/lib/game-store";
import { NO_TEAM_COLOR, keepTogether, nameFit } from "@/components/common/format";
import { useAutoFocus } from "@/components/common/hooks";
import { Sprite } from "@/components/common/Sprite";
import { AwardName } from "@/components/common/ui";
import { Popup } from "./Popup";

const KICKER: Record<Cheer["kind"], string> = {
  title: "우승",
  gold: "국가대표 금메달",
  nba: "꿈의 무대",
  mvp: "시즌 최고의 선수",
  fmvp: "파이널의 주인공",
};

/** 꽃가루 조각: 가로 위치(%), 늦게 떨어지는 정도(s), 색 */
const CONFETTI: [number, number, string][] = [
  [6, 0, "#FFD66B"],
  [14, 0.5, "#FF8A65"],
  [23, 0.2, "#8FE3A8"],
  [31, 0.8, "#FFFFFF"],
  [40, 0.35, "#FFD66B"],
  [49, 0.65, "#A9C7FF"],
  [58, 0.1, "#FF8A65"],
  [66, 0.9, "#FFD66B"],
  [74, 0.45, "#8FE3A8"],
  [82, 0.15, "#FFFFFF"],
  [90, 0.7, "#A9C7FF"],
  [96, 0.3, "#FFD66B"],
];

/**
 * 축하 팝업: 우승, 국가대표 금메달, NBA 첫 입성, NBA MVP, 파이널 MVP.
 * 한 번에 한 장씩, '계속'을 누르면 다음 축하로 넘어가요.
 */
export function CheerPopup({ career: c, cheer }: { career: Career; cheer: Cheer }) {
  const goRef = useAutoFocus<HTMLButtonElement>();
  const left = c.cheers.length - 1;
  const color = cheer.kind === "gold" ? natColor(c.p.nat) : (cheer.color ?? NO_TEAM_COLOR);
  return (
    <Popup labelledBy="cheer-title" className="cheer" key={`${cheer.year}-${cheer.title}`}>
      <div className="cheer-confetti" aria-hidden="true">
        {CONFETTI.map(([x, d, col], i) => (
          <i key={i} style={{ left: `${x}%`, animationDelay: `${d}s`, background: col }} />
        ))}
      </div>
      <svg className="cheer-trophy" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4h10v2h3v3a4 4 0 0 1-4 4h-.4A5 5 0 0 1 13 15.9V18h3v2H8v-2h3v-2.1A5 5 0 0 1 8.4 13H8a4 4 0 0 1-4-4V6h3zm0 4H6v1a2 2 0 0 0 1 1.7zm10 0v2.7A2 2 0 0 0 18 9V8z" />
      </svg>
      <div className="sim-court cheer-court" aria-hidden="true">
        <Sprite look={playerLook(c.p)} color={color} label="" className="sprite sim-sprite" />
        <span className="sim-shadow" />
      </div>
      <span className="sim-team" style={nameFit(`${KICKER[cheer.kind]} · ${c.p.name} #${c.p.num}`)}>
        {KICKER[cheer.kind]} · {c.p.name} #{c.p.num}
      </span>
      <h2 id="cheer-title" className="cheer-title">
        <AwardName name={cheer.title} />
      </h2>
      <p className="sim-phase">{keepTogether(cheer.sub)}</p>
      <button type="button" ref={goRef} className="live-go" onClick={() => gameActions.dismissCheer()}>
        {left > 0 ? `계속 · 축하 ${left}개 더` : "계속"}
      </button>
    </Popup>
  );
}
