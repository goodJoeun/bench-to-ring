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
    id: "2026-10-29-clutch-shop",
    kind: "patch",
    date: "2026.10.29",
    icon: "🔥",
    title: "클러치 연출 · 기부 보답 · 상점 아이콘",
    intro: "클러치 순간이 더 뜨거워지고, 상점과 기부가 바뀌었어요.",
    sections: [
      {
        title: "클러치",
        items: [
          "클러치가 걸리면 번개와 불꽃이 번쩍인 뒤, 실제 상대 팀과 동점 점수가 나오는 4쿼터 0:24 전광판이 떠요.",
          "마지막 플레이를 고르면 성공·실패 연출과 함께 그 상대에게 2점 차로 이기거나 져요.",
          "플레이가 여덟 가지로 늘었고, 매번 그중 세 가지만 나와요. 어떤 능력치가 필요한지는 직접 판단해야 해요.",
          "주전이면 시즌마다 한 번, 에이스면 한두 번 꼭 클러치 상황이 와요.",
        ],
      },
      {
        title: "상점 · 기부",
        items: [
          "상점과 보유 아이템 목록의 모든 상품에 아이콘이 붙었어요.",
          "기부는 금액마다 한 시즌에 한 번 할 수 있어요. 대신 가끔 아이들의 응원에 힘이 나서 건강·경기력·능력치가 오르는 좋은 일이 생겨요.",
        ],
      },
      {
        title: "그 밖에",
        items: [
          "라이벌의 도발 이벤트에 나를 가리키며 비웃는 라이벌 삽화가 생겼어요.",
          "첫 화면 명예의 전당은 오늘 랭킹 Top 5와 오늘의 베스트 5를 보여줘요.",
          "30대 중후반으로 갈수록 능력치가 더 크게 떨어져요.",
          "국가대항전에서 이미 만난 나라를 같은 대회에서 다시 만나던 문제(8강 상대와 준결승에서 또 맞붙는 등)를 고쳤어요.",
        ],
      },
    ],
  },
  {
    id: "2026-10-28-my-endings",
    kind: "patch",
    date: "2026.10.28",
    icon: "🎬",
    title: "내 은퇴 선수 엔딩 다시 보기 · 커피 후원",
    intro: "은퇴한 선수의 엔딩을 첫 화면에서 바로 다시 볼 수 있어요.",
    sections: [
      {
        title: "내 은퇴 선수",
        items: [
          "첫 화면에 '내 은퇴 선수'가 생겼어요. 최근에 은퇴한 선수 5명이 보이고, '엔딩 보기'를 누르면 엔딩과 커리어 회고를 다시 볼 수 있어요.",
          "더 많은 선수는 '모두 보기'를 눌러 랭킹 → 나의 기록에서 볼 수 있어요. 엔딩은 이 브라우저에 최근 20명까지 보관해요.",
        ],
      },
      {
        title: "그 밖에",
        items: ["첫 화면의 명예의 전당은 Top 10까지 보여줘요. 전체 순위는 랭킹 페이지에서 볼 수 있어요.", "상단 메뉴 맨 왼쪽에 개발자 커피 후원 버튼이 생겼어요."],
      },
    ],
  },
  {
    id: "2026-10-28-cover-wizard",
    kind: "patch",
    date: "2026.10.28",
    icon: "🏆",
    title: "새 첫 화면 · 단계별 선수 만들기",
    intro: "첫 화면과 선수 생성 과정을 개편했어요.",
    sections: [
      {
        title: "첫 화면",
        items: [
        "첫 화면으로 게임 표지를 추가했어요."
        ],
      },
      {
        title: "단계별 선수 만들기",
        items: [
          "'커리어 시작하기'를 누르면 캐릭터 → 포지션 → 후보 선수 → 선수 정보 순서로 한 단계씩 정해요.",
          "다음·이전으로 넘길 때 화면이 옆으로 부드럽게 넘어가요. 위의 단계 번호를 눌러 바로 옮길 수도 있어요.",
        ],
      },
    ],
  },
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
