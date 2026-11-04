/**
 * 게임 엔진의 공개 API. 화면(React)과 독립된 순수 TypeScript예요.
 * 엔진 함수는 Career 객체를 직접 바꾸니, 화면에서는 복사본에 적용하세요.
 */
export * from "./core/types";
export * from "./core/data";
export * from "./world/leagues";
export * from "./player/players";
export {
  archetypeOf,
  bodyOf,
  startCap,
  generateCandidate,
  generateCandidates,
  createCareer,
  HOME_NATION,
  NAME_MAX,
  START_OVR,
  START_MIN,
  START_CAP,
  SPIKE_CAP,
} from "./player/create";
export { CRITICAL_HEALTH, injuryKind, simulateSeason, startSeason, stepSeason, seasonProgress, type SeasonStep } from "./season/season";
export { draftSlot } from "./world/draft";
export { NATIONS, NAT_EVENTS, natColor, natEventFor, simulateTournament, teamPower } from "./world/national";
export { ARMY, ENLIST_DEADLINE, SANGMU, militaryDecision, militaryUnit, owesService } from "./world/military";
export { chooseOption, applyAction } from "./season/actions";
export {
  INVESTMENTS,
  INVEST_SLOTS,
  INVEST_OFFER,
  STUDENT_ALLOWANCE,
  canInvest,
  chosenInvest,
  investCost,
  investLineup,
  investPerks,
  type Investment,
} from "./economy/invest";
export { buyoutCost, canRequestTransfer, currentDecision, leverage, negotiable, requestTransfer, resolveQueue } from "./season/decisions";
export {
  DONATIONS,
  DONATION_LUCK,
  SHOP,
  SHOP_SIZE,
  boughtThisSeason,
  buy,
  canBuy,
  canDonate,
  describeDonationReward,
  donate,
  donatedThisSeason,
  ownedItems,
  owns,
  shopItem,
  shopLineup,
  type ShopCategory,
  type ShopItem,
} from "./economy/shop";
export {
  awardGroups,
  leagueShares,
  careerJourney,
  careerSummary,
  retire,
  canRetire,
  legacyOf,
  sumSeasons,
  titleHistory,
  type AwardCount,
  type AwardGroups,
  type CareerTotals,
  type SeasonTotals,
  type JourneyStep,
  type TitleEntry,
} from "./career/career";
export { LEAGUE_WEIGHT, SCORE_AWARDS, SCORE_CAP, SCORE_NBA, SCORE_OTHER, bestFive, compareCareers, playedNba, rankHall, rankScore, scoreParts, type ScoreParts } from "./legacy/hall";
export { COMPS, careerProfile, similarPlayers, type CompLeague, type CompMatch, type CompPlayer, type CompProfile } from "./legacy/comps";
export { namuWikiUrl } from "./legacy/namu";
export {
  RECORD_BOARDS,
  RECORD_GROUPS,
  careerTotals,
  recordBoardsFor,
  placeOnBoard,
  type BoardPlacement,
  type BoardRow,
  type RecordBoard,
  type RecordGroup,
  type RecordStat,
  type RecordTotals,
} from "./legacy/records";
export {
  ovr,
  ovrOf,
  evalOvr,
  evalOvrOf,
  isCoreAttr,
  roleOf,
  expectedMinutes,
  currentExpectedMinutes,
  stageLabel,
} from "./player/ratings";
export { fmtNum, josa, money, r1, ro, stripYear } from "./core/util";
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
} from "./player/specialty";
export { setRandom, resetRandom, seeded, shuffle } from "./core/random";
