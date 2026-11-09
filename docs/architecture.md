# 파일 구조

이 문서는 `src/`의 폴더 구조와 폴더 사이의 의존 규칙을 정리해요. 새 파일을 어디에 둘지 헷갈릴 때 보세요.

## 고른 구조: 기능 중심(feature-based) + 순수 엔진 분리

이 프로젝트는 세 덩어리로 나뉘어요.

- **게임 엔진**: 규칙과 시뮬레이션. React도 브라우저도 모르는 순수 TypeScript예요.
- **화면**: 선수 생성 → 커리어 → 은퇴 → 랭킹처럼 기능 단위로 나뉜 React 컴포넌트예요.
- **서버**: 온라인 랭킹용 DB와 API예요.

이 모양에는 **기능 중심 구조**(feature-based / vertical slice)가 가장 잘 맞아서 그 구조를 골랐어요. 게임 엔진은 따로 떼어 도메인 계층으로 둬요.

| 후보 | 고르지 않은 이유 |
|---|---|
| 종류별 구조 (`components/` · `hooks/` · `utils/`) | 한 기능을 고치려면 여러 폴더를 오가야 해요. 예전 `components/common/`처럼 "공통" 폴더가 끝없이 커져요. |
| 클린 아키텍처 / 헥사고날 | 서버가 작아서(테이블 2개, API 7개) 포트·어댑터 계층은 짐만 늘어요. |
| Feature-Sliced Design 전체 | `entities`·`widgets`·`pages`까지 나누기엔 화면 수가 적어요. 핵심 규칙(계층과 한 방향 의존)만 가져왔어요. |

기능 중심 구조를 고른 이유는 이래요.

- 화면이 기능 단위로 또렷하게 나뉘어요 (생성, 커리어, 진행 팝업, 은퇴, 랭킹, 공지…).
- 한 기능을 고칠 때 한 폴더만 보면 돼요.
- 엔진은 서버(기록 검사, 랭킹 점수)와 밸런스 스크립트도 그대로 쓰니까, 화면과 떨어진 도메인 계층으로 두는 게 맞아요.

## 폴더 한눈에 보기

```
src/
├─ app/          라우트만: 페이지, 레이아웃, Route Handler, 메타데이터, 전역 스타일
├─ features/     화면 기능. 기능마다 폴더 하나
├─ shared/       여러 기능이 같이 쓰는 UI·도우미·상태·API 클라이언트
├─ game/         게임 엔진 (순수 TypeScript). 관심사별 하위 폴더
└─ server/       서버 전용 코드 (DB, 인증, 랭킹 조회·저장)
```

### 의존 방향

화살표 방향으로만 가져와요. 거꾸로 가져오면 안 돼요.

```
app ──▶ features ──▶ shared ──▶ game
 │                     ▲         ▲
 └──▶ server ──────────┴─────────┘
```

- `game`은 아무것도 가져오지 않아요 (`@/shared`, `@/features`, `@/server`, React 모두 안 돼요).
- `shared`는 `game`만 가져와요. 기능(`features`)을 가져오면 안 돼요.
- `server`는 `game`과 `shared/leaderboard`(API 타입·날짜 규칙)만 가져와요. 화면 코드는 가져오지 않아요.
- `features`는 `shared`와 `game`을 가져와요. 다른 기능은 화면을 끼워 넣을 때만 가져와요 (아래 "기능끼리 가져오기").
- `app`은 화면이면 `features`의 최상위 화면을, API면 `server`를 불러요. 로직을 직접 두지 않아요.

### 기능끼리 가져오기

지금 허용하는 건 이것뿐이에요.

| 가져오는 쪽 | 가져오는 것 | 이유 |
|---|---|---|
| `shell` | 모든 화면과 창 | 화면 전환 루트예요 |
| `create`, `career`, `retired` | `hall-of-fame/HallOfFame` | 명예의 전당을 세 화면에 끼워 넣어요 |
| `retired` | `career/tabs/RecordTab`의 `SeasonTable` | 은퇴 화면에도 시즌별 기록 표를 보여줘요 |

화면이 아닌 도우미(함수, 상수, 그림 그리기)를 두 기능 이상이 쓰게 되면 `shared`로 옮겨요. 그래서 표지 그림(`coverArt.ts`)과 기록 캐릭터(`look.ts`)는 `shared/ui/sprite/`에 있어요.

## 폴더별 설명

### `app/`: 라우트

Next.js App Router의 파일 규칙(`page.tsx`, `layout.tsx`, `route.ts`, `opengraph-image.tsx` 등)만 둬요.

- `page.tsx`: 게임 (`features/shell/Game`)
- `rankings/page.tsx`: 랭킹 (`features/rankings/RankingsScreen`)
- `api/**/route.ts`: 요청을 읽고 `server/`를 불러 응답만 만들어요.
- `globals.css`: 전역 스타일. 아직 한 파일이에요 (아래 "남은 일").

### `features/`: 화면 기능

| 폴더 | 하는 일 |
|---|---|
| `shell/` | `Game.tsx`: 화면 전환(생성 / 커리어 / 은퇴), 상단 메뉴, 진행 팝업과 창 띄우기 |
| `create/` | 첫 화면(표지)과 단계별 선수 생성 |
| `career/` | 커리어 진행 화면. `tabs/`에 시즌 · 기록 · 트로피 · 설정 탭 |
| `progress/` | 진행 팝업 (시즌 순위표, 국가대표 대회, 드래프트, 결승 중계, 응원, 은퇴 회고) |
| `retired/` | 은퇴 화면, 역대 기록 순위, 닮은 꼴 선수, 기록 카드 공유 |
| `rankings/` | 랭킹 페이지 (베스트 5, 랭킹 100, 포지션별, 스탯 랭킹, 나의 기록) |
| `hall-of-fame/` | 명예의 전당 (내 기기 기록과 온라인 순위) |
| `notice/` | 공지 창과 알림, 공지 글 목록 `notices.ts` (새 글은 맨 위에) |
| `achievements/` | 업적 창 (이 브라우저에서 딴 업적과 힌트, 누적 기록 진행도). 업적 목록과 판정은 엔진의 `legacy/achievements.ts` |
| `feedback/` · `guide/` · `settings/` · `support/` | 의견 보내기, 게임 안내(설정에서 열어요), 설정, 커피 후원 창 |

한 기능만 쓰는 상수나 도우미는 그 기능 폴더에 둬요 (예: `create/options.ts`, `retired/careerCard.ts`).

### `shared/`: 같이 쓰는 것

| 폴더 | 내용 |
|---|---|
| `ui/` | `ui.tsx`(Panel, StatTiles, Choice…), `Sheet.tsx`, `Toast.tsx` |
| `ui/sprite/` | Canvas 선수 캐릭터 `Sprite.tsx`, 표지 그림 `coverArt.ts`, 기록의 캐릭터·유니폼 `look.ts` |
| `ui/badge/` | `TeamBadge.tsx`(국기·로고·엠블럼), `emblem.ts`, 만든 파일 `logos.generated.ts`·`flags.generated.ts` |
| `lib/` | 공통 문구와 색 `format.ts`, 훅 `hooks.ts`, 사이트 정보 `site.ts`, 테마 `theme.ts` |
| `store/` | `game-store.ts`: 화면과 엔진을 잇는 상태 저장소 (useSyncExternalStore) |
| `leaderboard/` | 랭킹 API 타입 `types.ts`, 날짜 규칙 `days.ts`, 브라우저 클라이언트 `client.ts` |

`shared/leaderboard/`의 `types.ts`와 `days.ts`는 화면과 서버가 함께 쓰는 약속이라, 브라우저 전용 코드나 서버 전용 코드를 넣지 않아요. `client.ts`는 브라우저에서만 써요.

### `game/`: 게임 엔진

밖에서는 `@/game`(= `index.ts`)으로만 가져와요. 하위 파일을 직접 가져오는 건 엔진 테스트와, 공개하지 않은 값이 꼭 필요한 서버 검사(`RETIRE_AGE`)뿐이에요. 엔진 안에서는 상대 경로(`../core/types`)로 가져와요.

| 폴더 | 관심사 | 파일 |
|---|---|---|
| `core/` | 모든 곳이 쓰는 바탕 | `types` 저장 데이터 모양, `data` 공통 상수·룰셋 버전, `random` 시드 난수, `util` 작은 도우미 |
| `player/` | 선수 자체 | `create` 후보 생성·커리어 시작, `players` 플레이 유형·외모, `ratings` 오버롤·출전 시간·연봉, `specialty` 히든 스탯, `condition` 능력치·건강 범위 |
| `world/` | 리그와 제도 | `leagues` 리그·구단·학교, `awards` 리그별 상 이름, `draft` 드래프트, `national` 국가대표, `military` 병역, `standings` 시즌 순위표 |
| `season/` | 시즌 흐름과 결정 | `season` 시즌 진행·성장·시상, `live` 결승 중계, `offseason` 오프시즌과 결정 대기열, `events` 이벤트, `decisions` 진로·계약 결정, `actions` 결정 처리 |
| `economy/` | 돈 쓰기 | `invest` 시즌 투자, `shop` 상점·기부 |
| `career/` | 커리어 기록과 저장 | `career` 은퇴·요약·레거시, `log` 소식·수상·입단 기록, `storage` localStorage 저장·마이그레이션, 브라우저 업적과 누적 기록 |
| `legacy/` | 평가와 업적 | `hall` 랭킹 점수, `records` 역대 기록 순위표, `comps` 닮은 꼴 선수, `namu` 나무위키 링크, `achievements` 업적 (브라우저마다 한 번만, `setBrowserRecord`로 저장소와 이어요), `lifetime` 모든 커리어 누적 기록 |

밸런스 수치는 대부분 `world/leagues.ts`, `core/data.ts`, `player/ratings.ts`, `season/season.ts`에 있어요.

### `server/`: 서버 전용

화면 코드는 여기를 가져오지 않아요. DB에 닿는 파일은 `import "server-only"`로 시작해요. `schema.ts`, `validate.ts`, `feedback.ts`는 마이그레이션 도구와 테스트도 읽어서 붙이지 않았어요.

| 경로 | 내용 |
|---|---|
| `db/` | 연결 `db.ts`, 테이블 `schema.ts` (`drizzle.config.ts`가 가리켜요) |
| `leaderboard/` | 순위표 `boards.ts`, 스탯 랭킹 `stats.ts`, 기록 저장 `careers.ts`, 제출·조회 검사 `validate.ts` |
| `auth.ts` | 익명 플레이어 토큰 |
| `feedback.ts` | 의견 보내기 |

## 테스트 위치

테스트는 대상 옆 `__tests__/`에 둬요 (`vitest.config.mts`가 `src/**/*.test.ts`를 찾아요).

- `game/__tests__/engine.test.ts`
- `game/__tests__/standings.test.ts`
- `features/retired/__tests__/careerCard.test.ts`
- `server/__tests__/feedback.test.ts`
- `server/leaderboard/__tests__/validate.test.ts`

밸런스 측정은 `scripts/balance.ts`에 있어요 (`npm run balance`).

## 새 파일 둘 곳

1. 게임 규칙이나 계산이면 → `game/`의 알맞은 관심사 폴더. 화면에서 쓰면 `game/index.ts`에서 내보내요.
2. 한 화면에만 쓰이면 → 그 `features/<기능>/`.
3. 두 기능 이상이 쓰면 → `shared/`.
4. DB나 비밀 값이 필요하면 → `server/`. 화면과 주고받는 모양은 `shared/leaderboard/types.ts`.
5. 새 페이지나 API 주소면 → `app/`에 파일 규칙대로 두고, 내용은 `features/`나 `server/`에.

## 남은 일

- `app/globals.css`(5천 줄 넘음)는 아직 한 파일이에요. 나누면 규칙 순서가 바뀌어 화면이 달라질 수 있어서 이번 정리에서는 그대로 뒀어요. 나눈다면 기능 폴더마다 CSS Module을 두는 쪽이 이 구조와 맞아요.
