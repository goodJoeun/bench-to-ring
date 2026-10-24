import Link from "next/link";
import { bestFive, rankHall, rankScore, type CareerSummary } from "@/game";
import { Best5, HallTable } from "./HallTable";
import { Panel } from "./ui";

/** 이 브라우저에서 은퇴한 선수들. 온라인 랭킹과 역대 베스트 5는 랭킹 페이지에서 봐요. */
export function HallOfFame({ hall }: { hall: CareerSummary[] }) {
  const ranked = rankHall(hall).slice(0, 30);
  return (
    <Panel title="명예의 전당">
      {hall.length ? (
        <>
          <p className="hint">
            이 브라우저에서 은퇴한 선수들이에요. NBA MVP·파이널 MVP·우승·수상과 통산 기록을 더한 랭킹 점수로 줄을 세워요.
          </p>
          <Best5 items={bestFive(hall)} />
          <HallTable rows={ranked.map(({ rank, career }) => ({ key: career.id, rank, score: rankScore(career), career }))} />
        </>
      ) : (
        <p className="empty">은퇴한 선수가 아직 없어요. 프로 무대를 밟은 선수가 은퇴하면 여기와 온라인 랭킹에 올라가요.</p>
      )}
      <div className="row">
        <Link className="btn" href="/rankings">
          온라인 랭킹 · 역대 베스트 5 보기
        </Link>
      </div>
    </Panel>
  );
}
