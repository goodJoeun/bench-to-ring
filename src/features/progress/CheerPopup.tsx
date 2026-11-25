"use client";

import { LEAGUES, natColor, playerLook, type Career, type Cheer } from "@/game";
import { gameActions } from "@/shared/store/game-store";
import { NO_TEAM_COLOR, keepTogether, nameFit } from "@/shared/lib/format";
import { useAutoFocus } from "@/shared/lib/hooks";
import { LeagueLogo, hasLeagueLogo } from "@/shared/ui/badge/LeagueLogo";
import { Medal } from "@/shared/ui/badge/Medal";
import { Sprite } from "@/shared/ui/sprite/Sprite";
import { AwardName } from "@/shared/ui/ui";
import { CeremonyArt, hasCeremony } from "./CeremonyArt";
import { ChampionRing } from "./ChampionRing";
import { Popup } from "./Popup";
import { SigningArt } from "./SigningArt";
import styles from "./progress.module.css";

const KICKER: Record<Cheer["kind"], string> = {
  title: "우승",
  gold: "국가대표 금메달",
  nba: "꿈의 무대",
  mvp: "시즌 최고의 선수",
  fmvp: "파이널의 주인공",
  achv: "업적 달성",
  sign: "입단 기자회견",
};

const TROPHY = "M7 4h10v2h3v3a4 4 0 0 1-4 4h-.4A5 5 0 0 1 13 15.9V18h3v2H8v-2h3v-2.1A5 5 0 0 1 8.4 13H8a4 4 0 0 1-4-4V6h3zm0 4H6v1a2 2 0 0 0 1 1.7zm10 0v2.7A2 2 0 0 0 18 9V8z";

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
      <span className={styles.achvRays} />
      <span className={styles.achvRing} />
      <span className={styles.achvRing} style={{ animationDelay: "1s" }} />
      {SPARKS.map(([deg, dist, delay], i) => (
        <i key={i} className={styles.achvSpark} style={{ "--a": `${deg}deg`, "--d": `${-dist}px`, animationDelay: `${0.2 + delay}s` } as React.CSSProperties} />
      ))}
      <Medal className={styles.achvMedal} />
    </div>
  );
}

/**
 * 축하 팝업: 우승, 국가대표 금메달, NBA 첫 입성, NBA MVP, 파이널 MVP, 업적 달성.
 * 리그 우승은 금테 두른 판의 리그 로고 옆에 프로는 우승 반지, 고교·대학은 트로피를 보여주고,
 * 그 아래에 동료들과 우승컵을 들어 올리는 세레모니 그림(CeremonyArt)을 띄워요.
 * 시즌 MVP·파이널 MVP는 시상자에게 그 상의 트로피를 받아 들어 올리는 그림을 띄워요. 다른 축하는 선수 캐릭터 혼자 서요.
 * 업적 달성은 다른 축하와 한눈에 구별되게 보라 바탕에 메달·빛줄기·별 조각을 터뜨려요.
 * 다른 팀에 입단(이적)하면 꽃가루 대신 입단 기자회견 그림(로고 배경판 앞 악수와 카메라 플래시)을 보여줘요.
 * 한 번에 한 장씩, '계속'을 누르면 다음 축하로 넘어가요.
 */
export function CheerPopup({ career: c, cheer }: { career: Career; cheer: Cheer }) {
  const goRef = useAutoFocus<HTMLButtonElement>();
  const left = c.cheers.length - 1;
  const color = cheer.kind === "gold" ? natColor(c.p.nat) : (cheer.color ?? NO_TEAM_COLOR);
  const achv = cheer.kind === "achv";
  const sign = cheer.kind === "sign";
  // 리그 우승이면 트로피 자리에 그 리그 로고를 올려요. 예전 저장의 축하처럼 리그를 모르면 트로피예요.
  const league = cheer.kind === "title" && hasLeagueLogo(cheer.lg) ? cheer.lg : null;
  const award = cheer.kind === "mvp" || cheer.kind === "fmvp";
  return (
    <Popup labelledBy="cheer-title" className={achv ? `cheer ${styles.cheerAchv}` : sign ? `cheer ${styles.cheerSign}` : "cheer"} key={`${cheer.year}-${cheer.title}`}>
      {achv && <span className="achv-flash" aria-hidden="true" />}
      {!sign && (
        <div className="cheer-confetti" aria-hidden="true">
          {CONFETTI.map(([x, d, col], i) => (
            <i key={i} style={{ left: `${x}%`, animationDelay: `${d}s`, background: col }} />
          ))}
        </div>
      )}
      {sign ? (
        <>
          <SigningArt career={c} cheer={cheer} />
          <span className="sim-team" style={nameFit(`${KICKER.sign} · ${c.p.name} #${c.p.num}`)}>
            {KICKER.sign} · {c.p.name} #{c.p.num}
          </span>
        </>
      ) : achv ? (
        <>
          <AchievementMedal />
          <span className={styles.achvBanner}>업적 달성!</span>
          <span className="sim-team" style={nameFit(`${c.p.name} #${c.p.num}`)}>
            {c.p.name} #{c.p.num}
          </span>
        </>
      ) : (
        <>
          {league ? (
            <div className="cheer-league">
              <div className={styles.cheerLeaguePlate}>
                <LeagueLogo lg={league} />
              </div>
              {/* 우승 반지는 프로 우승만 세니까 프로 리그에만 보여주고, 고교·대학은 트로피예요. */}
              {LEAGUES[league].pro ? (
                <ChampionRing color={color} year={cheer.year} />
              ) : (
                <svg className="cheer-trophy" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={TROPHY} />
                </svg>
              )}
            </div>
          ) : (
            // MVP·파이널 MVP는 아래 그림에서 그 상의 트로피를 받으니 트로피 그림을 따로 올리지 않아요.
            !award && (
              <svg className="cheer-trophy" viewBox="0 0 24 24" aria-hidden="true">
                <path d={TROPHY} />
              </svg>
            )
          )}
          {hasCeremony(cheer) ? (
            <CeremonyArt career={c} cheer={cheer} color={color} />
          ) : (
            <div className={`sim-court ${styles.cheerCourt}`} aria-hidden="true">
              <Sprite look={playerLook(c.p)} color={color} label="" className={`sprite ${styles.simSprite}`} />
              <span className={styles.simShadow} />
            </div>
          )}
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
