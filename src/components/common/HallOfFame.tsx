import { bestFive, fmtNum, rankHall, type CareerSummary } from "@/game";
import { Panel } from "./ui";

/** 저장 코드로 불러온 커리어 표시 */
function Unofficial() {
  return (
    <span className="unofficial" title="저장 코드로 불러온 커리어예요">
      비공인
    </span>
  );
}

export function HallOfFame({ hall }: { hall: CareerSummary[] }) {
  if (!hall.length)
    return (
      <Panel title="명예의 전당">
        <p className="empty">은퇴한 선수가 아직 없어요. 프로 무대를 밟은 선수가 은퇴하면 이 브라우저의 기록에 올라가요.</p>
      </Panel>
    );
  const ranked = rankHall(hall).slice(0, 30);
  return (
    <Panel title="명예의 전당">
      <p className="hint">
        이 브라우저에서 은퇴한 선수들이에요. NBA MVP 횟수 → 최고 오버롤 → 개인상 → 통산 득점 순으로 줄을 세워요.
      </p>
      <div className="best5">
        {bestFive(hall).map(({ pos, career }) => (
          <div className="b5" key={pos}>
            <span className="p">{pos}</span>
            <span className="nm">
              {career ? career.name : "비어 있음"}
              {career?.imported && <Unofficial />}
            </span>
            <span className="hint">{career ? `OVR ${career.peak} · MVP ${career.mvp}` : "기록 없음"}</span>
          </div>
        ))}
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>순위</th>
              <th className="l">선수</th>
              <th className="l">POS</th>
              <th className="l">레거시</th>
              <th>MVP</th>
              <th>최고 OVR</th>
              <th>개인상</th>
              <th>반지</th>
              <th>통산 득점</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map(({ rank, career: h }) => (
              <tr key={h.id}>
                <td>{rank}</td>
                <td className="l t">
                  <b>{h.name}</b> #{h.num}
                  {h.imported && <Unofficial />}
                </td>
                <td className="l">{h.pos}</td>
                <td className="l t">{h.legacy}</td>
                <td>{h.mvp}</td>
                <td>{h.peak}</td>
                <td>{h.personal}</td>
                <td>{h.rings}</td>
                <td>{fmtNum(h.pts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
