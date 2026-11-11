"use client";

import { useState } from "react";
import { playerLook, type Career, type ClutchMove } from "@/game";
import { ClutchResult, type ClutchResultInfo } from "@/features/career/ClutchArt";
import { type ClutchCast } from "@/features/career/ClutchMoveArt";
import { Sheet } from "@/shared/ui/Sheet";
import { useEscapeKey } from "@/shared/lib/hooks";

/**
 * 개발용: 클러치 성공 장면을 임시 테스트 데이터로 하나씩, 또는 연달아 띄워 봐요.
 * 개발 서버(next dev)에서만 화면 오른쪽 아래에 버튼이 생겨요. 배포 빌드에는 나오지 않아요.
 */

const OFFENSE: ClutchMove[] = ["shot", "three", "dunk", "drive", "pass"];
const DEFENSE: ClutchMove[] = ["lockdown", "block", "steal", "charge"];
const ALL = [...OFFENSE, ...DEFENSE];

/** 장면마다 쓰는 테스트 플레이 이름 (실제 클러치 선택지 이름과 비슷하게) */
const PLAY: Record<ClutchMove, string> = {
  shot: "종료 버저와 함께 풀업 점퍼",
  three: "버저와 함께 꽂은 3점슛",
  dunk: "공격 리바운드 풋백 덩크",
  drive: "수비 둘을 제치는 돌파 레이업",
  pass: "픽앤롤에서 뿌린 노룩 패스",
  lockdown: "상대 에이스를 끝까지 막아 낸 수비",
  block: "마지막 슛을 쳐 낸 블록슛",
  steal: "패스 길목을 끊은 가로채기",
  charge: "마지막 돌파를 멈춰 세운 차징 유도",
};
const NAME: Record<ClutchMove, string> = {
  shot: "슛",
  three: "3점슛",
  dunk: "덩크",
  drive: "돌파",
  pass: "노룩 패스",
  lockdown: "끝까지 막기",
  block: "블록",
  steal: "가로채기",
  charge: "차징",
};

/** 장면마다 돌아가며 쓰는 상대 팀 (이름, 유니폼 색) */
const OPPS: [string, string][] = [
  ["서울 SK", "#C8102E"],
  ["LA 레이커스", "#552583"],
  ["보스턴 셀틱스", "#007A33"],
  ["부산 KCC", "#1D428A"],
  ["마이애미 히트", "#98002E"],
];

/** 커리어가 없을 때 쓰는 테스트 선수 */
const TEST_CAST: ClutchCast = {
  look: { kind: "asian", skin: "#F1CFA4", hair: "#111111", style: "curtain", beard: "none", eyes: "#2A1A10" },
  color: "#2F5DB0",
};

function resultOf(move: ClutchMove, i: number): ClutchResultInfo {
  const [opp, oppColor] = OPPS[i % OPPS.length];
  const us = 78 + (i % 5) * 3;
  return { win: true, us, them: us - 1 - (i % 3), opp, move, play: PLAY[move], oppColor };
}

export function ClutchPreview({ career }: { career: Career | null }) {
  const [open, setOpen] = useState(false);
  /** 재생 중인 목록과 지금 순서 */
  const [queue, setQueue] = useState<ClutchMove[] | null>(null);
  const [at, setAt] = useState(0);
  /** 같은 장면을 다시 볼 때 새로 그리게 바꾸는 값 */
  const [replay, setReplay] = useState(0);
  const [auto, setAuto] = useState(true);
  const [mine, setMine] = useState(true);

  const playing = queue !== null;
  const move = queue?.[at];
  const useMine = mine && !!career;
  const base: ClutchCast = useMine ? { look: playerLook(career.p), color: career.team?.color ?? TEST_CAST.color } : TEST_CAST;

  const play = (list: ClutchMove[]) => {
    setOpen(false);
    setQueue(list);
    setAt(0);
    setReplay((r) => r + 1);
  };
  const stop = () => {
    setQueue(null);
    setOpen(true);
  };
  const go = (d: number) => {
    if (!queue) return;
    const n = at + d;
    if (n >= queue.length) return stop();
    setAt(Math.max(0, n));
    setReplay((r) => r + 1);
  };

  useEscapeKey(stop, playing);

  if (playing && move) {
    const i = ALL.indexOf(move);
    const result = resultOf(move, i);
    return (
      <>
        <ClutchResult
          key={`${at}-${replay}`}
          result={result}
          cast={{ ...base, oppColor: result.oppColor, seed: result.opp }}
          onDone={() => auto && go(1)}
        />
        <div className="cpv-bar" role="toolbar" aria-label="클러치 장면 미리보기">
          <span className="cpv-now">
            {at + 1} / {queue.length} · <b>{NAME[move]}</b> <code>{move}</code>
          </span>
          <button type="button" onClick={() => go(-1)} disabled={at === 0}>
            이전
          </button>
          <button type="button" onClick={() => setReplay((r) => r + 1)}>
            다시
          </button>
          <button type="button" onClick={() => go(1)}>
            {at + 1 < queue.length ? "다음" : "끝내기"}
          </button>
          <label>
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> 자동
          </label>
          <button type="button" onClick={stop} aria-label="미리보기 그만">
            닫기
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <button type="button" className="cpv-fab" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        클러치 미리보기
      </button>
      {open && (
        <Sheet labelledBy="cpv-title" onClose={() => setOpen(false)}>
          <h2 id="cpv-title">클러치 장면 미리보기</h2>
          <p className="cpv-note">개발 서버에서만 보이는 테스트 팝업이에요. 저장된 커리어는 바뀌지 않아요.</p>
          <label className="cpv-opt">
            <input type="checkbox" checked={useMine} disabled={!career} onChange={(e) => setMine(e.target.checked)} />
            {career ? `내 선수로 보기 (${career.p.name}${career.team ? ` · ${career.team.name}` : ""})` : "내 선수로 보기 (진행 중인 커리어가 없어 테스트 선수로 보여요)"}
          </label>
          <label className="cpv-opt">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            장면이 끝나면 자동으로 다음 장면
          </label>
          <div className="cpv-all">
            <button type="button" className="btn" onClick={() => play(ALL)}>
              전체 연달아 보기 ({ALL.length})
            </button>
            <button type="button" className="btn" onClick={() => play(OFFENSE)}>
              공격만
            </button>
            <button type="button" className="btn" onClick={() => play(DEFENSE)}>
              수비만
            </button>
          </div>
          {(
            [
              ["공격", OFFENSE],
              ["수비", DEFENSE],
            ] as const
          ).map(([label, list]) => (
            <section key={label} className="cpv-sec">
              <h3>{label}</h3>
              <div className="cpv-grid">
                {list.map((m) => (
                  <button type="button" key={m} className="btn" onClick={() => play([m])}>
                    <b>{NAME[m]}</b>
                    <code>{m}</code>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </Sheet>
      )}
    </>
  );
}
