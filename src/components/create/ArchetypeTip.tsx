"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SHORT, type Archetype, type AttrKey } from "@/game";
import { useEscapeKey } from "@/components/common/hooks";

/** 배수가 큰 순서로 이 유형이 키워주는 능력치 */
function strengthsOf(arch: Archetype): string {
  return (Object.entries(arch.e) as [AttrKey, number][])
    .filter(([, m]) => m > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => SHORT[k])
    .join(" · ");
}

/** 유형 이름 옆 ⓘ 버튼. 마우스를 올리거나 누르면 강점과 대표 선수를 보여줘요. */
export function ArchetypeTip({ arch }: { arch: Archetype }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEscapeKey(() => setOpen(false), open);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  return (
    // 툴팁을 눌러도 카드가 선택되지 않게 클릭을 여기서 멈춰요.
    <span ref={ref} className="tip-wrap" data-open={open || undefined} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="tip-btn"
        aria-label={`${arch.name} 설명 보기`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        i
      </button>
      <span id={id} className="tip" role="tooltip">
        <span className="tip-row">
          <b>강점</b>
          {strengthsOf(arch)}
        </span>
        <span className="tip-row">
          <b>KBL</b>
          {arch.kbl.join(" · ")}
        </span>
        <span className="tip-row">
          <b>NBA</b>
          {arch.nba.join(" · ")}
        </span>
      </span>
    </span>
  );
}
