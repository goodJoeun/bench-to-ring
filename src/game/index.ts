/**
 * 게임 엔진의 공개 API. 화면(React)과 독립된 순수 TypeScript예요.
 * 엔진 함수는 Career 객체를 직접 바꾸니, 화면에서는 복사본에 적용하세요.
 */
export * from "./types";
export * from "./data";
export { archetypeOf, generateCandidate, generateCandidates, createCareer, START_OVR, START_TOTAL } from "./create";
export { simulateSeason } from "./season";
export { NAT_EVENTS, natColor, natEventFor, simulateTournament, teamPower } from "./national";
export { ARMY, ENLIST_DEADLINE, SANGMU, militaryDecision, owesService } from "./military";
export { chooseOption, applyAction } from "./actions";
export { currentDecision, resolveQueue } from "./decisions";
export { careerSummary, retire, canRetire, legacyOf, titleHistory, type TitleEntry } from "./career";
export { rankHall, bestFive, compareCareers } from "./hall";
export {
  RECORD_BOARDS,
  RECORD_GROUPS,
  careerTotals,
  placeOnBoard,
  type BoardPlacement,
  type BoardRow,
  type CareerTotals,
  type RecordBoard,
  type RecordGroup,
  type RecordStat,
} from "./records";
export {
  ovr,
  ovrOf,
  roleOf,
  expectedMinutes,
  currentExpectedMinutes,
  potentialRange,
  stageLabel,
} from "./ratings";
export { money, r1 } from "./util";
export { setRandom, resetRandom, seeded } from "./random";
