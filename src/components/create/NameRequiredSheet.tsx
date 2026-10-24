"use client";

import { Sheet } from "@/components/common/Sheet";

/** 이름 없이 시작을 누르면 띄워요. '이름 짓기'를 누르면 이름 칸으로 가요. */
export function NameRequiredSheet({ onClose, onName }: { onClose: () => void; onName: () => void }) {
  return (
    <Sheet labelledBy="name-title" onClose={onClose}>
      <span className="sheet-kicker">선수 이름</span>
      <h2 id="name-title">선수 이름을 지어 주세요</h2>
      <p className="sheet-desc">이름을 지어야 커리어를 시작할 수 있어요. 은퇴하면 이 이름으로 온라인 랭킹에 올라가요. 12자까지 쓸 수 있어요.</p>
      <button type="button" className="sheet-go" onClick={onName}>
        이름 짓기
      </button>
    </Sheet>
  );
}
