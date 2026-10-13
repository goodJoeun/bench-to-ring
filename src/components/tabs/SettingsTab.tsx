"use client";

import { useMemo, useRef, useState } from "react";
import { canRetire, type Career } from "@/game";
import { encodeSave } from "@/game/storage";
import { gameActions } from "@/lib/game-store";
import { ImportForm } from "../ImportForm";

export function SettingsTab({ career }: { career: Career }) {
  const code = useMemo(() => encodeSave(career), [career]);
  const exportRef = useRef<HTMLTextAreaElement>(null);
  const [copyMsg, setCopyMsg] = useState("");
  const [confirm, setConfirm] = useState<"retire" | "new" | null>(null);

  const copy = () => {
    const selectAll = () => {
      exportRef.current?.focus();
      exportRef.current?.select();
      setCopyMsg("코드를 선택했어요. 직접 복사하세요.");
    };
    if (!navigator.clipboard) {
      selectAll();
      return;
    }
    navigator.clipboard.writeText(code).then(() => setCopyMsg("복사했어요."), selectAll);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `bench-to-ring-${career.p.name}-${career.year}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <section className="panel">
        <h2 className="sec">저장 코드 내보내기</h2>
        <p className="hint">진행 내용은 이 브라우저에 자동 저장돼요. 다른 기기로 옮기거나 백업하려면 코드를 복사하거나 파일로 받아 두세요.</p>
        <label className="sr-only" htmlFor="export-code">
          저장 코드
        </label>
        <textarea id="export-code" ref={exportRef} readOnly rows={4} value={code} />
        <div className="row">
          <button type="button" className="btn" onClick={copy}>
            코드 복사
          </button>
          <button type="button" className="btn" onClick={download}>
            파일로 저장
          </button>
          <span className="hint" role="status">
            {copyMsg}
          </span>
        </div>
      </section>

      <section className="panel">
        <h2 className="sec">저장 코드 불러오기</h2>
        <ImportForm placeholder="저장 코드를 붙여넣으세요. 지금 커리어는 덮어써져요." />
      </section>

      <section className="panel">
        <h2 className="sec">커리어 관리</h2>
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
      </section>
    </>
  );
}
