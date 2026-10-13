import { kblDraftScore, kblPick, nbaDraftScore, nbaPick, undrafted } from "./decisions";
import { addNews, pickTeam, setTeam } from "./log";
import { rnd } from "./random";
import type { Career } from "./types";
import { clamp, r1 } from "./util";

/** 드래프트를 열어요. 지명되면 프로 계약, 아니면 미지명 결정을 대기열 맨 앞에 넣어요. */
export function runDraft(c: Career, draft: "nba" | "kbl"): void {
  const yr = c.year - 1;
  const nba = draft === "nba";
  const draftName = nba ? "NBA 드래프트" : "KBL 신인드래프트";
  const tag = `${yr} ${draftName}`;
  const pick = nba ? nbaPick(nbaDraftScore(c, rnd(-3, 3))) : kblPick(kblDraftScore(c, rnd(-3, 3)));
  const size = nba ? 60 : 20;
  const roundSize = size / 2;

  if (pick > size) {
    addNews(c, tag, "bad", `${draftName}에서 이름이 불리지 않았어요.`);
    c.stage = "free";
    c.team = null;
    c.contract = null;
    c.queue.unshift(undrafted(c));
    return;
  }

  const t = pickTeam(draft);
  // 상위 지명일수록 약팀에 가요.
  t.q = clamp((nba ? 0.26 : 0.28) + (pick / size) * (nba ? 0.34 : 0.3) + rnd(-0.05, 0.05), 0.2, 0.75);
  const firstRound = pick <= roundSize;
  const inRound = firstRound ? pick : pick - roundSize;
  c.stage = "pro";
  // NBA 1라운드는 루키 스케일 4년(1순위 약 150억), 2라운드는 최저 연봉 2년이에요.
  c.contract = nba
    ? { years: firstRound ? 4 : 2, salary: firstRound ? Math.round(30 + (30 - pick) * 4.2) : 17 }
    : { years: 3, salary: firstRound ? r1(1.2 - (pick - 1) * 0.05) : 0.7 };
  setTeam(c, draft, t);
  c.trust = 0;
  c.draft = { lg: nba ? "NBA" : "KBL", pick, round: firstRound ? 1 : 2, inRound, team: t.name, year: yr };
  addNews(c, tag, "big", `${draftName} ${firstRound ? 1 : 2}라운드 ${inRound}순위로 ${t.name}에 지명됐어요!`);
}
