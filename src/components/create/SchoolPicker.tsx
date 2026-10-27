"use client";

import { useEffect, useId, useRef, useState } from "react";
import { TEAMS } from "@/game";
import { TeamBadge } from "@/components/common/TeamBadge";

/** 맨 앞의 ""는 무작위 배정이에요. */
const OPTIONS: readonly (readonly [string, string?])[] = [[""], ...TEAMS.hs];

function SchoolLabel({ name, color }: { name: string; color?: string }) {
  return (
    <>
      {name ? <TeamBadge name={name} kind="hs" color={color} size={22} /> : <span className="school-any" aria-hidden="true">?</span>}
      <span className="school-name">{name || "무작위 배정"}</span>
    </>
  );
}

/**
 * 고등학교 고르기. 기본 select는 옵션에 로고를 넣을 수 없어서 콤보박스(선택 전용)로 직접 만들었어요.
 * 위아래 화살표·Home·End로 움직이고 Enter·Space로 고르며, Esc나 바깥 클릭으로 닫혀요.
 */
export function SchoolPicker({ value, onChange, labelledBy }: { value: string; onChange: (school: string) => void; labelledBy: string }) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    OPTIONS.findIndex(([name]) => name === value),
  );
  const [active, setActive] = useState(selectedIndex);
  const optionId = (i: number) => `${id}-opt-${i}`;
  const [current, currentColor] = OPTIONS[selectedIndex];

  const show = () => {
    setActive(selectedIndex);
    setOpen(true);
  };
  const pick = (i: number) => {
    onChange(OPTIONS[i][0]);
    setOpen(false);
  };

  // 열려 있을 때 바깥을 누르면 닫아요.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // 키보드로 움직인 항목이 목록 밖으로 나가지 않게 따라 스크롤해요.
  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = OPTIONS.length - 1;
    const move = (i: number) => {
      e.preventDefault();
      if (open) setActive(i);
      else show();
    };
    switch (e.key) {
      case "ArrowDown":
        return move(Math.min(active + 1, last));
      case "ArrowUp":
        return move(Math.max(active - 1, 0));
      case "Home":
        return move(0);
      case "End":
        return move(last);
      case "Enter":
      case " ":
        e.preventDefault();
        return open ? pick(active) : show();
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        return;
      case "Tab":
        if (open) pick(active);
        return;
    }
  };

  return (
    <div className="school-pick" ref={rootRef}>
      <button
        type="button"
        id="f-school"
        className="school-btn"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={labelledBy}
        aria-activedescendant={open ? optionId(active) : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <SchoolLabel name={current} color={currentColor} />
      </button>
      {open && (
        // 항목을 눌러도 버튼에서 초점이 빠지지 않게 해요.
        <ul
          className="school-list"
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={labelledBy}
          ref={listRef}
          onMouseDown={(e) => e.preventDefault()}
        >
          {OPTIONS.map(([name, color], i) => (
            <li
              key={name || "random"}
              id={optionId(i)}
              role="option"
              aria-selected={i === selectedIndex}
              data-active={i === active || undefined}
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(i)}
            >
              <SchoolLabel name={name} color={color} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
