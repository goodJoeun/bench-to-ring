"use client";

import type { CareerSummary } from "@/game";
import { gameActions } from "@/shared/store/game-store";
import { Sheet } from "./Sheet";

/**
 * 은퇴 선수 기록 지우기 확인. 첫 화면의 '내 은퇴 선수'와 랭킹의 '나의 기록'이 함께 써요.
 * 같은 이름의 선수가 여럿이어도 헷갈리지 않게 포지션·최고 오버롤·은퇴 연도를 함께 보여줘요.
 */
export function DeleteRecordSheet({ career: s, onClose }: { career: CareerSummary; onClose: () => void }) {
  const remove = () => {
    gameActions.deleteRecord(s.id);
    onClose();
  };
  return (
    <Sheet labelledBy="del-title" onClose={onClose}>
      <span className="sheet-kicker">선수 기록 지우기</span>
      <h2 id="del-title">
        {s.name} #{s.num} 기록을 지울까요?
      </h2>
      <p className="del-who">
        {s.pos} · OVR {s.peak} · {s.legacy} · {s.retYear}년 은퇴
      </p>
      <p className="sheet-desc">
        이 브라우저의 은퇴 기록과 엔딩, 온라인 랭킹에 올라간 기록이 함께 지워져요. 지운 기록은 되돌릴 수 없어요. 딴 업적과 누적 기록은 그대로 남아요.
      </p>
      <button type="button" className="sheet-go danger" onClick={remove}>
        기록 지우기
      </button>
      <button type="button" className="sheet-later" onClick={onClose} data-autofocus>
        그냥 둘게요
      </button>
    </Sheet>
  );
}

/** 목록 줄 끝의 작은 지우기 단추 (휴지통) */
export function DeleteRecordButton({ career: s, onClick }: { career: CareerSummary; onClick: () => void }) {
  return (
    <button type="button" className="btn rk-del" onClick={onClick} aria-label={`${s.name} #${s.num} 기록 지우기`} title="기록 지우기">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9zm4 2v8h2v-8h-2zm4 0v8h2v-8h-2z" />
      </svg>
    </button>
  );
}
