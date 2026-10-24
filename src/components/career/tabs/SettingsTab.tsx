"use client";

import { useState } from "react";
import { canRetire, type Career } from "@/game";
import { gameActions } from "@/lib/game-store";
import { Panel } from "@/components/common/ui";

export function SettingsTab({ career }: { career: Career }) {
  const [confirm, setConfirm] = useState<"retire" | "new" | null>(null);

  return (
    <Panel title="커리어 관리">
      <div className="row">
        {canRetire(career) ? (
          <button
            type="button"
            className="btn warn"
            onClick={() => (confirm === "retire" ? gameActions.retire() : setConfirm("retire"))}
          >
            {confirm === "retire" ? "한 번 더 누르면 은퇴해요" : "은퇴 선언"}
          </button>
        ) : (
          <span className="hint">은퇴는 30세부터 프로나 무소속 상태에서 선언할 수 있어요.</span>
        )}
        <button
          type="button"
          className="btn danger"
          onClick={() => (confirm === "new" ? gameActions.newCareer() : setConfirm("new"))}
        >
          {confirm === "new" ? "한 번 더 누르면 지금 커리어가 지워져요" : "새 커리어 시작"}
        </button>
      </div>
    </Panel>
  );
}
