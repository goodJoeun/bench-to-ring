"use client";

import { useAutoFocus } from "./hooks";
import { Sprite } from "./Sprite";

interface PopupProps {
  /** 제목 요소 id. 없으면 label로 이름을 붙여요. */
  labelledBy?: string;
  label?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * 진행 화면용 파란 전체 화면 팝업: 시즌 진행, 국가대표 대회, 드래프트, 결승 중계.
 * 휴대폰은 전체 화면, 넓은 화면은 가운데 패널이에요.
 */
export function Popup({ labelledBy, label, className, children }: PopupProps) {
  return (
    <div className="sim" role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : label}>
      <div className={className ? `sim-card ${className}` : "sim-card"}>{children}</div>
    </div>
  );
}

interface PopupHeroProps {
  /** 코트 위 도트 캐릭터 */
  player: { skin: string; hair: string };
  /** 유니폼 색 */
  color: string;
  /** 제목 위 작은 줄: 팀, 소속 */
  team: React.ReactNode;
  title: React.ReactNode;
  titleId: string;
  /** 제목 아래 진행 상태. 화면 읽기 프로그램에 바로 읽혀요. */
  status: React.ReactNode;
  /** 진행 중이면 상태 뒤에 점 세 개가 움직여요. */
  busy?: boolean;
  /** 코트와 제목 사이에 넣을 내용 (전광판 등) */
  children?: React.ReactNode;
}

/** 팝업 위쪽: 코트 위 선수, 소속, 제목, 진행 상태 */
export function PopupHero({ player, color, team, title, titleId, status, busy, children }: PopupHeroProps) {
  return (
    <>
      <div className="sim-court" aria-hidden="true">
        <Sprite skin={player.skin} hair={player.hair} color={color} label="" className="sprite sim-sprite" />
        <span className="sim-shadow" />
      </div>
      {children}
      <span className="sim-team">{team}</span>
      <h2 id={titleId}>{title}</h2>
      <p className="sim-phase" role="status" aria-live="polite">
        {status}
        {busy && <span className="dots" aria-hidden="true" />}
      </p>
    </>
  );
}

interface PopupFooterProps {
  /** 결과를 보여줄 차례인지 */
  done: boolean;
  onSkip: () => void;
  onConfirm: () => void;
  /** 끝났을 때 확인 버튼 위에 보여줄 결과 */
  children: React.ReactNode;
}

/** 팝업 아래쪽: 진행 중에는 '결과 바로 보기', 끝나면 결과와 '확인' 버튼. 끝나면 확인 버튼에 초점이 가요. */
export function PopupFooter({ done, onSkip, onConfirm, children }: PopupFooterProps) {
  const goRef = useAutoFocus<HTMLButtonElement>(done);
  if (!done)
    return (
      <button type="button" className="sim-skip" onClick={onSkip}>
        결과 바로 보기
      </button>
    );
  return (
    <>
      {children}
      <button type="button" ref={goRef} className="live-go" onClick={onConfirm}>
        확인
      </button>
    </>
  );
}
