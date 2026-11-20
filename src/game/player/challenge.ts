import { chance, pick, ri, seeded, seededPick, withRandom } from "../core/random";
import type { Candidate, ChallengeTag, PosKey } from "../core/types";
import { hsSchools } from "../world/leagues";
import { NATIONS } from "../world/national";
import { HOME_NATION, generateCandidate } from "./create";
import { ARCHETYPES } from "./players";

/*
 * 챌린지 모드: 날짜와 포지션이 같으면 누구에게나 같은 선수가 나와요.
 * 플레이 유형·시작 능력치·키·윙스팬·잠재력·숨겨진 특성과 국적·고등학교까지 그날 정해져 있고, 이름·등번호·캐릭터만 골라요.
 * 시작한 뒤의 시즌은 평소처럼 무작위예요. 같은 선수로 누가 더 잘 키우는지 겨뤄요.
 */

/** 그날 그 포지션의 챌린지 선수 */
export interface DailyChallenge extends ChallengeTag {
  /** 국적 (NATIONS의 이름) */
  nat: string;
  /** 고등학교 (국적의 hsSchools 이름) */
  school: string;
  cand: Candidate;
}

/**
 * 시드 앞머리. 같은 날짜·포지션에 다른 선수가 나오게 규칙을 바꾸면 숫자를 올려요.
 * 선수 생성 규칙(generateCandidate, 플레이 유형, 국가·학교 목록)을 바꿔 배포하면 그날 챌린지 선수도 달라져요.
 */
const SEED_PREFIX = "b2r-challenge-v1";

/** 챌린지 선수가 대한민국 국적일 확률. 나머지는 다른 나라 가운데 고르게 나와요. */
const HOME_SHARE = 0.5;

const made = new Map<string, DailyChallenge>();

/**
 * 그날(`YYYY-MM-DD`) 그 포지션의 챌린지 선수. 날짜와 포지션으로 만든 시드 난수로 뽑아서 언제 어디서 불러도 같아요.
 * 게임 난수 흐름은 건드리지 않아요. 돌려준 값은 함께 쓰니 고치지 마세요.
 */
export function dailyChallenge(day: string, pos: PosKey): DailyChallenge {
  const key = `${day}:${pos}`;
  const hit = made.get(key);
  if (hit) return hit;
  const seed = Math.floor(seededPick(`${SEED_PREFIX}:${key}`)() * 2 ** 32);
  const spec = withRandom(seeded(seed), (): DailyChallenge => {
    const cand = generateCandidate(pos, ri(0, ARCHETYPES[pos].length - 1));
    const nat = chance(HOME_SHARE) ? HOME_NATION : pick(NATIONS.filter((n) => n.name !== HOME_NATION)).name;
    const school = pick(hsSchools(nat))[0];
    return { day, pos, nat, school, cand };
  });
  made.set(key, spec);
  return spec;
}
