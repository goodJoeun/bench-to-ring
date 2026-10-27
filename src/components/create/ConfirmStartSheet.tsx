"use client";

import { POS, lookLabel, ovrOf } from "@/game";
import { gameActions, type CreationDraft } from "@/lib/game-store";
import { Sheet } from "@/components/common/Sheet";

export function ConfirmStartSheet({ draft, onClose }: { draft: CreationDraft; onClose: () => void }) {
  const cand = draft.candidates[draft.selected];
  if (!cand) return null;
  const name = draft.name.trim();
  return (
    <Sheet labelledBy="confirm-title" onClose={onClose}>
      <span className="sheet-kicker">커리어 시작 확인</span>
      <h2 id="confirm-title">{name} 선수로 시작할까요?</h2>
      <p className="sheet-desc">
        시작하면 캐릭터, 국적, 포지션과 후보는 바꿀 수 없어요. 프로 무대를 밟고 은퇴하면 선수 이름과 기록이 온라인 랭킹에 공개돼요.
      </p>
      <dl className="confirm-sum">
        <div>
          <dt>캐릭터</dt>
          <dd>{lookLabel(draft.look) || "기본"}</dd>
        </div>
        <div>
          <dt>국적</dt>
          <dd>{draft.nat}</dd>
        </div>
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
          <dt>키 · 윙스팬</dt>
          <dd>
            {cand.h}cm · {cand.h + cand.wsd}cm
          </dd>
        </div>
        <div>
          <dt>오버롤</dt>
          <dd>{Math.round(ovrOf(cand.attrs, draft.pos))}</dd>
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
