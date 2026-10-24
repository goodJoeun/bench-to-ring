# 온라인 기록과 리더보드 계획

플레이한 사람들의 은퇴 기록을 서버에 모아 전체 순위, 포지션별 순위, 역대 Best 5를 보여주는 계획이에요.
지금 명예의 전당은 브라우저 localStorage에만 있어서(`src/game/storage.ts`의 `saveHall`, 최근 60명) 내 기록끼리만 비교할 수 있어요.

## 1. 결정: Next.js + Postgres, 별도 Java 서버는 두지 않아요

Firebase로 시작해 나중에 백엔드로 옮기는 방법도 검토했지만, 처음부터 Next.js Route Handler + Postgres로 가요.

- **엔진을 서버에서 그대로 써요.** 조작을 막는 재생 검증(4장)은 서버가 게임 엔진(`src/game`)을 똑같이 돌려 봐야 해요. 엔진이 TypeScript라 Route Handler에서 import 한 줄로 쓸 수 있고, 밸런스를 바꿔도 화면과 서버가 같은 코드라 어긋나지 않아요.
- **옮길 일이 없어요.** Firebase에서 시작하면 데이터 모델 변환과 이전 작업이 생기지만, Postgres는 처음부터 '실제 백엔드'예요.
- **순위 쿼리가 쉬워요.** 포지션별 순위, 내 순위, 상위 몇 %가 SQL `ORDER BY`와 `rank()` 한 줄이에요.
- **Java 서버는 지금 필요 없어요.** 혼자 하는 게임이라 실시간 연결이 없고, 하는 일은 기록 제출과 순위 조회뿐이에요. 커리어 하나를 재생하는 데 10ms 남짓이라 무거운 계산도 아니에요. 오히려 Java로 하면 재생 검증을 위해 엔진을 Java로 다시 짜서 두 언어를 계속 맞춰야 해요. 나중에 별도 서버가 필요해져도 엔진을 그대로 쓰는 Node.js 워커가 맞아요.

## 2. 구조

```
브라우저 (게임, 엔진)                      Next.js 서버 (Route Handler)                Postgres
─────────────────────                     ─────────────────────────────              ─────────
은퇴 → 요약 + (2단계) 행동 기록  ──POST /api/careers──▶  형식 검사 · 제출 제한 · (2단계) 재생 검증  ──▶  careers, replays
명예의 전당 [온라인] 탭          ◀──GET /api/boards────  캐시된 순위표 (제출 때 갱신)               ◀──  인덱스 정렬
```

- 엔진(`src/game`)은 서버도 DB도 몰라요. 은퇴 요약(`CareerSummary`)과 행동 기록만 내놓아요.
- DB 접근은 `src/server/`에만, 화면에서 API를 부르는 코드는 `src/lib/leaderboard/`에만 둬요.
- DB 호스트는 연결 풀링을 지원하는 곳(Neon 또는 Supabase, 둘 다 무료 요금제 있음)을 써요. 서버리스에서 요청마다 연결이 생기기 때문이에요.

## 3. 데이터

### 테이블

```sql
-- 플레이어(기기). 1단계는 익명 토큰, 나중에 Google 로그인을 연결해요.
-- 순위표에는 선수 이름을 보여줘서 닉네임은 두지 않아요(9장).
create table players (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,          -- 브라우저에 저장한 익명 토큰의 해시
  created_at  timestamptz not null default now()
);

-- 제출한 은퇴 기록. CareerSummary에서 순위·화면에 필요한 값만 따로 칸으로 둬요.
create table careers (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references players(id),
  career_id    text not null,                -- 브라우저의 Career.id (시작 시각이라 플레이어끼리 겹칠 수 있어요)
  ruleset      int  not null,                -- 5장
  verified     boolean not null default false, -- 4장 재생 검증 통과
  name         text not null,                -- 선수 이름 (순위표에 공개)
  num          int  not null,
  pos          text not null check (pos in ('PG','SG','SF','PF','C')),
  mvp          int  not null,                -- NBA MVP
  peak         int  not null,                -- 최고 오버롤
  personal     int  not null,                -- 개인상 수
  pts          int  not null,                -- 프로 통산 득점
  reb          int  not null,
  ast          int  not null,
  rings        int  not null,
  seasons      int  not null,                -- 프로 시즌
  ret_age      int  not null,
  legacy       text not null,                -- 레거시 등급 문구
  score        double precision not null default 0, -- 랭킹 점수 (아래 순위 계산)
  summary      jsonb not null,               -- CareerSummary 전체 (화면 상세용)
  created_at   timestamptz not null default now()
);

-- 순위 정렬: compareCareers와 같은 순서 (랭킹 점수 → NBA MVP → 최고 오버롤 → 통산 득점)
create index careers_score     on careers (ruleset, score desc, mvp desc, peak desc, pts desc);
create index careers_pos_score on careers (ruleset, pos, score desc, mvp desc, peak desc, pts desc);

-- (2단계) 재생 검증용 행동 기록
create table replays (
  career_id  text primary key references careers(id),
  seed       bigint not null,
  actions    bytea  not null,                -- 압축한 행동 목록
  engine     text   not null                 -- 재생한 엔진 버전(커밋 해시)
);
```

### 순위 계산

- 정렬은 명예의 전당과 같아요(`src/game/hall.ts`의 `compareCareers`): **랭킹 점수** → NBA MVP → 최고 오버롤 → 통산 득점. 네 값이 모두 같으면 공동 순위예요.
- **랭킹 점수**(`rankScore`, `scoreParts`): 아래를 더해요. 가중치는 `SCORE_AWARDS`, `SCORE_OTHER`, `SCORE_NBA`에 있어요.
  - 수상: NBA MVP 30, 파이널 MVP 20, 리그 MVP 20, 우승 반지 12, 베스트 퍼스트팀·올해의 수비수 8, 컨퍼런스 파이널 MVP·국가대표 금 6, 세컨드·서드팀·신인왕·득점왕 5, 올스타·올-디펜시브·식스맨·기량발전·국가대표 은 3, 그 밖 2
  - 프로 통산 기록: 득점 400·리바운드 800·어시스트 560마다 1점
  - 최고 오버롤이 60을 넘는 만큼
  - NBA 진출 10점, NBA 시즌마다 1점
  - **NBA 밖(KBL·유로리그·G리그·아마추어)에서 받은 상과 쌓은 기록은 30%만** 쳐요(국가대표 메달은 그대로). 은퇴 요약의 `nba`(NBA 시즌의 통산 기록과 그 시즌에 받은 상)로 나눠요. `nba`가 없는 예전 기록은 NBA에서만 주는 상(NBA MVP, 컨퍼런스 파이널 MVP, 올-루키)만 NBA 몫으로 쳐요.
  - 무작위 플레이 1,500명으로 맞춰 봤어요: NBA MVP 여러 번이 맨 위, KBL MVP를 9번 받은 레전드는 상위 1% 언저리예요.
- 점수는 서버가 제출받을 때 다시 계산해 `score` 칸에 둬요. 가중치를 바꾸면 `npm run db:rescore`로 저장된 기록을 모두 다시 계산해요(바뀐 기록만 고쳐요).
- **포지션별 순위**: `where pos = $1` + 위 인덱스
- **역대 Best 5**: 포지션마다 1위 한 명 (`bestFive`와 같은 규칙). `distinct on (pos)`로 한 번에 구해요.
- **내 순위**: `rank() over (order by score desc, mvp desc, peak desc, pts desc)`에서 내 플레이어 기록만 골라요(`GET /api/careers/mine`).
- **전체 통계**: 제출된 커리어 수, NBA 진출 비율(`summary->'teams'` 또는 별도 칸), NBA MVP 비율. "전체 유저 중 상위 2%" 같은 문구에 써요.

## 4. 기록 조작 막기

지금은 시뮬레이션이 전부 브라우저에서 돌아서, localStorage를 고치면 아무 기록이나 만들 수 있어요. 저장 코드로 이어하기는 없앴어요(9장).

### 1단계: 형식 검사와 표시

- 서버에서 범위를 검사해요: 최고 오버롤 20~99, MVP ≤ 프로 시즌 수, 은퇴 나이 30~41 등 엔진이 낼 수 있는 범위.
- 같은 커리어는 플레이어마다 한 번만(`unique (player_id, career_id)`), 같은 플레이어는 1분에 한 번만 제출해요.
- 값끼리 맞는지도 봐요: MVP·반지 수와 수상 기록, 개인상 합계, 시즌당 경기 수, 경기당 기록, 은퇴 나이와 연도, 레거시 등급(`legacyOf`로 다시 계산). 범위 안에서 조금 고친 값은 못 막아요(2단계).
- 욕설이 들어간 선수 이름은 "익명의 선수"로 바꿔서 올려요.
- 클라이언트는 은퇴하면 기록을 대기열(`b2r-pending-v1`)에 넣고 보내요. 실패하면 다음에 접속할 때 다시 보내요.
- 이 단계의 기록은 `verified = false`예요. 1단계에서는 순위표 기본 화면에 함께 보여줘요(9장).

### 2단계: 서버 재생 검증

엔진은 이미 재생할 수 있는 구조예요. 모든 난수가 `src/game/random.ts` 한 곳을 지나가고, 시드 고정 난수(`seeded`)가 있어요.

1. 커리어를 만들 때 시드를 정하고, 커리어에 난수 상태를 저장해 새로고침해도 이어지게 해요.
2. 스토어(`src/lib/game-store.ts`)의 행동을 순서대로 기록해요: 시즌 시작, 한 칸 진행, 선택지 번호, 훈련 초점, 투자, 구입, 기부, 이적 요청, 은퇴.
3. 은퇴하면 요약과 함께 시드·행동 기록을 보내요. 한 커리어가 약 2천 칸이고 압축하면 몇 KB예요.
4. 서버는 그 커리어를 만들 때의 엔진으로 처음부터 다시 돌려, 요약이 똑같으면 `verified = true`로 저장해요.

화면의 `Math.random`(등번호 추천)은 게임 결과와 상관없어서 그대로 둬도 돼요.

## 5. 룰셋 버전

밸런스(리그 평균, 진출 기준 등)가 바뀌면 같은 플레이라도 결과가 달라져서 기록을 한 줄에 세우기 어려워요.

- 엔진에 `RULESET_VERSION` 상수를 두고, 밸런스를 바꿀 때마다 올려요.
- 순위표는 **현재 룰셋**(기본)과 **역대 전체** 두 가지로 보여줘요.
- 재생 검증은 기록을 만든 버전의 엔진이 필요해요. 버전마다 엔진 묶음을 서버에 남기거나, 검증을 마친 기록은 결과를 고정해요.

## 6. API

| 메서드 · 경로 | 하는 일 |
| --- | --- |
| `POST /api/players` | 익명 플레이어 만들기. 토큰을 돌려주고 브라우저에 저장해요. |
| `POST /api/careers` | 은퇴 기록 제출. 엔딩에 도달하면 자동으로 불러요. 선수 이름 욕설 필터. 응답에 전체 순위와 포지션 순위를 담아요. |
| `GET /api/boards?ruleset=&pos=&scope=current\|all` | 순위표. 기본은 현재 룰셋 전체 Top 100, `pos`를 주면 그 포지션 Top 50이에요. 역대 Best 5와 전체 통계(커리어 수, NBA 진출, NBA MVP)를 함께 담아요. 캐시해요. |
| `GET /api/careers/mine` | 내 플레이어(토큰)가 올린 기록의 지금 전체·포지션 순위. 랭킹 페이지 '나의 기록'에서 써요. |
| `GET /api/careers/:id` | 기록 상세 (요약 전체) |
| `POST /api/careers/:id/report` | 신고 (2단계) |

- 순위표는 서버에서 캐시하고, 기록이 제출될 때만 다시 계산해요. 이 프로젝트는 Cache Components가 켜져 있어서 Next.js 캐시 API를 써요. **이 Next.js 버전은 API가 많이 바뀌었으니, 만들기 전에 `node_modules/next/dist/docs/`의 캐시와 Route Handler 문서를 확인해요(AGENTS.md).**
  - `src/server/boards.ts`의 `getBoard`가 `'use cache'` + `cacheTag("boards")` + `cacheLife("hours")`예요. 기록 제출 API가 `revalidateTag("boards", { expire: 0 })`로 바로 비워서, 은퇴하고 바로 순위표를 열어도 내 기록이 보여요.
  - 기본 캐시는 서버 메모리라서, 서버리스로 배포하면 인스턴스마다 따로 캐시되고 오래 남지 않아요. 사용량이 늘면 `'use cache: remote'`나 순위표 미리 계산 테이블을 써요(10장 3단계).
- 플레이어 인증은 요청 헤더의 토큰으로 해요. 토큰 원문은 DB에 두지 않고 해시만 둬요.

## 7. 화면

- **랭킹 페이지** (`/rankings`, `src/components/rankings/`): 상단 헤더의 [랭킹] 버튼과 명예의 전당의 링크로 들어가요. 탭은 주소의 `#best5` · `#ranking` · `#mine`을 따라가요.
  - **베스트 5**: 하프 코트 위에 포지션별 랭킹 점수 1위를 도트 선수로 세워요(점수 배지, 이름·포지션·최고 오버롤). 아래에 등록된 커리어·NBA 진출·NBA MVP 수
  - **랭킹 100**: 포지션 칩(전체·PG~C), 1~3위 단상, 4위부터 목록(포지션·OVR·NBA MVP·파이널 MVP·리그 MVP·반지·통산 득점, 점수)
  - **나의 기록**: 이 브라우저에서 은퇴한 선수를 랭킹 점수로 줄 세우고, 온라인 전체·포지션 순위(또는 등록 대기 중 / 온라인 기록 없음)를 붙여요. 내 기록은 순위표에서도 '나'로 표시해요. 서버의 `career_id`(브라우저 커리어 id)로 맞춰서 정확해요
  - 도트 색은 은퇴 요약의 `look`에서, 유니폼 색은 마지막 소속팀에서 가져와요. `look`이 없는 예전 기록은 기록 id로 색을 정해요
  - 룰셋 선택: 현재 / 역대 전체 (룰셋이 2가 되면 넣어요. 지금은 현재 룰셋만 보여줘요)
- **명예의 전당 탭**: 이 브라우저의 기록(랭킹 점수 칸 포함)과 랭킹 페이지로 가는 링크. 시작 화면에서도 늘 보여요
- **은퇴 화면**: 엔딩에 도달하면 자동으로 등록하고 "전체 123위 · SG 12위" 결과와 순위표로 가는 링크를 보여줘요.- **공개 안내**: 선수를 만들 때 "은퇴하면 선수 이름과 기록이 온라인 랭킹에 공개돼요"라고 알리고, 설정에서 끌 수 있게 해요.
- **재미 요소**: "전체 유저 중 NBA 진출 3.8% · 당신은 상위 2%", 포지션별 최고 기록 보유자
- 서버가 안 되면 조용히 실패하고, 게임은 지금처럼 오프라인으로 돌아가요.

## 8. 코드 구조

```
src/
├─ app/api/
│  ├─ players/route.ts         POST
│  ├─ careers/route.ts         POST (제출)
│  ├─ careers/[id]/route.ts    GET
│  └─ boards/route.ts          GET (캐시)
├─ server/                     서버 전용 (DB, 검증)
│  ├─ db.ts                    연결 (풀링)
│  ├─ careers.ts               저장·순위 쿼리
│  ├─ validate.ts              범위 검사 · (2단계) 재생 검증
│  └─ auth.ts                  토큰 확인
└─ lib/leaderboard/            화면에서 쓰는 쪽
   ├─ types.ts                 SubmittedCareer, Board 같은 주고받는 모양
   └─ client.ts                fetch 함수 (submit, board, myRanks)
```

- 엔진(`src/game`)은 바뀌지 않아요. 2단계에서만 난수 상태 저장과 행동 기록이 들어가요.
- DB 접근 도구는 SQL에 가까운 가벼운 것(Drizzle 또는 Kysely)을 써요.
- 환경 변수: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`(마이그레이션), `TOKEN_SECRET`. `.env.example`에 이름만 남겨요.

## 9. 정해야 할 것

- [x] 저장 코드로 이어하기: 없앴어요 (다른 곳에서 만든 커리어가 들어올 길을 막아요)
- [x] 등록: 엔딩(은퇴)에 도달하면 자동으로 등록해요
- [x] 1단계(검증 전) 기록: 순위표 기본 화면에 함께 보여줘요. 2단계에서 재생 검증이 생기면 검증된 기록만 보는 거름을 더해요
- [ ] 로그인: 익명 토큰만 / Google 연결도 (기기를 바꿔도 기록 유지)
- [x] 공개 범위: 선수 이름 (닉네임은 따로 없어요)
- [x] DB 호스트: Neon (싱가포르 `ap-southeast-1`, 로컬은 `dev` 브랜치)
- [ ] 배포 위치 (Vercel 등)

## 10. 단계별 작업

### 1단계: 순위표 열기

- [x] DB 호스트 만들기, `DATABASE_URL` 설정, 마이그레이션(3장 테이블. `replays`는 2단계에) — `npm run db:generate`, `npm run db:migrate`
- [x] `RULESET_VERSION` 상수 추가 (`src/game/data.ts`, 은퇴 기록의 `ruleset`)
- [x] 저장 코드로 이어하기 없애기
- [x] 익명 플레이어 API와 토큰 저장
- [x] 기록 제출 API: 형식·범위 검사, 중복·횟수 제한
- [x] 은퇴 때 자동 등록(실패하면 다음 접속 때 다시), 순위 알림, 시작 확인 창의 공개 안내
- [x] 순위표 API: 전체·포지션별·Best 5·통계, 캐시와 제출 때 갱신 (`GET /api/boards`, 화면용 `fetchBoard`)
- [x] 순위 인덱스를 랭킹 점수 기준으로 바꾸고 `verified` 빼기 (`0003_career_score`)
- [x] 랭킹 점수(NBA 기록 우대)와 `db:rescore`
- [x] 랭킹 페이지: 베스트 5 코트, 랭킹 100, 나의 기록 (`GET /api/careers/mine`)
- [ ] 은퇴 화면의 순위 결과, 설정에서 공개 끄기, 룰셋 선택(룰셋 2부터)
- [x] 선수 이름 욕설 필터
- [x] 테스트: 범위 검사, 이름 필터 (`src/server/__tests__/validate.test.ts`)
- [ ] 테스트: 순위 계산(공동 순위 포함)은 DB가 있어야 해서 지금은 수동 확인만
- [ ] 플레이어 만들기 횟수 제한 (지금은 새 토큰을 계속 만들면 1분 제한을 피할 수 있어요)

### 2단계: 믿을 수 있는 기록

- [ ] 커리어 시드와 난수 상태 저장 (`src/game/random.ts`, `Career`)
- [ ] 스토어 행동 기록과 압축
- [ ] 서버 재생 검증, `verified` 표시, 버전별 엔진 보관
- [ ] 신고 API와 숨김 처리

### 3단계: 키우기

- [ ] 룰셋별 시즌 랭킹 초기화와 지난 시즌 기록 보관
- [ ] 전체 유저 통계 화면
- [ ] Google 로그인 연결
- [ ] 사용량이 늘면: 읽기 전용 복제본, 순위표 미리 계산 테이블
