"use client";

import { POS, ovrOf } from "@/game";
import { gameActions, type CreationDraft } from "@/lib/game-store";
import { Sheet } from "@/components/common/Sheet";
import { PATHS } from "./options";

export function ConfirmStartSheet({ draft, onClose }: { draft: CreationDraft; onClose: () => void }) {
  const cand = draft.candidates[draft.selected];
  if (!cand) return null;
  const name = draft.name.trim() || "무명의 루키";
  const path = PATHS.find((p) => p.key === draft.path);
  return (
    <Sheet labelledBy="confirm-title" onClose={onClose}>
      <span className="sheet-kicker">커리어 시작 확인</span>
      <h2 id="confirm-title">{name} 선수로 시작할까요?</h2>
      <p className="sheet-desc">시작하면 포지션과 후보는 바꿀 수 없어요.</p>
      <dl className="confirm-sum">
        <div>
          <dt>포지션</dt>
          <dd>
            {draft.pos} {POS[draft.pos].name}
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
          <dd>{draft.school || "무작위 배정"}</dd>
        </div>
        <div>
          <dt>커리어 경로</dt>
          <dd>{path?.big}</dd>
        </div>
        <div>
          <dt>키 · 윙스팬</dt>
          <dd>
            {cand.h}cm · {cand.h + cand.wsd}cm
          </dd>
        </div>
        <div>
          <dt>오버롤 · 스카우트 등급</dt>
          <dd>
            {Math.round(ovrOf(cand.attrs, draft.pos))} · {cand.grade}
          </dd>
        </div>
      </dl>
      <button type="button" className="sheet-go" onClick={gameActions.startCareer}>
        커리어 시작
      </button>
      <button type="button" className="sheet-later" onClick={onClose}>
        다시 고를게요
      </button>
    </Sheet>
  );
}
