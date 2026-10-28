/* 검색 엔진·링크 미리보기에 쓰는 사이트 정보. 메타데이터, sitemap, robots, 매니페스트가 함께 써요. */

export const SITE_URL = "https://www.bench2ring.com";
export const SITE_NAME = "농구 선수 키우기";
export const SITE_SUB = "벤치 뎁혀 반지 굽기";
export const SITE_TITLE = `${SITE_NAME} · ${SITE_SUB}`;
export const SITE_DESCRIPTION =
  "고교 벤치 멤버로 시작해 대학, KBL과 NBA를 거쳐 MVP와 우승 반지에 도전하는 무료 웹 농구 커리어 게임. 설치 없이 브라우저에서 바로 플레이해요.";
/** app/opengraph-image.tsx가 만드는 이미지. 페이지에서 openGraph를 새로 지정하면 이어지지 않아서 직접 붙일 때 써요. */
export const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: SITE_TITLE };
export const SITE_KEYWORDS = [
  "농구 선수 키우기",
  "벤치 뎁혀 반지 굽기",
  "농구 게임",
  "농구 커리어 게임",
  "농구 육성 게임",
  "웹 게임",
  "브라우저 게임",
  "KBL",
  "NBA",
  "MVP",
];

/** 상단 '커피' 버튼의 후원 계좌. 계좌번호를 비워 두면 버튼을 숨기고, 예금주를 비워 두면 그 줄을 숨겨요. */
export const SUPPORT_ACCOUNT = {
  bank: "카카오뱅크",
  number: "3333-15-9891019",
  holder: "",
};
