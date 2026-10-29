"use client";

import { useState } from "react";
import {
  RECORD_GROUPS,
  careerTotals,
  recordBoardsFor,
  fmtNum as num,
  placeOnBoard,
  type BoardPlacement,
  type BoardRow,
  type Career,
  type RecordBoard,
  type RecordGroup,
} from "@/game";
import { nameFit } from "@/components/common/format";
import { Panel, Segmented } from "@/components/common/ui";

/** 이만큼 넘는 순위표는 상위권과 내 주변만 보여줘요. */
const FOLD = 10;

function visibleRows(rows: BoardRow[], all: boolean): (BoardRow | null)[] {
  if (all || rows.length <= FOLD + 1) return rows;
  const at = rows.findIndex((r) => r.mine);
  if (at < FOLD) return rows.slice(0, Math.max(FOLD, at + 1));
  // null 자리에 말줄임 줄이 들어가요.
  return [...rows.slice(0, 3), null, ...rows.slice(at - 2, at + 2)];
}

function statusLine(b: RecordBoard, mine: number, p: BoardPlacement): string {
  if (mine <= 0) return "기록 없음";
  if (p.rank === 1) return `${num(mine)}${b.unit} · 역대 1위`;
  const gap = p.next ? ` · ${p.next.name}까지 ${num(p.next.gap)}${b.unit}` : "";
  return p.rank ? `${num(mine)}${b.unit} · 역대 ${p.rank}위${gap}` : `${num(mine)}${b.unit} · TOP ${b.entries.length} 밖${gap}`;
}

function Board({ board, name, mine, all }: { board: RecordBoard; name: string; mine: number; all: boolean }) {
  const p = placeOnBoard(board, { name, v: mine });
  return (
    <div className="board">
      <h3>{board.title}</h3>
      <p className="st" data-ranked={p.rank !== null || undefined}>
        {statusLine(board, mine, p)}
      </p>
      <ol className="lb">
        {visibleRows(p.rows, all).map((r, i) =>
          r ? (
            <li key={`${r.name}-${i}`} data-mine={r.mine || undefined}>
              <span className="lr">{r.rank ?? "–"}</span>
              <span className="ln" style={r.mine ? nameFit(r.name) : undefined}>
                {r.name}
                {r.mine && <span className="me">나</span>}
                {r.note && <span className="lt">{r.note}</span>}
                {r.active && <span className="lt">현역</span>}
              </span>
              <span className="lv">{num(r.v)}</span>
            </li>
          ) : (
            <li key={`gap-${i}`} className="lgap" aria-hidden="true">
              ⋯
            </li>
          ),
        )}
      </ol>
    </div>
  );
}

/** 은퇴한 선수의 리그별 통산 기록을 실제 역대 순위표에 끼워 보여줘요. 가드는 통산 스틸, 포워드·센터는 통산 블록 순위표가 더 붙어요. */
export function RecordBoards({ career: c }: { career: Career }) {
  const totals = careerTotals(c);
  const [group, setGroup] = useState<RecordGroup>(() => {
    if (totals.nba.gp || totals.kbl.gp) return totals.nba.gp >= totals.kbl.gp ? "nba" : "kbl";
    return totals.olympics.gp ? "olympics" : "nba";
  });
  const [all, setAll] = useState(false);
  const info = RECORD_GROUPS.find((g) => g.key === group)!;
  const boards = recordBoardsFor(group, c.p.pos);
  const mine = totals[group];
  const foldable = boards.some((b) => b.entries.length > FOLD);

  return (
    <Panel title="역대 기록 순위">
      <Segmented
        label="순위표 고르기"
        options={RECORD_GROUPS.map((g) => ({ key: g.key, big: g.name, sm: totals[g.key].gp ? `${num(totals[g.key].gp)}경기` : "기록 없음" }))}
        value={group}
        onChange={setGroup}
      />
      {!mine.gp && (
        <p className="hint">
          {group === "olympics" ? "올림픽에 나간 기록이 없어요." : `${info.name}에서 뛴 기록이 없어요.`} 실제 순위표만 보여줘요.
        </p>
      )}
      <div className="boards">
        {boards.map((b) => (
          <Board key={b.stat} board={b} name={c.p.name} mine={mine[b.stat]} all={all} />
        ))}
      </div>
      {foldable && (
        <div className="row">
          <button type="button" className="btn" aria-expanded={all} onClick={() => setAll(!all)}>
            {all ? "접기" : `TOP ${Math.max(...boards.map((b) => b.entries.length))} 모두 보기`}
          </button>
        </div>
      )}
      <p className="hint">
        {info.asOf}.{" "}
        {group === "olympics"
          ? "내 기록은 올림픽 본선 경기 득점을 더한 값이에요. 최종예선은 빼요."
          : "현역 표시가 붙은 선수는 그 뒤로도 기록이 늘어요. 내 기록은 시즌 평균에 경기 수를 곱해 더한 값이에요."}
      </p>
    </Panel>
  );
}
