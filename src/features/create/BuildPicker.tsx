"use client";

import { useId } from "react";
import { BUILDS, BUILD_KEYS, POS, POS_BUILD, POS_BULK, buildOfBulk, type PosKey } from "@/game";
import { draftBulk, gameActions, type CreationDraft } from "@/shared/store/game-store";
import { Sprite } from "@/shared/ui/sprite/Sprite";
import styles from "./create.module.css";

/**
 * 체형 고르기: 막대를 밀어 포지션의 체형 범위(POS_BULK) 안에서 정하고, 왼쪽 미리보기가 바로 바뀌어요.
 * 막대 양 끝이 그 포지션에서 고를 수 있는 가장 날렵한·두꺼운 체형이에요. 가드형·포워드형·빅맨형 단추는 그 체형의 대표 값으로
 * 막대를 옮기고, 범위 밖인 체형은 누를 수 없어요. 처음에는 포지션에 어울리는 체형(추천)이고, 포지션을 바꾸면 그 추천으로 돌아가요.
 * 그림에만 쓰고 능력치와는 상관없어요.
 */
export function BuildPicker({ draft, pos }: { draft: CreationDraft; pos: PosKey }) {
  const id = useId();
  const bulk = draftBulk(draft);
  const [lo, hi] = POS_BULK[pos];
  const { name } = BUILDS[buildOfBulk(bulk)];
  return (
    <div className={styles.build}>
      <Sprite look={{ ...draft.look, bulk }} color={draft.jersey} scale={5} className={styles.buildArt} label={`${name} 체형 미리보기`} />
      <div className={styles.buildControls}>
        <label className={styles.buildHead} htmlFor={id}>
          <span className="label">체형</span>
          <b>{name}</b>
          <span className={styles.buildNum}>{bulk}</span>
        </label>
        <input
          id={id}
          className={styles.buildRange}
          type="range"
          min={lo}
          max={hi}
          step={1}
          value={bulk}
          list={`${id}-ticks`}
          aria-valuetext={`${name} ${bulk}`}
          aria-describedby={`${id}-range`}
          onChange={(e) => gameActions.chooseBulk(Number(e.target.value))}
        />
        <datalist id={`${id}-ticks`}>
          {BUILD_KEYS.filter((b) => BUILDS[b].bulk >= lo && BUILDS[b].bulk <= hi).map((b) => (
            <option key={b} value={BUILDS[b].bulk} />
          ))}
        </datalist>
        <div className={styles.buildEnds} aria-hidden="true">
          <span>날렵하게 {lo}</span>
          <span>두껍게 {hi}</span>
        </div>
        <div className={styles.buildPresets} role="group" aria-label="체형 바로 고르기">
          {BUILD_KEYS.map((b) => {
            const v = BUILDS[b].bulk;
            const out = v < lo || v > hi;
            return (
              <button
                key={b}
                type="button"
                aria-pressed={bulk === v}
                disabled={out}
                title={out ? `${POS[pos].name}에게는 어울리지 않는 체형이에요` : undefined}
                onClick={() => gameActions.chooseBulk(v)}
              >
                {BUILDS[b].name}
                {POS_BUILD[pos] === b && <span className={styles.buildFit}>{pos} 추천</span>}
              </button>
            );
          })}
        </div>
        <p id={`${id}-range`} className={styles.buildRangeNote}>
          {POS[pos].name}는 체형 {lo}~{hi} 사이에서 고를 수 있어요.
        </p>
      </div>
    </div>
  );
}
