import { money } from "@/game";
import { Sprite } from "./Sprite";

/* 여러 화면에서 같이 쓰는 작은 화면 조각. 모양은 globals.css의 같은 클래스 이름을 따라가요. */

const cls = (base: string, extra?: string) => (extra ? `${base} ${extra}` : base);

interface PanelProps {
  /** 섹션 제목 (h2) */
  title?: React.ReactNode;
  /** 제목 위 작은 줄 */
  kicker?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** 카드 모양 섹션 */
export function Panel({ title, kicker, className, children }: PanelProps) {
  return (
    <section className={cls("panel", className)}>
      {kicker !== undefined && <span className="label">{kicker}</span>}
      {title !== undefined && <h2 className="sec">{title}</h2>}
      {children}
    </section>
  );
}

/** 보유 자금을 큰 숫자로 보여줘요. 시즌 투자·상점처럼 돈을 쓰는 곳 위에 둬요. note는 옆에 작게 붙여요. */
export function Funds({ amount, note }: { amount: number; note?: React.ReactNode }) {
  return (
    <div className="funds">
      <span className="funds-k">보유 자금</span>
      <b className="funds-v">{money(amount)}</b>
      {note && <span className="funds-note">{note}</span>}
    </div>
  );
}

/**
 * 불러오는 동안 보여줘요: 도는 표시와 안내 한 줄, 그 아래 목록 자리를 미리 잡아 두는 빈 줄(rows개).
 * 빈 줄이 있으면 불러온 뒤 화면이 크게 출렁이지 않아요.
 */
export function Loading({ label, rows = 0 }: { label: string; rows?: number }) {
  return (
    <div className="loading" role="status">
      <div className="loading-head">
        <span className="spinner" aria-hidden="true" />
        {label}
      </div>
      {rows > 0 && (
        <div className="skeleton" aria-hidden="true">
          {Array.from({ length: rows }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 숫자 타일 묶음: [이름, 값] 목록 */
export function StatTiles({ items }: { items: readonly (readonly [string, React.ReactNode])[] }) {
  return (
    <div className="tiles">
      {items.map(([k, v]) => (
        <div className="tile" key={k}>
          <span className="label">{k}</span>
          <span className="n">{v}</span>
        </div>
      ))}
    </div>
  );
}

type ChoiceProps = {
  label: React.ReactNode;
  /** 오른쪽 끝 작은 꼬리표 */
  tag?: React.ReactNode;
  /** 아래 설명 */
  sub?: React.ReactNode;
  /** 이름 앞 작은 그림 (팀 엠블럼 등) */
  icon?: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "className" | "children">;

/** 시트 안의 큰 선택 버튼 */
export function Choice({ label, tag, sub, icon, ...rest }: ChoiceProps) {
  return (
    <button type="button" className="choice" {...rest}>
      <span className="cl">
        {icon}
        <b>{label}</b>
        {tag && <span className="ct">{tag}</span>}
      </span>
      {sub && <span className="cs">{sub}</span>}
    </button>
  );
}

export interface SegmentOption<K extends string> {
  key: K;
  /** 위 큰 글씨 */
  big: React.ReactNode;
  /** 아래 작은 글씨 */
  sm: React.ReactNode;
}

interface SegmentedProps<K extends string> {
  /** 화면 읽기 프로그램용 그룹 이름 */
  label: string;
  options: readonly SegmentOption<K>[];
  value: K;
  onChange: (k: K) => void;
  className?: string;
}

/** 하나만 고르는 버튼 묶음 */
export function Segmented<K extends string>({ label, options, value, onChange, className }: SegmentedProps<K>) {
  return (
    <div className={cls("seg", className)} role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o.key} aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
          <span className="big">{o.big}</span>
          <span className="sm">{o.sm}</span>
        </button>
      ))}
    </div>
  );
}

interface CourtStageProps {
  player: { name: string; skin: string; hair: string };
  /** 유니폼과 코트 색 */
  color: string;
  /** 선수 옆 이름판 내용 */
  children: React.ReactNode;
}

/** 코트 위 도트 선수와 이름판 */
export function CourtStage({ player, color, children }: CourtStageProps) {
  return (
    <section className="court" style={{ "--team": color } as React.CSSProperties}>
      <div className="key" aria-hidden="true" />
      <Sprite skin={player.skin} hair={player.hair} color={color} label={`${player.name} 도트 캐릭터`} />
      <div className="plate">{children}</div>
    </section>
  );
}
