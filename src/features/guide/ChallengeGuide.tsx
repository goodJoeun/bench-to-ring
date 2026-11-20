"use client";

import { Sheet } from "@/shared/ui/Sheet";

/* 챌린지 모드 도움말. 첫 화면의 오늘의 챌린지 카드와 랭킹의 챌린지 탭에서 열어요. */

/** 도전하는 순서 */
const STEPS = [
  "첫 화면 '오늘의 챌린지'에서 포지션을 골라요.",
  "캐릭터와 이름, 등번호를 정하고 시작해요.",
  "평소처럼 커리어를 진행해 은퇴해요.",
  "랭킹의 '챌린지' 탭에서 순위를 확인해요.",
];

const CARDS: [string, string][] = [
  [
    "같은 선수",
    "매일 0시(한국 시간)에 포지션마다 선수가 한 명씩 정해져요. 플레이 유형·능력치·키·잠재력·숨겨진 특성과 국적·고등학교가 누구에게나 같아요.",
  ],
  ["달라지는 것", "시작한 뒤는 일반 모드와 같아요. 시즌 결과와 이벤트는 사람마다 다르게 펼쳐지니, 훈련·진로·결정으로 차이를 만들어요."],
  ["챌린지 랭킹", "그날 그 포지션 기록끼리만 순위를 매겨요. 프로 무대를 밟고 은퇴하면 올라가고, 순위 기준은 일반 랭킹과 같아요."],
  ["다시 도전", "몇 번이든 다시 도전할 수 있어요. 가장 좋은 기록 하나만 순위에 들어가요."],
  ["마감", "시작한 날과 그다음 날(한국 시간)까지 은퇴해야 챌린지 순위에 들어가요. 늦으면 일반 랭킹에만 올라가요."],
  ["일반 랭킹", "챌린지 기록은 일반 랭킹과 명예의 전당에도 함께 올라가요."],
];

export function ChallengeGuide({ onClose }: { onClose: () => void }) {
  return (
    <Sheet labelledBy="ch-guide-title" onClose={onClose}>
      <span className="sheet-kicker">챌린지 모드</span>
      <h2 id="ch-guide-title">누구나 같은 선수로 겨뤄요</h2>
      <p className="sheet-desc">
        일반 모드는 선수를 직접 고르지만, 챌린지는 오늘 정해진 선수로 누구나 똑같이 시작해요. 같은 조건에서 누가 더 잘 키우는지 겨뤄요.
      </p>
      <ol className="ch-steps">
        {STEPS.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <ul className="gd">
        {CARDS.map(([title, text]) => (
          <li key={title} data-wide>
            <b>{title}</b>
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="sheet-go" onClick={onClose}>
        확인
      </button>
    </Sheet>
  );
}
