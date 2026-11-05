"use client";

import { natColor, playerLook, type Career, type Cheer } from "@/game";
import { gameActions } from "@/shared/store/game-store";
import { NO_TEAM_COLOR, keepTogether, nameFit } from "@/shared/lib/format";
import { useAutoFocus } from "@/shared/lib/hooks";
import { Sprite } from "@/shared/ui/sprite/Sprite";
import { AwardName } from "@/shared/ui/ui";
import { Popup } from "./Popup";

const KICKER: Record<Cheer["kind"], string> = {
  title: "우승",
  gold: "국가대표 금메달",
  nba: "꿈의 무대",
  mvp: "시즌 최고의 선수",
  fmvp: "파이널의 주인공",
  achv: "업적 달성",
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

/** 업적 달성 때 메달에서 퍼지는 별 조각: 방향(도), 날아가는 거리(px), 늦게 출발하는 정도(s) */
const SPARKS: [number, number, number][] = Array.from({ length: 12 }, (_, i) => [i * 30 + (i % 2) * 12, i % 3 === 0 ? 118 : i % 3 === 1 ? 96 : 132, (i % 4) * 0.05]);

/** 업적 달성의 메달: 번쩍임, 도는 빛줄기, 퍼지는 고리, 별 조각과 함께 찍히듯 나타나요. */
function AchievementMedal() {
  return (
    <div className="achv-medal-wrap" aria-hidden="true">
      <span className="achv-rays" />
      <span className="achv-ring" />
      <span className="achv-ring" style={{ animationDelay: "1s" }} />
      {SPARKS.map(([deg, dist, delay], i) => (
        <i key={i} className="achv-spark" style={{ "--a": `${deg}deg`, "--d": `${-dist}px`, animationDelay: `${0.2 + delay}s` } as React.CSSProperties} />
      ))}
      <svg className="achv-medal" viewBox="0 0 64 64">
        <polygon points="18,2 30,2 36,24 26,28" fill="#E0503A" />
        <polygon points="34,2 46,2 38,28 28,24" fill="#3D7BFF" />
        <circle cx="32" cy="40" r="20" fill="#FFD66B" stroke="#E2A93B" strokeWidth="3" />
        <circle cx="32" cy="40" r="14" fill="#F5B83D" />
        <polygon points="32,30 34.47,36.6 41.51,36.91 35.99,41.3 37.88,48.09 32,44.2 26.12,48.09 28.01,41.3 22.49,36.91 29.53,36.6" fill="#FFF7D6" />
      </svg>
    </div>
  );
}

/**
 * 축하 팝업: 우승, 국가대표 금메달, NBA 첫 입성, NBA MVP, 파이널 MVP, 업적 달성.
 * 업적 달성은 다른 축하와 한눈에 구별되게 보라 바탕에 메달·빛줄기·별 조각을 터뜨려요.
 * 한 번에 한 장씩, '계속'을 누르면 다음 축하로 넘어가요.
 */
export function CheerPopup({ career: c, cheer }: { career: Career; cheer: Cheer }) {
  const goRef = useAutoFocus<HTMLButtonElement>();
  const left = c.cheers.length - 1;
  const color = cheer.kind === "gold" ? natColor(c.p.nat) : (cheer.color ?? NO_TEAM_COLOR);
  const achv = cheer.kind === "achv";
  return (
    <Popup labelledBy="cheer-title" className={achv ? "cheer cheer-achv" : "cheer"} key={`${cheer.year}-${cheer.title}`}>
      {achv && <span className="achv-flash" aria-hidden="true" />}
      <div className="cheer-confetti" aria-hidden="true">
        {CONFETTI.map(([x, d, col], i) => (
          <i key={i} style={{ left: `${x}%`, animationDelay: `${d}s`, background: col }} />
        ))}
      </div>
      {achv ? (
        <>
          <AchievementMedal />
          <span className="achv-banner">업적 달성!</span>
          <span className="sim-team" style={nameFit(`${c.p.name} #${c.p.num}`)}>
            {c.p.name} #{c.p.num}
          </span>
        </>
      ) : (
        <>
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
        </>
      )}
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
