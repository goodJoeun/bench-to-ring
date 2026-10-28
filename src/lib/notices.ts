/* 상단 '공지'에 띄우는 패치노트와 공지사항. 새 글은 맨 위에 넣어요. 읽은 글은 이 브라우저에 저장해요. */

import { useMemo, useSyncExternalStore } from "react";

export type NoticeKind = "patch" | "notice";

export const NOTICE_KIND_NAME: Record<NoticeKind, string> = { patch: "패치노트", notice: "공지" };

export interface Notice {
  /** 읽음 표시에 쓰니 한 번 정하면 바꾸지 않아요. */
  id: string;
  kind: NoticeKind;
  /** 2026.10.28 */
  date: string;
  icon: string;
  title: string;
  /** 상세 보기 맨 위의 한두 문장 */
  intro?: string;
  sections: { title: string; items: string[] }[];
}

export const NOTICES: Notice[] = [
  {
    id: "2026-10-28-daily-rankings",
    kind: "patch",
    date: "2026.10.28",
    icon: "📅",
    title: "날짜별 랭킹 · 올타임 랭킹",
    intro: "랭킹을 날짜별로 볼 수 있어요.",
    sections: [
      {
        title: "날짜별 랭킹",
        items: [
          "베스트 5·랭킹 100·포지션별 랭킹·스탯 랭킹 위에 오늘·어제부터 일주일 날짜 칩이 생겼어요.",
          "날짜를 고르면 그날(한국 시간) 은퇴해 올라온 기록끼리 순위를 매겨요.",
          "맨 끝의 '올타임(역대)'를 고르면 지금까지 올라온 모든 기록의 순위를 볼 수 있어요.",
        ],
      },
    ],
  },
  {
    id: "2026-10-28-kbl-playoffs",
    kind: "patch",
    date: "2026.10.28",
    icon: "🏀",
    title: "KBL 플레이오프 4강 직행",
    intro: "KBL 플레이오프를 실제 방식처럼 바꿨어요.",
    sections: [
      {
        title: "KBL 플레이오프",
        items: [
          "라운드 이름이 6강 플레이오프 → 4강 플레이오프 → KBL 챔피언결정전으로 바뀌었어요.",
          "정규리그 1·2위 팀은 6강을 건너뛰고 4강 플레이오프로 직행해요. 승률이 높을수록 1·2위에 들기 쉬워요.",
          "4강에 직행하면 시즌 소식에 '4강 플레이오프 직행'이 떠요.",
        ],
      },
    ],
  },
  {
    id: "2026-10-28-character-nationality",
    kind: "patch",
    date: "2026.10.28",
    icon: "🎨",
    title: "캐릭터 고르기 · 국적 선택 · 기자회견",
    intro: "선수를 만들 때 캐릭터와 국적을 직접 고를 수 있어요.",
    sections: [
      {
        title: "캐릭터 고르기",
        items: [
          "선수 생성에서 캐릭터를 먼저 고르고 포지션을 골라요.",
          "피부색·얼굴·머리 모양(12가지)·머리색·눈동자·수염·헤어밴드를 무작위로 조합한 캐릭터 24명 중에서 골라요.",
          "칸마다 유니폼 색을 무작위로 입혀 보여줘요. 커리어에서는 소속팀 색을 입어요.",
          "'다른 캐릭터 보기'로 새로 뽑아도 고른 캐릭터는 맨 앞에 남아요.",
          "선수 그림이 도트에서 매끈한 그림으로 바뀌었어요. 예전에 만든 선수와 랭킹 기록은 피부색에 가장 가까운 모습으로 보여줘요.",
        ],
      },
      {
        title: "국적 선택",
        items: [
          "대한민국, 일본, 필리핀, 중국, 호주, 캐나다, 미국, 프랑스, 스페인, 세르비아 중에서 고를 수 있어요.",
          "국적에 따라 나가는 국가대표 대회가 달라지고, 대표팀 수준이 높을수록 뽑히는 데 더 높은 실력이 필요해요.",
          "병역 의무는 대한민국 선수만 져요.",
        ],
      },
      {
        title: "기자회견 이벤트",
        items: [
          "대학·프로 시즌 중에 무작위로 기자회견이 열려요.",
          "팀 성적이 좋으면 우승 후보 질문, 나쁘면 부진 원인 질문, 그 밖에는 짓궂은 질문이 나와요. 답에 따라 경기력과 코치 신뢰가 바뀌어요.",
        ],
      },
      {
        title: "올림픽 최종예선",
        items: [
          "최종예선 상대가 조별리그 약체 → 준결승 중위권 → 결승 상위권 순으로 강해져요.",
          "대한민국도 에이스가 있으면 가끔 올림픽 본선에 나갈 수 있어요.",
        ],
      },
    ],
  },
];

const READ_KEY = "b2r-notices-read";
const listeners = new Set<() => void>();

function readRaw(): string {
  try {
    return localStorage.getItem(READ_KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  // 다른 탭에서 읽어도 같이 바뀌어요.
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

/** 서버에서 그릴 때는 모두 읽은 것으로 쳐서 빨간 점이 번쩍이지 않게 해요. */
const ALL_READ = NOTICES.map((n) => n.id).join(",");

/** 읽은 공지 id 모음 */
export function useReadNotices(): Set<string> {
  const raw = useSyncExternalStore(subscribe, readRaw, () => ALL_READ);
  return useMemo(() => new Set(raw.split(",").filter(Boolean)), [raw]);
}

export function markNoticeRead(id: string): void {
  const read = new Set(readRaw().split(",").filter(Boolean));
  if (read.has(id)) return;
  read.add(id);
  try {
    // 지금 목록에 있는 글만 남겨서 저장 값이 끝없이 늘지 않게 해요.
    localStorage.setItem(READ_KEY, NOTICES.filter((n) => read.has(n.id)).map((n) => n.id).join(","));
  } catch {
    // 저장이 막힌 브라우저에서는 빨간 점이 계속 남아요.
  }
  listeners.forEach((fn) => fn());
}
