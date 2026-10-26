"use client";

import { ENLIST_DEADLINE, INVEST_SLOTS, LEAGUES, type LeagueKey } from "@/game";
import { Sheet } from "@/components/common/Sheet";

/* 플레이 가이드: 꼭 알아야 할 것만 카드 여덟 장으로. 오버롤 수치는 보여주지 않아요. */

/** 두 칸을 다 쓰는 카드 */
const WIDE = ["목표", "성장", "진로", "이벤트"];

/** 수준이 낮은 리그부터 */
const LEAGUE_ORDER: LeagueKey[] = ["hs", "kuniv", "kbl", "ncaa", "gleague", "euro", "nba"];

export function GuideDialog({ onClose }: { onClose: () => void }) {
  const cards: [string, React.ReactNode][] = [
    ["목표", "고교 벤치에서 MVP와 우승 반지까지. 시즌 계획 → 진행 → 오프시즌 결정을 반복해요."],
    [
      "성장",
      "출전 시간이 가장 중요해요. 훈련 초점으로 고른 능력치는 집중적으로 훈련해 더 빨리 커요. 10대 후반에 가장 빨리 크고 20대 중반에도 조금씩 크다가 28세 무렵 전성기를 맞고, 30세부터는 운동능력부터 떨어지기 시작해요.",
    ],
    ["건강", "60 아래면 경기력이, 30 아래면 큰 부상 위험이 커져요."],
    ["국가대표", "실력이 오르면 뽑혀요. 대회마다 합류·불참을 골라요."],
    [
      "진로",
      <>
        리그 수준에 가까운 실력이어야 제안이 와요.
        <span className="gd-leagues">{LEAGUE_ORDER.map((k) => LEAGUES[k].short).join(" → ")}</span>
      </>,
    ],
    ["병역", `23~${ENLIST_DEADLINE}세에 상무나 현역으로 가요. 아시안게임 금·올림픽 메달이면 병역 특례를 받아요.`],
    ["돈", `시즌 투자(${INVEST_SLOTS}개)와 상점으로 성장·건강을 챙겨요.`],
    [
      "이벤트",
      "시즌 중과 오프시즌에 선택지가 나와요. 선택지마다 효과가 미리 보이고, '도전'은 운에 따라 크게 얻거나 잃어요. 결과는 능력치·건강·돈·코치 신뢰나 남은 경기력에 반영되고, 에이전시·전담 트레이너는 커리어 내내 남아요.",
    ],
  ];
  return (
    <Sheet labelledBy="guide-title" onClose={onClose}>
      <span className="sheet-kicker">플레이 가이드</span>
      <h2 id="guide-title">이것만 알면 돼요</h2>
      <ul className="gd">
        {cards.map(([title, text]) => (
          <li key={title} data-wide={WIDE.includes(title) || undefined}>
            <b>{title}</b>
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <p className="gd-foot">30세부터 은퇴할 수 있고, 프로 경력이 있으면 명예의 전당에 올라요. 진행은 자동 저장돼요.</p>
      <button type="button" className="sheet-go" onClick={onClose}>
        확인
      </button>
    </Sheet>
  );
}
