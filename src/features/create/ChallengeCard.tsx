"use client";

import { Link } from "@/shared/ui/Link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { POS, POS_KEYS, dailyChallenge, fmtNum, type PosKey } from "@/game";
import { challengeLeader } from "@/shared/leaderboard/leader";
import { challengeQuery, myChallengeQuery } from "@/shared/leaderboard/queries";
import { ChallengeGuide } from "@/features/guide/ChallengeGuide";
import { useKstToday, useSeen } from "@/shared/lib/hooks";
import { Panel } from "@/shared/ui/ui";

/** 이날(한국 시간)까지 제목 옆에 NEW를 붙여요. 챌린지 모드가 나오고 두 주예요. */
const NEW_UNTIL = "2026-12-04";

/**
 * 첫 화면의 '오늘의 챌린지': 오늘(한국 시간) 포지션마다 정해진 선수와 지금 1위의 이름, 도전한 사람 수, 내 순위를 보여줘요.
 * 포지션을 누르면 그 선수로 선수 만들기(캐릭터 → 오늘의 선수 → 이름)를 시작해요.
 * 순위표를 못 불러와도 선수는 브라우저에서 날짜로 정해져서 도전할 수 있어요.
 * 첫 화면에서 가장 눈에 띄게 강조색 테두리로 그리고, '챌린지 모드란'을 누르면 도움말(ChallengeGuide)을 띄워요.
 */
export function ChallengeCard({ onPick }: { onPick: (pos: PosKey) => void }) {
  const today = useKstToday();
  // 도전자 수와 내 순위는 카드가 화면 가까이 왔을 때 불러요.
  const [cardRef, seen] = useSeen<HTMLElement>();
  const board = useQuery({ ...challengeQuery(today), enabled: seen && !!today }).data;
  const mine = useQuery({ ...myChallengeQuery(today), enabled: seen && !!today }).data;
  const [help, setHelp] = useState(false);
  if (!today) return null;

  return (
    <Panel ref={cardRef} className="ch-card">
      <div className="ch-head">
        <span className="label">
          {Number(today.slice(5, 7))}월 {Number(today.slice(8))}일 · 매일 0시(한국 시간)에 바뀌어요
        </span>
        <h2 className="sec">
          <span aria-hidden="true">🎯</span> 오늘의 챌린지
          {today <= NEW_UNTIL && <span className="ch-new">NEW</span>}
        </h2>
        <button type="button" className="ch-help" onClick={() => setHelp(true)}>
          <span aria-hidden="true">?</span> 챌린지 모드란
        </button>
      </div>
      <p className="ch-lede">
        오늘은 <b>누구나 포지션마다 같은 선수</b>로 시작해요. 플레이 스타일·능력치·키·잠재력·국적·학교가 모두 같으니, 같은 조건에서 누가 더
        잘 키우는지 겨뤄 보세요.
      </p>
      <div className="ch-grid">
        {POS_KEYS.map((p) => {
          const c = dailyChallenge(today, p);
          const b = board?.boards[p];
          const m = mine?.mine.find((x) => x.pos === p);
          const leader = b && challengeLeader(b);
          return (
            <button type="button" className="ch-pos" key={p} data-mine={m ? "" : undefined} onClick={() => onPick(p)}>
              <span className="p">
                {p} <span>{POS[p].name}</span>
              </span>
              <span className="nm">{c.cand.arch}</span>
              <span className="hint">
                {c.nat} · {c.cand.h}cm
              </span>
              <span className="ch-lead">
                {b ? (
                  <>
                    <span className="r">1위</span>{" "}
                    {leader ? (
                      <>
                        <b>{leader.name}</b>
                        {leader.others > 0 && ` 외 ${fmtNum(leader.others)}명`}
                      </>
                    ) : (
                      "아직 없어요"
                    )}
                  </>
                ) : (
                  " "
                )}
              </span>
              <span className="ch-n">
                {m ? `내 순위 ${fmtNum(m.rank)}위 · ${fmtNum(m.players)}명 중` : b ? (b.players ? `${fmtNum(b.players)}명 도전` : "첫 도전자가 되어 보세요") : " "}
              </span>
              <span className="ch-go">{m ? "다시 도전" : "도전하기"} →</span>
            </button>
          );
        })}
      </div>
      <div className="row">
        <Link className="btn" href="/rankings#challenge">
          챌린지 랭킹 보기
        </Link>
        <span className="hint">은퇴하면 그날 챌린지 랭킹에 올라가요. 몇 번이든 다시 도전할 수 있어요.</span>
      </div>
      {help && <ChallengeGuide onClose={() => setHelp(false)} />}
    </Panel>
  );
}
