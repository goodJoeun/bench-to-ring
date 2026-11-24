"use client";

import { useState } from "react";
import { fmtNum } from "@/game";
import type { BoardEntry } from "@/shared/leaderboard/types";
import { nameFit } from "@/shared/lib/format";
import { CareerCardSheet } from "@/shared/ui/CareerCardSheet";
import { Sprite } from "@/shared/ui/sprite/Sprite";
import { jerseyOf, lookOf, medalOf } from "../../shared/ui/sprite/look";
import styles from "./rankings.module.css";

/** 이름 아래 한 줄의 조각: 포지션·최고 오버롤과 큰 상 */
function lineParts(e: BoardEntry): string[] {
  const parts = [e.pos, `OVR ${e.peak}`];
  if (e.mvp) parts.push(`NBA MVP ${e.mvp}`);
  if (e.fmvp) parts.push(`파이널 MVP ${e.fmvp}`);
  if (e.leagueMvp) parts.push(`리그 MVP ${e.leagueMvp}`);
  if (e.rings) parts.push(`반지 ${e.rings}`);
  parts.push(`통산 ${fmtNum(e.pts)}점`);
  return parts;
}

/** 조각의 끝 두 낱말(상 이름과 횟수). 줄이 바뀌어도 횟수만 다음 줄로 떨어지지 않게 묶어요. */
function splitPart(p: string): [string, string] {
  const words = p.split(" ");
  return [words.slice(0, -2).join(" "), words.slice(-2).join(" ")];
}

function Line({ e }: { e: BoardEntry }) {
  const parts = lineParts(e);
  return (
    <span className="sub">
      {parts.map((p, i) => {
        const [lead, tail] = splitPart(p);
        return (
          <span key={p}>
            {lead && `${lead} `}
            <span className={styles.rkPart}>
              {tail}
              {i < parts.length - 1 && " ·"}
            </span>{" "}
          </span>
        );
      })}
    </span>
  );
}

/** 시상대 툴팁에 보여줄 누적 기록. 상은 받은 것만 넣어요. */
function totals(e: BoardEntry): [string, string][] {
  const rows: [string, string][] = [
    ["통산 득점", fmtNum(e.pts)],
    ["통산 리바운드", fmtNum(e.reb)],
    ["통산 어시스트", fmtNum(e.ast)],
    ["시즌", `${e.seasons}시즌`],
  ];
  if (e.rings) rows.push(["우승 반지", `${e.rings}개`]);
  if (e.mvp) rows.push(["NBA MVP", `${e.mvp}회`]);
  if (e.fmvp) rows.push(["파이널 MVP", `${e.fmvp}회`]);
  if (e.leagueMvp) rows.push(["리그 MVP", `${e.leagueMvp}회`]);
  return rows;
}

/** 순위 숫자. 1~3위는 금·은·동 메달로 보여줘요. */
export function RankMark({ rank }: { rank: number }) {
  return (
    <span className={styles.rkR} data-medal={medalOf(rank)}>
      {fmtNum(rank)}
    </span>
  );
}

/** 순위표 한 줄. 줄 전체가 눌려서 커리어 카드를 열어요. */
export function RankRow({ e, rank, mine, onOpen }: { e: BoardEntry; rank: number; mine: boolean; onOpen: (e: BoardEntry) => void }) {
  return (
    <li data-mine={mine || undefined}>
      <RankMark rank={rank} />
      <Sprite look={lookOf(e.id, e.look)} color={jerseyOf(e.team)} scale={2} className="rk-mini" label={`${e.name} 캐릭터`} />
      <span className="rk-who">
        <b style={nameFit(`${e.name} #${e.num}`)}>
          {e.name} <span className="num">#{e.num}</span>
          {mine && <span className="me">나</span>}
        </b>
        <Line e={e} />
      </span>
      <span className={styles.rkChev} aria-hidden="true">
        ›
      </span>
      <button type="button" className="rk-open" aria-haspopup="dialog" aria-label={`${fmtNum(rank)}위 ${e.name} 커리어 보기`} onClick={() => onOpen(e)} />
    </li>
  );
}

/**
 * 시상대 한 칸: 선수가 위에 서고, 아래 단에 메달과 순위가 있어요. 1위 단이 가장 높아요.
 * 마우스를 올리면 누적 기록 툴팁이 뜨고, 누르면 커리어 카드가 열려요.
 */
function Podium({ e, place, rank, mine, onOpen }: { e: BoardEntry; place: 1 | 2 | 3; rank: number; mine: boolean; onOpen: (e: BoardEntry) => void }) {
  const medal = medalOf(rank) ?? "bronze";
  const tipId = `rk-tip-${e.id}`;
  return (
    <div className={styles.rkPod} data-place={place} data-mine={mine || undefined}>
      <span className={styles.rkTip} id={tipId} role="tooltip">
        {totals(e).map(([k, v]) => (
          <span key={k}>
            {k} <b>{v}</b>
          </span>
        ))}
      </span>
      <Sprite look={lookOf(e.id, e.look)} color={jerseyOf(e.team)} scale={3} className={styles.rkSprite} label={`${e.name} 캐릭터`} />
      <b className="nm" style={nameFit(e.name)}>
        {e.name}
        {mine && <span className="me">나</span>}
      </b>
      <span className="sub">
        {e.pos} · OVR {e.peak}
      </span>
      <div className={styles.rkStep} data-medal={medal}>
        <span className={styles.rkMedal} aria-hidden="true">
          {rank}
        </span>
        <span className={styles.lbl}>{rank}위</span>
      </div>
      <button type="button" className="rk-open" aria-haspopup="dialog" aria-describedby={tipId} aria-label={`${rank}위 ${e.name} 커리어 보기`} onClick={() => onOpen(e)} />
    </div>
  );
}

interface RankingListProps {
  rows: BoardEntry[];
  byPos: boolean;
  mine: Set<string>;
  /** 커리어 카드에 적는 순위. 없으면 전체·포지션 순위예요. */
  rankText?: (e: BoardEntry) => string;
}

export const defaultRankText = (e: BoardEntry) => `전체 ${fmtNum(e.rank)}위 · ${e.pos} ${fmtNum(e.posRank)}위`;

/** 랭킹: 1~3위는 시상대, 그 아래는 줄로 보여줘요. 포지션을 골랐으면 포지션 순위예요. 누르면 커리어 카드가 열려요. */
export function RankingList({ rows, byPos, mine, rankText = defaultRankText }: RankingListProps) {
  const [open, setOpen] = useState<BoardEntry | null>(null);
  const rankOf = (e: BoardEntry) => (byPos ? e.posRank : e.rank);
  const podium = rows.slice(0, 3);
  // 시상대는 2·1·3위 순서로 놓아요.
  const order = [podium[1], podium[0], podium[2]];
  return (
    <>
      <div className={styles.rkPodium}>
        {order.map((e, i) =>
          e ? <Podium key={e.id} e={e} place={([2, 1, 3] as const)[i]} rank={rankOf(e)} mine={mine.has(e.id)} onOpen={setOpen} /> : <div key={i} aria-hidden="true" />,
        )}
      </div>
      {rows.length > 3 && (
        <ol className={`rk-list ${styles.rkRows}`}>
          {rows.slice(3).map((e) => (
            <RankRow key={e.id} e={e} rank={rankOf(e)} mine={mine.has(e.id)} onOpen={setOpen} />
          ))}
        </ol>
      )}
      {open && <CareerCardSheet career={open} ranks={rankText(open)} mine={mine.has(open.id)} onClose={() => setOpen(null)} />}
    </>
  );
}
