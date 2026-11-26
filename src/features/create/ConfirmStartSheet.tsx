"use client";

import { BUILDS, POS, lookLabel, ovrOf } from "@/game";
import { draftBuild, draftStart, gameActions, type CreationDraft } from "@/shared/store/game-store";
import { Sheet } from "@/shared/ui/Sheet";
import styles from "./create.module.css";

export function ConfirmStartSheet({ draft, onClose }: { draft: CreationDraft; onClose: () => void }) {
  const { pos, nat, school, cand } = draftStart(draft);
  const ch = draft.challenge;
  if (!cand) return null;
  const name = draft.name.trim();
  return (
    <Sheet labelledBy="confirm-title" onClose={onClose}>
      <span className="sheet-kicker">{ch ? `오늘의 챌린지 ${ch.pos} 시작 확인` : "커리어 시작 확인"}</span>
      <h2 id="confirm-title">{name} 선수로 시작할까요?</h2>
      <p className="sheet-desc">
        {ch
          ? "오늘 이 포지션은 누구나 같은 선수로 시작해요. 프로 무대를 밟고 은퇴하면 선수 이름과 기록이 온라인 랭킹과 오늘의 챌린지 랭킹에 공개돼요. 내일까지 은퇴해야 챌린지 랭킹에 올라가요."
          : "시작하면 캐릭터, 국적, 포지션과 후보는 바꿀 수 없어요. 프로 무대를 밟고 은퇴하면 선수 이름과 기록이 온라인 랭킹에 공개돼요."}
      </p>
      <dl className={styles.confirmSum}>
        <div>
          <dt>캐릭터</dt>
          <dd>
            {lookLabel(draft.look) || "기본"} · {BUILDS[draftBuild(draft)].name}
          </dd>
        </div>
        <div>
          <dt>국적</dt>
          <dd>{nat}</dd>
        </div>
        <div>
          <dt>포지션</dt>
          <dd>
            {pos} {POS[pos].name}
          </dd>
        </div>
        <div>
          <dt>플레이 유형</dt>
          <dd>{cand.arch}</dd>
        </div>
        <div>
          <dt>등번호</dt>
          <dd>#{draft.num || 0}</dd>
        </div>
        <div>
          <dt>고등학교</dt>
          <dd>{school || "무작위 배정"}</dd>
        </div>
        <div>
          <dt>키 · 윙스팬</dt>
          <dd>
            {cand.h}cm · {cand.h + cand.wsd}cm
          </dd>
        </div>
        <div>
          <dt>오버롤</dt>
          <dd>{Math.round(ovrOf(cand.attrs, pos))}</dd>
        </div>
      </dl>
      <button type="button" className="sheet-go" onClick={gameActions.startCareer}>
        {ch ? "챌린지 시작" : "커리어 시작"}
      </button>
      <button type="button" className="sheet-later" onClick={onClose}>
        다시 고를게요
      </button>
    </Sheet>
  );
}
