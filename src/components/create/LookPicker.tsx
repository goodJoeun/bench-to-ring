"use client";

import { lookLabel, type Look } from "@/game";
import { gameActions } from "@/lib/game-store";
import { Sprite } from "@/components/common/Sprite";

/**
 * 캐릭터 고르기. 피부색·머리 모양·머리색·눈동자·수염·헤어밴드를 무작위로 조합한 남성 캐릭터를 늘어놓고 하나를 골라요.
 * 유니폼 색도 칸마다 무작위예요(커리어에서는 소속팀 색을 입어요). 새로 뽑아도 고른 캐릭터는 맨 앞에 남아요.
 */
export function LookPicker({
  look,
  jersey,
  looks,
  jerseys,
}: {
  look: Look;
  jersey: string;
  looks: Look[];
  jerseys: string[];
}) {
  const chosen = JSON.stringify(look);
  return (
    <>
      <div className="look-grid" role="group" aria-label="캐릭터">
        {looks.map((l, i) => {
          const label = lookLabel(l);
          return (
            <button
              key={i}
              type="button"
              aria-pressed={
                JSON.stringify(l) === chosen && jerseys[i] === jersey
              }
              aria-label={label}
              title={label}
              onClick={() => gameActions.chooseLook(i)}
            >
              <Sprite
                look={l}
                color={jerseys[i]}
                scale={5}
                className="look-art"
                label=""
              />
            </button>
          );
        })}
      </div>
      <div className="flabel-row">
        <button type="button" className="btn" onClick={gameActions.rerollLooks}>
          다른 캐릭터 보기
        </button>
      </div>
    </>
  );
}
