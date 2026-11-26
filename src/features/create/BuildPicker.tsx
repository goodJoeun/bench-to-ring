"use client";

import { BUILDS, BUILD_KEYS, POS_BUILD, type PosKey } from "@/game";
import { draftBuild, gameActions, type CreationDraft } from "@/shared/store/game-store";
import { Sprite } from "@/shared/ui/sprite/Sprite";
import styles from "./create.module.css";

/**
 * 체형 고르기: 고른 캐릭터를 가드형·포워드형·빅맨형으로 나란히 그려 보여줘요. 처음에는 포지션에 어울리는 체형이 골라져 있고(추천),
 * 포지션을 바꾸면 그 포지션의 추천 체형으로 돌아가요. 그림에만 쓰고 능력치와는 상관없어요.
 */
export function BuildPicker({ draft, pos }: { draft: CreationDraft; pos: PosKey }) {
  const build = draftBuild(draft);
  return (
    <div className={styles.buildGrid} role="group" aria-label="체형">
      {BUILD_KEYS.map((b) => {
        const { name, desc } = BUILDS[b];
        return (
          <button key={b} type="button" aria-pressed={b === build} onClick={() => gameActions.chooseBuild(b)}>
            <Sprite look={{ ...draft.look, build: b }} color={draft.jersey} scale={4} className={styles.buildArt} label="" />
            <span className={styles.buildName}>
              {name}
              {POS_BUILD[pos] === b && <span className={styles.buildFit}>{pos} 추천</span>}
            </span>
            <span className={styles.buildDesc}>{desc}</span>
          </button>
        );
      })}
    </div>
  );
}
