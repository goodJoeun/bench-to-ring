"use client";

import { useEffect, useRef, useState } from "react";
import { useEscapeKey } from "../lib/hooks";

/** 시트가 저절로 뜬 직후 입력을 받지 않는 시간(ms). 다른 단추를 누르려던 손가락이 선택지에 닿지 않게 해요. */
const TAP_GUARD_MS = 500;
/** 손잡이를 이만큼 아래로 끌면 시트를 닫아요(px). */
const DRAG_CLOSE_PX = 80;
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface SheetProps {
  labelledBy: string;
  /** 없으면 반드시 골라야 하는 시트라 배경을 눌러도 닫히지 않고, 끌어서 닫는 손잡이도 없어요. */
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
  const dragFrom = useRef<number | null>(null);
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

  // 탭 키 초점이 시트 뒤 화면으로 나가지 않게 처음과 끝을 이어요. 시트가 겹치면 맨 위 시트만 처리해요.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = ref.current;
      if (e.key !== "Tab" || !el) return;
      const sheets = document.querySelectorAll(".sheet");
      if (sheets[sheets.length - 1] !== el) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.getClientRects().length > 0);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const now = document.activeElement;
      const next = !el.contains(now) ? first : e.shiftKey && now === first ? last : !e.shiftKey && now === last ? first : null;
      if (!next) return;
      e.preventDefault();
      next.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /** 입력을 막는 동안의 클릭(터치·마우스·키보드 모두)은 단추에 닿기 전에 버려요. */
  const blockClick = (e: React.MouseEvent) => {
    if (!guarded) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const startDrag = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (guarded) return;
    dragFrom.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  // 등장 애니메이션이 transform을 쓰고 있어서 끄는 동안은 translate로 옮겨요.
  const moveDrag = (e: React.PointerEvent) => {
    if (dragFrom.current === null || !ref.current) return;
    ref.current.style.translate = `0 ${Math.max(0, e.clientY - dragFrom.current)}px`;
  };
  const endDrag = (e: React.PointerEvent) => {
    if (dragFrom.current === null) return;
    const moved = e.clientY - dragFrom.current;
    dragFrom.current = null;
    if (ref.current) ref.current.style.translate = "";
    if (e.type === "pointerup" && moved > DRAG_CLOSE_PX) onClose?.();
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
        {onClose && <span className="grabber" aria-hidden="true" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} />}
        {children}
      </div>
    </>
  );
}
