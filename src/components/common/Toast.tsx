"use client";

import { useEffect } from "react";
import { gameActions, type Toast as ToastData } from "@/lib/game-store";

const SHOW_MS = 2600;

/** 결정 결과를 잠깐 보여주는 알림. 새 알림이 오면 시간이 다시 시작돼요. */
export function Toast({ toast }: { toast: ToastData | null }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => gameActions.dismissToast(toast.id), SHOW_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="toast-zone" role="status" aria-live="polite">
      {toast && (
        <div className="toast" key={toast.id}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm4.3 6.3-5.6 5.6-2.9-2.9-1.4 1.4 4.3 4.3 7-7z" />
          </svg>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
