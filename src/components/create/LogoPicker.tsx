"use client";

import { useEffect, useId, useRef, useState } from "react";
import { NATIONS, TEAMS } from "@/game";
import { TeamBadge } from "@/components/common/TeamBadge";

/** 고를 항목: 값, 보여줄 이름, 로고 대신 쓸 대표색. 값이 ""인 항목은 무작위예요. */
type PickOption = readonly [value: string, label: string, color?: string];

function PickLabel({ option: [value, label, color], kind }: { option: PickOption; kind?: "hs" }) {
  return (
    <>
      {value ? <TeamBadge name={value} kind={kind} color={color} size={22} /> : <span className="lpick-any" aria-hidden="true">?</span>}
      <span className="lpick-name">{label}</span>
    </>
  );
}

/**
 * 로고(국기)가 붙은 목록에서 하나 고르기. 기본 select는 옵션에 그림을 넣을 수 없어서 콤보박스(선택 전용)로 직접 만들었어요.
 * 위아래 화살표·Home·End로 움직이고 Enter·Space로 고르며, Esc나 바깥 클릭으로 닫혀요.
 */
function LogoPicker({
  options,
  kind,
  value,
  onChange,
  id: buttonId,
  labelledBy,
}: {
  options: readonly PickOption[];
  kind?: "hs";
  value: string;
  onChange: (value: string) => void;
  id: string;
  labelledBy: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex(([v]) => v === value),
  );
  const [active, setActive] = useState(selectedIndex);
  const optionId = (i: number) => `${id}-opt-${i}`;

  const show = () => {
    setActive(selectedIndex);
    setOpen(true);
  };
  const pick = (i: number) => {
    onChange(options[i][0]);
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
    const last = options.length - 1;
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
    <div className="lpick" ref={rootRef}>
      <button
        type="button"
        id={buttonId}
        className="lpick-btn"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={labelledBy}
        aria-activedescendant={open ? optionId(active) : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <PickLabel option={options[selectedIndex]} kind={kind} />
      </button>
      {open && (
        // 항목을 눌러도 버튼에서 초점이 빠지지 않게 해요.
        <ul
          className="lpick-list"
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={labelledBy}
          ref={listRef}
          onMouseDown={(e) => e.preventDefault()}
        >
          {options.map((o, i) => (
            <li
              key={o[0] || "random"}
              id={optionId(i)}
              role="option"
              aria-selected={i === selectedIndex}
              data-active={i === active || undefined}
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(i)}
            >
              <PickLabel option={o} kind={kind} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 맨 앞은 무작위 배정이에요. */
const SCHOOLS: readonly PickOption[] = [["", "무작위 배정"], ...TEAMS.hs.map(([name, color]) => [name, name, color] as const)];

export function SchoolPicker({ value, onChange, labelledBy }: { value: string; onChange: (school: string) => void; labelledBy: string }) {
  return <LogoPicker id="f-school" options={SCHOOLS} kind="hs" value={value} onChange={onChange} labelledBy={labelledBy} />;
}

const NATION_OPTIONS: readonly PickOption[] = NATIONS.map((n) => [n.name, n.name] as const);

export function NationPicker({ value, onChange, labelledBy }: { value: string; onChange: (nat: string) => void; labelledBy: string }) {
  return <LogoPicker id="f-nat" options={NATION_OPTIONS} value={value} onChange={onChange} labelledBy={labelledBy} />;
}
