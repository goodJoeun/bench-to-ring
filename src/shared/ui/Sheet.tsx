"use client";

import { useEffect, useRef, useState } from "react";
import { useEscapeKey } from "../lib/hooks";

/** 시트가 저절로 뜬 직후 입력을 받지 않는 시간(ms). 다른 단추를 누르려던 손가락이 선택지에 닿지 않게 해요. */
const TAP_GUARD_MS = 500;

interface SheetProps {
  labelledBy: string;
  /** 없으면 반드시 골라야 하는 시트라 배경을 눌러도 닫히지 않아요. */
  onClose?: () => void;
  /**
   * 저절로 뜨는 시트의 단계 이름. 있으면 열릴 때와 값이 바뀔 때 잠깐 입력을 막고 초점을 다시 잡아요.
   * 사용자가 직접 연 시트에는 주지 않아요.
   */
  guardKey?: string;
  children: React.ReactNode;
}

/** 화면 아래에서 올라오는 선택 시트 */
export function Sheet({ labelledBy, onClose, guardKey, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const guarded = guardKey !== undefined && armedKey !== guardKey;
  useEscapeKey(onClose);

  // 열릴 때(단계가 바뀔 때도): 첫 버튼(data-autofocus가 있으면 그 단추)에 초점을 두고, 닫히면 원래 자리로 돌려놔요.
  // 되돌릴 수 없는 일을 묻는 시트는 취소 단추에 data-autofocus를 달아, 엔터를 잘못 눌러도 실행되지 않게 해요.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("[data-autofocus]") ?? ref.current?.querySelector<HTMLElement>("button");
    first?.focus({ preventScroll: true });
    return () => prev?.focus?.({ preventScroll: true });
  }, [guardKey]);

  useEffect(() => {
    if (guardKey === undefined) return;
    const timer = setTimeout(() => setArmedKey(guardKey), TAP_GUARD_MS);
    return () => clearTimeout(timer);
  }, [guardKey]);

  /** 입력을 막는 동안의 클릭(터치·마우스·키보드 모두)은 단추에 닿기 전에 버려요. */
  const blockClick = (e: React.MouseEvent) => {
    if (!guarded) return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <div className="scrim" aria-hidden="true" onClick={guarded ? undefined : onClose} />
      <div
        ref={ref}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        data-guarded={guarded || undefined}
        onClickCapture={blockClick}
      >
        <span className="grabber" aria-hidden="true" />
        {children}
      </div>
    </>
  );
}
