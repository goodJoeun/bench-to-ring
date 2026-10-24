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
-- 저장 코드로 불러온 커리어는 제출하지 않아요(9장).
create table careers (
  id           text primary key,             -- Career.id (같은 커리어는 한 번만)
  player_id    uuid not null references players(id),
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
  summary      jsonb not null,               -- CareerSummary 전체 (화면 상세용)
  created_at   timestamptz not null default now()
);

-- 순위 정렬: compareCareers와 같은 순서 (NBA MVP → 최고 오버롤 → 개인상 → 통산 득점)
create index careers_rank     on careers (ruleset, verified, mvp desc, peak desc, personal desc, pts desc);
create index careers_pos_rank on careers (ruleset, verified, pos, mvp desc, peak desc, personal desc, pts desc);

-- (2단계) 재생 검증용 행동 기록
create table replays (
  career_id  text primary key references careers(id),
  seed       bigint not null,
  actions    bytea  not null,                -- 압축한 행동 목록
  engine     text   not null                 -- 재생한 엔진 버전(커밋 해시)
);
```

### 순위 계산

- 정렬은 지금 명예의 전당과 같아요(`src/game/hall.ts`의 `compareCareers`). 네 값이 모두 같으면 공동 순위예요.
- **포지션별 순위**: `where pos = $1` + 위 인덱스
- **역대 Best 5**: 포지션마다 1위 한 명 (`bestFive`와 같은 규칙). `distinct on (pos)`로 한 번에 구해요.
- **내 순위**: `rank() over (order by mvp desc, peak desc, personal desc, pts desc)`
- **전체 통계**: 제출된 커리어 수, NBA 진출 비율(`summary->'teams'` 또는 별도 칸), NBA MVP 비율. "전체 유저 중 상위 2%" 같은 문구에 써요.

## 4. 기록 조작 막기

지금은 시뮬레이션이 전부 브라우저에서 돌아서, localStorage를 고치거나 저장 코드 불러오기(`decodeSave`는 형식만 맞으면 받아요)로 아무 기록이나 만들 수 있어요.

### 1단계: 형식 검사와 표시

- 서버에서 범위를 검사해요: 최고 오버롤 20~99, MVP ≤ 프로 시즌 수, 은퇴 나이 30~41 등 엔진이 낼 수 있는 범위.
- 저장 코드로 불러온 커리어는 `Career.imported = true`로 표시하고 제출하지 않아요(9장). 명예의 전당(내 기록)에는 '비공인'으로 보여요.
- 같은 커리어 id는 한 번만, 같은 플레이어는 1분에 한 번만 제출해요.
- 이 단계의 기록은 `verified = false`예요. 순위표 기본 화면에서 보여줄지는 9장에서 정해요.

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
| `GET /api/boards?ruleset=&pos=&scope=current\|all` | 순위표 (전체 Top 50, 포지션별 Top 20, Best 5, 전체 통계). 캐시해요. |
| `GET /api/careers/:id` | 기록 상세 (요약 전체) |
| `POST /api/careers/:id/report` | 신고 (2단계) |

- 순위표는 서버에서 캐시하고, 기록이 제출될 때만 다시 계산해요. 이 프로젝트는 Cache Components가 켜져 있어서 Next.js 캐시 API를 써요. **이 Next.js 버전은 API가 많이 바뀌었으니, 만들기 전에 `node_modules/next/dist/docs/`의 캐시와 Route Handler 문서를 확인해요(AGENTS.md).**
- 플레이어 인증은 요청 헤더의 토큰으로 해요. 토큰 원문은 DB에 두지 않고 해시만 둬요.

## 7. 화면

- **명예의 전당 탭**: [내 기록 | 온라인 랭킹] 전환
  - 온라인 랭킹: 전체 Top 50, 포지션 탭(PG~C), **역대 Best 5**(포지션별 1위를 코트 위에 배치), 내 최고 순위
  - 룰셋 선택: 현재 / 역대 전체
- **은퇴 화면**: 엔딩에 도달하면 자동으로 등록하고 "전체 123위 · SG 12위" 결과와 순위표로 가는 링크를 보여줘요. 저장 코드로 불러온 커리어는 "비공인 기록이라 온라인 랭킹에 올리지 않아요"라고 알려요.
- **공개 안내**: 선수를 만들 때 "은퇴하면 선수 이름과 기록이 온라인 랭킹에 공개돼요"라고 알리고, 설정에서 끌 수 있게 해요.
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

- [x] 저장 코드로 불러온 커리어: 비공인으로 표시하고 제출하지 않아요
- [x] 등록: 엔딩(은퇴)에 도달하면 자동으로 등록해요
- [ ] 1단계(검증 전) 기록을 순위표 기본 화면에 보여줄지
- [ ] 로그인: 익명 토큰만 / Google 연결도 (기기를 바꿔도 기록 유지)
- [x] 공개 범위: 선수 이름 (닉네임은 따로 없어요)
- [x] DB 호스트: Neon (싱가포르 `ap-southeast-1`, 로컬은 `dev` 브랜치)
- [ ] 배포 위치 (Vercel 등)

## 10. 단계별 작업

### 1단계: 순위표 열기

- [x] DB 호스트 만들기, `DATABASE_URL` 설정, 마이그레이션(3장 테이블. `replays`는 2단계에) — `npm run db:generate`, `npm run db:migrate`
- [ ] `RULESET_VERSION` 상수 추가 (`src/game`)
- [x] 저장 코드로 불러온 커리어 표시 (`Career`·`CareerSummary`의 `imported`, `importCareer`)
- [ ] 익명 플레이어 API와 토큰 저장
- [ ] 기록 제출 API: 형식·범위 검사, 중복·횟수 제한
- [ ] 순위표 API: 전체·포지션별·Best 5·통계, 캐시와 제출 때 갱신
- [ ] 명예의 전당 [온라인 랭킹] 화면, 은퇴 때 자동 등록과 결과 표시, 공개 안내
- [ ] 선수 이름 욕설 필터
- [ ] 테스트: 범위 검사, 순위 계산(공동 순위 포함), 제출 흐름

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
