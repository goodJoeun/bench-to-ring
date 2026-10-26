import type { CareerSummary, PosKey } from "@/game";

/* 명예의 전당(이 브라우저의 기록) 표와 Best 5 */

type HallCareer = Pick<CareerSummary, "name" | "num" | "pos" | "legacy" | "mvp" | "peak" | "personal" | "rings" | "pts">;

export interface HallRow {
  key: string;
  rank: number;
  career: HallCareer;
}

export function Best5({ items }: { items: { pos: PosKey; career: HallCareer | null; note?: string }[] }) {
  return (
    <div className="best5">
      {items.map(({ pos, career, note }) => (
        <div className="b5" key={pos}>
          <span className="p">{pos}</span>
          <span className="nm">{career ? career.name : "비어 있음"}</span>
          <span className="hint">{career ? `${note ? `${note} · ` : ""}OVR ${career.peak} · MVP ${career.mvp}` : "기록 없음"}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * 명예의 전당 표: 순위·선수·포지션·레거시·최고 OVR. 순위는 리그별 MVP·우승·파이널 MVP·개인상, 국가대표, 통산 기록을
 * 종합한 랭킹 점수(rankScore)로 매기고, 점수 자체는 보여주지 않아요.
 */
export function HallTable({ rows }: { rows: HallRow[] }) {
  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>순위</th>
            <th className="l">선수</th>
            <th className="l">포지션</th>
            <th className="l">레거시</th>
            <th>최고 OVR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, rank, career: h }) => (
            <tr key={key}>
              <td>{rank}</td>
              <td className="l t">
                <b>{h.name}</b> #{h.num}
              </td>
              <td className="l">{h.pos}</td>
              <td className="l t">{h.legacy}</td>
              <td>{h.peak}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
