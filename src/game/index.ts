/**
 * 게임 엔진의 공개 API. 화면(React)과 독립된 순수 TypeScript예요.
 * 엔진 함수는 Career 객체를 직접 바꾸니, 화면에서는 복사본에 적용하세요.
 */
export * from "./types";
export * from "./data";
export * from "./leagues";
export * from "./players";
export {
  archetypeOf,
  bodyOf,
  startCap,
  generateCandidate,
  generateCandidates,
  createCareer,
  HOME_NATION,
  START_OVR,
  START_MIN,
  START_CAP,
  SPIKE_CAP,
} from "./create";
export { CRITICAL_HEALTH, injuryKind, simulateSeason, startSeason, stepSeason, seasonProgress, type SeasonStep } from "./season";
export { draftSlot } from "./draft";
export { NATIONS, NAT_EVENTS, natColor, natEventFor, simulateTournament, teamPower } from "./national";
export { ARMY, ENLIST_DEADLINE, SANGMU, militaryDecision, militaryUnit, owesService } from "./military";
export { chooseOption, applyAction } from "./actions";
export { INVESTMENTS, INVEST_SLOTS, STUDENT_ALLOWANCE, canInvest, investCost, type Investment } from "./invest";
export { buyoutCost, canRequestTransfer, currentDecision, leverage, negotiable, requestTransfer, resolveQueue } from "./decisions";
export {
  DONATIONS,
  SHOP,
  SHOP_SIZE,
  boughtThisSeason,
  buy,
  canBuy,
  canDonate,
  donate,
  ownedItems,
  owns,
  shopItem,
  shopLineup,
  type ShopCategory,
  type ShopItem,
} from "./shop";
export {
  careerJourney,
  careerSummary,
  retire,
  canRetire,
  legacyOf,
  sumSeasons,
  titleHistory,
  type CareerTotals,
  type JourneyStep,
  type TitleEntry,
} from "./career";
export { SCORE_AWARDS, SCORE_NBA, SCORE_OTHER, bestFive, compareCareers, playedNba, rankHall, rankScore, scoreParts, type ScoreParts } from "./hall";
export { COMPS, careerProfile, similarPlayers, type CompLeague, type CompMatch, type CompPlayer, type CompProfile } from "./comps";
export {
  RECORD_BOARDS,
  RECORD_GROUPS,
  careerTotals,
  placeOnBoard,
  type BoardPlacement,
  type BoardRow,
  type RecordBoard,
  type RecordGroup,
  type RecordStat,
} from "./records";
export {
  ovr,
  ovrOf,
  evalOvr,
  evalOvrOf,
  isCoreAttr,
  roleOf,
  expectedMinutes,
  currentExpectedMinutes,
  potentialRange,
  stageLabel,
} from "./ratings";
export { fmtNum, josa, money, r1, ro, stripYear } from "./util";
export {
  BONUS_CAP,
  PAIR_FLOOR,
  PAIR_GAP,
  SMART_FLOOR,
  SMART_GAP,
  SPECIALTIES,
  specialtiesOf,
  specialtyBonus,
  type Specialty,
  type SpecialtyHit,
  type SpecialtyKey,
} from "./specialty";
export { setRandom, resetRandom, seeded } from "./random";
