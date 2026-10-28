"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { POS, POS_KEYS, type PosKey } from "@/game";
import { useGame } from "@/lib/game-store";
import { fetchBoard, fetchMine, fetchStatBoard, pendingIds } from "@/lib/leaderboard/client";
import { daysBack, kstDay } from "@/lib/leaderboard/days";
import { STAT_KEYS, type Board, type BoardDay, type MyRanks, type StatBoard, type StatKey } from "@/lib/leaderboard/types";
import { Loading } from "@/components/common/ui";
import { BestFiveCourt } from "./BestFiveCourt";
import { MyRecords } from "./MyRecords";
import { RankingList } from "./RankingList";
import { STAT_LABELS, StatList } from "./StatList";

const TABS = [
  ["best5", "베스트 5"],
  ["ranking", "랭킹 100"],
  ["position", "포지션별 랭킹"],
  ["stats", "스탯 랭킹"],
  ["mine", "나의 기록"],
] as const;
type Tab = (typeof TABS)[number][0];
type PosFilter = PosKey | "all";
/** 고른 날짜: 오늘부터 며칠 전인지(0이 오늘), 또는 올타임 */
type DayPick = number | "all";

// 탭은 주소의 #best5 · #ranking · #position · #stats · #mine을 따라가요. 링크로 바로 열 수 있고 뒤로 가기도 돼요.
const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
/** 바뀔 일이 없는 값을 useSyncExternalStore로 읽을 때 써요. 서버와 브라우저 값만 갈라요. */
const subscribeNever = () => () => {};
const readTab = (): Tab => {
  const h = window.location.hash.slice(1);
  return TABS.some(([k]) => k === h) ? (h as Tab) : "best5";
};

/** 오늘의 한국 날짜. 서버에서는 빈 문자열이에요. */
const readToday = () => kstDay(Date.now());

/** 날짜 칩 이름: 오늘·어제, 그 앞은 월.일 */
const dayLabel = (day: string, ago: number) => (ago === 0 ? "오늘" : ago === 1 ? "어제" : `${day.slice(5, 7)}.${day.slice(8)}`);

/** 일주일 날짜 칩과 맨 끝 올타임 칩 */
function DayChips({ days, pick, onPick }: { days: string[]; pick: DayPick; onPick: (p: DayPick) => void }) {
  return (
    <div className="rk-chips rk-days" role="group" aria-label="날짜 고르기">
      {days.map((d, i) => (
        <button key={d} type="button" aria-pressed={pick === i} onClick={() => onPick(i)}>
          {dayLabel(d, i)}
        </button>
      ))}
      <button type="button" aria-pressed={pick === "all"} onClick={() => onPick("all")}>
        올타임<span>(역대)</span>
      </button>
    </div>
  );
}

/** 빈 순위표 문구에 쓰는 날짜 이름 */
const dayName = (day: BoardDay, today: string) =>
  day === null ? "" : day === today ? "오늘 " : `${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일에 `;

/**
 * 순위표는 그 순위표를 쓰는 탭을 열 때(`needed`) 처음 불러와요.
 * 한 번 불러온 순위표(날짜·포지션마다)는 이 화면에 있는 동안 다시 부르지 않아요. null은 불러오지 못한 것이에요.
 */
function useBoard(pos: PosFilter, day: BoardDay, needed: boolean) {
  const [boards, setBoards] = useState<Record<string, Board | null>>({});
  const key = `${day ?? "all"}:${pos}`;
  const loaded = key in boards;
  useEffect(() => {
    if (loaded || !needed) return;
    let live = true;
    void fetchBoard(undefined, pos === "all" ? null : pos, day).then((b) => {
      if (live) setBoards((m) => ({ ...m, [key]: b }));
    });
    return () => {
      live = false;
    };
  }, [key, pos, day, loaded, needed]);
  const retry = () =>
    setBoards((m) => {
      const next = { ...m };
      delete next[key];
      return next;
    });
  return { board: boards[key], loaded, retry };
}

/**
 * 스탯 랭킹 탭: 스탯을 고르면 그 스탯의 프로 통산 상위 50명을 불러와요. 날짜를 고르면 그날 올라온 기록끼리예요.
 * 한 번 불러온 스탯(날짜마다)은 이 화면에 있는 동안 다시 부르지 않아요. null은 불러오지 못한 것이에요.
 */
function StatsPanel({ mine, day, today }: { mine: Set<string>; day: BoardDay; today: string }) {
  const [stat, setStat] = useState<StatKey>("pts");
  const [boards, setBoards] = useState<Record<string, StatBoard | null>>({});
  const key = `${day ?? "all"}:${stat}`;
  const loaded = key in boards;
  useEffect(() => {
    if (loaded) return;
    let live = true;
    void fetchStatBoard(stat, undefined, day).then((b) => {
      if (live) setBoards((m) => ({ ...m, [key]: b }));
    });
    return () => {
      live = false;
    };
  }, [key, stat, day, loaded]);
  const board = boards[key];
  const retry = () =>
    setBoards((m) => {
      const next = { ...m };
      delete next[key];
      return next;
    });

  return (
    <>
      <div className="rk-chips" role="group" aria-label="스탯 고르기">
        {STAT_KEYS.map((k) => (
          <button key={k} type="button" aria-pressed={stat === k} onClick={() => setStat(k)}>
            {STAT_LABELS[k].name}
          </button>
        ))}
      </div>
      {!loaded ? (
        <Loading label={`${STAT_LABELS[stat].name} 랭킹을 불러오고 있어요`} rows={8} />
      ) : !board ? (
        <div className="row">
          <p className="empty" role="status">
            스탯 랭킹을 불러오지 못했어요. 잠시 뒤에 다시 해 주세요.
          </p>
          <button type="button" className="btn" onClick={retry}>
            다시 불러오기
          </button>
        </div>
      ) : !board.top.length ? (
        <div className="rk-empty">
          <b>
            {day === null ? "아직" : dayName(day, today)} 올라온 {STAT_LABELS[stat].name} 기록이 없어요
          </b>
          <span>프로 무대를 밟은 선수가 은퇴하면 첫 기록이 돼요.</span>
        </div>
      ) : (
        <StatList rows={board.top} stat={stat} mine={mine} />
      )}
      <p className="hint">프로 통산 기록으로 줄을 세워요. 스틸·블록·3점슛은 이 랭킹이 생긴 뒤 은퇴한 기록부터 세요.</p>
    </>
  );
}

function useMine() {
  const [mine, setMine] = useState<MyRanks | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void fetchMine().then((m) => {
      if (live) setMine(m);
    });
    return () => {
      live = false;
    };
  }, []);
  return mine;
}

export function RankingsScreen() {
  const tab = useSyncExternalStore(subscribeHash, readTab, () => "best5" as Tab);
  const [pos, setPos] = useState<PosKey>("PG");
  const [pick, setPick] = useState<DayPick>(0);
  const today = useSyncExternalStore(subscribeNever, readToday, () => "");
  const days = today ? daysBack(today) : [];
  const day: BoardDay = pick === "all" ? null : (days[pick] ?? null);
  const { hall, endings } = useGame();
  const mine = useMine();
  const pending = useSyncExternalStore(
    subscribeNever,
    () => pendingKey(),
    () => "",
  );
  // 하이드레이션 중에는 탭이 서버 기본값(베스트 5)이라, 주소의 탭을 읽은 뒤에 불러와요.
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const all = useBoard("all", day, hydrated && (tab === "best5" || tab === "ranking"));
  const byPos = useBoard(pos, day, hydrated && tab === "position");
  const myIds = new Set((mine?.careers ?? []).map((c) => c.id));

  // 베스트 5와 랭킹 100은 전체 순위표에, 포지션별 랭킹은 고른 포지션 순위표에 들어 있어요.
  const shown = tab === "position" ? byPos : all;
  const failed = shown.loaded && !shown.board;

  return (
    <>
      <header className="top">
        <Link className="brand" href="/">
          <span className="ball" aria-hidden="true" />
          <span>농구 선수 키우기</span>
        </Link>
        <Link className="rk-back" href="/">
          <span aria-hidden="true">←</span>
          <span>게임으로</span>
        </Link>
      </header>
      <main className="rk">
        <div className="rk-head">
          <h1>랭킹</h1>
          <p className="hint">
            NBA MVP·파이널 MVP·리그 MVP·우승 반지·수상과 통산 기록, 최고 오버롤을 종합해 순위를 매겨요. NBA에서 쌓은 기록을 더 크게
            쳐요. 날짜를 고르면 그날 올라온 기록끼리, 올타임은 모든 기록으로 겨뤄요.
          </p>
        </div>
        <div className="rk-tabs" role="tablist">
          {TABS.map(([k, name]) => (
            <a key={k} href={`#${k}`} role="tab" id={`rk-tab-${k}`} aria-selected={tab === k} aria-controls="rk-panel">
              {name}
            </a>
          ))}
        </div>
        <section className="rk-panel" role="tabpanel" id="rk-panel" aria-labelledby={`rk-tab-${tab}`}>
          {tab !== "mine" && hydrated && <DayChips days={days} pick={pick} onPick={setPick} />}
          {tab === "mine" ? (
            <MyRecords hall={hall} mine={mine} pending={new Set(pending ? pending.split("\n") : [])} endings={new Set(endings)} />
          ) : tab === "stats" ? (
            hydrated && <StatsPanel mine={myIds} day={day} today={today} />
          ) : (
            <>
              {tab === "position" && (
                <div className="rk-chips" role="group" aria-label="포지션 고르기">
                  {POS_KEYS.map((p) => (
                    <button key={p} type="button" aria-pressed={pos === p} onClick={() => setPos(p)}>
                      {p} <span>{POS[p].name}</span>
                    </button>
                  ))}
                </div>
              )}
              {!shown.loaded ? (
                <Loading label="순위표를 불러오고 있어요" rows={tab === "best5" ? 5 : 8} />
              ) : failed ? (
                <div className="row">
                  <p className="empty" role="status">
                    온라인 랭킹을 불러오지 못했어요. 잠시 뒤에 다시 해 주세요.
                  </p>
                  <button type="button" className="btn" onClick={shown.retry}>
                    다시 불러오기
                  </button>
                </div>
              ) : !shown.board!.top.length ? (
                <div className="rk-empty">
                  <b>
                    {tab === "position"
                      ? `${dayName(day, today)}${POS[pos].name}(${pos})로 올라온 기록이 ${day === null ? "아직 " : ""}없어요`
                      : day === null
                        ? "아직 올라온 기록이 없어요"
                        : `${dayName(day, today)}올라온 기록이 없어요`}
                  </b>
                  <span>프로 무대를 밟은 선수가 은퇴하면 첫 기록이 돼요.</span>
                </div>
              ) : tab === "best5" ? (
                <BestFiveCourt best5={shown.board!.best5} mine={myIds} />
              ) : (
                <RankingList rows={shown.board!.top} byPos={tab === "position"} mine={myIds} />
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}

/** 대기 중인 커리어 id를 한 줄씩 이은 문자열 (useSyncExternalStore가 같은 값이면 다시 그리지 않게요) */
function pendingKey(): string {
  return [...pendingIds()].join("\n");
}
