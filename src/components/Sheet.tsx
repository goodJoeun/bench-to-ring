"use client";

import { useEffect, useRef } from "react";

interface SheetProps {
  labelledBy: string;
  /** 없으면 반드시 골라야 하는 시트라 배경을 눌러도 닫히지 않아요. */
  onClose?: () => void;
  children: React.ReactNode;
}

/** 화면 아래에서 올라오는 선택 시트 */
export function Sheet({ labelledBy, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // 열릴 때 한 번만: 첫 버튼에 초점을 두고, 닫히면 원래 자리로 돌려놔요.
  useEffect(() => {
    const el = ref.current;
    const prev = document.activeElement as HTMLElement | null;
    el?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <>
      <div className="scrim" aria-hidden="true" onClick={onClose} />
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <span className="grabber" aria-hidden="true" />
        {children}
      </div>
    </>
  );
}
