import { courtDraftScore, courtPick, gblDraftScore, gblPick, undrafted } from "./decisions";
import { addNews, pickTeam, setTeam } from "./log";
import { rnd } from "./random";
import type { Career } from "./types";
import { clamp, r1 } from "./util";

/** 드래프트를 열어요. 지명되면 프로 계약, 아니면 미지명 결정을 대기열 맨 앞에 넣어요. */
export function runDraft(c: Career, draft: "gbl" | "court"): void {
  const yr = c.year - 1;
  const tag = `${yr} 드래프트`;
  const gbl = draft === "gbl";
  const pick = gbl ? gblPick(gblDraftScore(c, rnd(-3, 3))) : courtPick(courtDraftScore(c, rnd(-3, 3)));
  const size = gbl ? 60 : 20;
  const roundSize = size / 2;
  const leagueName = gbl ? "GBL" : "코트리그";

  if (pick > size) {
    addNews(c, tag, "bad", `${leagueName} 드래프트에서 이름이 불리지 않았어요.`);
    c.stage = "free";
    c.team = null;
    c.contract = null;
    c.queue.unshift(undrafted(c));
    return;
  }

  const lg = gbl ? "gbl" : "court";
  const t = pickTeam(lg);
  // 상위 지명일수록 약팀에 가요.
  t.q = clamp((gbl ? 0.26 : 0.28) + (pick / size) * (gbl ? 0.34 : 0.3) + rnd(-0.05, 0.05), 0.2, 0.75);
  const firstRound = pick <= roundSize;
  const inRound = firstRound ? pick : pick - roundSize;
  c.stage = "pro";
  c.contract = gbl
    ? { years: firstRound ? 4 : 2, salary: firstRound ? Math.round(30 + (30 - pick) * 4.2) : 15 }
    : { years: 3, salary: firstRound ? r1(2.2 - (pick - 1) * 0.12) : 1 };
  setTeam(c, lg, t);
  c.trust = 0;
  c.draft = { lg: leagueName, pick, round: firstRound ? 1 : 2, inRound, team: t.name, year: yr };
  addNews(c, tag, "big", `${leagueName} 드래프트 ${firstRound ? 1 : 2}라운드 ${inRound}순위로 ${t.name}에 지명됐어요!`);
}
