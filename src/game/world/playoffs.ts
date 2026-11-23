import type { LeagueKey } from "../core/types";
import { LEAGUES } from "./leagues";

/* 플레이오프(전국대회) 라운드 이름. 시즌 진행과 지난 시즌 팀 성적이 함께 써요. */

/** 리그별 결승 이름 */
export const FINAL_NAME: Record<LeagueKey, string> = {
  nba: "NBA 파이널",
  kbl: "KBL 챔피언결정전",
  euro: "유로리그 파이널 포 결승",
  gleague: "G리그 파이널",
  ncaa: "NCAA 토너먼트 결승",
  kuniv: "U-리그 챔피언결정전",
  hs: "전국대회 결승",
  bleague: "B.리그 파이널",
  cba: "CBA 챔피언결정전",
  pba: "PBA 파이널",
  nbl: "NBL 그랜드 파이널",
  aba: "ABA 리그 파이널",
  lnb: "LNB 파이널",
  acb: "ACB 파이널",
  juniv: "인칼레 결승",
  uaap: "UAAP 파이널",
  cubal: "CUBAL 전국대회 결승",
  usports: "U 스포츠 파이널 8 결승",
  cebl: "CEBL 파이널",
};

/**
 * 플레이오프 라운드 이름과, 그 라운드에서 졌을 때의 시즌 성적. NBA는 실제처럼 컨퍼런스를 거치는 4라운드예요.
 * lose의 마지막은 결승에서 진 경우예요.
 */
export function playoffRounds(lg: LeagueKey): { names: string[]; lose: string[] } {
  if (lg === "nba")
    return {
      names: ["플레이오프 1라운드", "컨퍼런스 세미파이널", "컨퍼런스 파이널", FINAL_NAME.nba],
      lose: ["플레이오프 1라운드", "컨퍼런스 세미파이널", "컨퍼런스 파이널", "파이널 준우승"],
    };
  if (!LEAGUES[lg].pro)
    return { names: ["전국대회 8강", "전국대회 4강", FINAL_NAME[lg]], lose: ["전국대회 8강", "전국대회 4강", "전국대회 준우승"] };
  if (lg === "kbl")
    return { names: ["6강 플레이오프", "4강 플레이오프", FINAL_NAME.kbl], lose: ["6강 플레이오프", "4강 플레이오프", "챔피언결정전 준우승"] };
  return { names: ["플레이오프 1라운드", "플레이오프 4강", FINAL_NAME[lg]], lose: ["플레이오프 1라운드", "플레이오프 4강", "챔피언결정전 준우승"] };
}
