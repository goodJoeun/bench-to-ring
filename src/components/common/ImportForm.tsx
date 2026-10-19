"use client";

import { useId, useState } from "react";
import { gameActions } from "@/lib/game-store";

export function ImportForm({ placeholder }: { placeholder: string }) {
  const id = useId();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  const submit = () => {
    if (!code.trim()) {
      setMessage("붙여넣은 코드가 없어요.");
      return;
    }
    if (!gameActions.importSave(code)) setMessage("코드를 읽지 못했어요. 처음부터 끝까지 빠짐없이 붙여넣었는지 확인하세요.");
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    file.text().then((t) => setCode(t.trim()));
  };

  return (
    <>
      <label className="sr-only" htmlFor={`${id}-code`}>
        저장 코드
      </label>
      <textarea id={`${id}-code`} rows={2} placeholder={placeholder} value={code} onChange={(e) => setCode(e.target.value)} />
      <div className="row">
        <button type="button" className="btn" onClick={submit}>
          불러오기
        </button>
        <label className="btn file">
          파일 선택
          <input type="file" accept=".txt,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <span className="hint" role="status">
          {message}
        </span>
      </div>
    </>
  );
}
