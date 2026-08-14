# Phase7-4 개인 꿈 기록 작성(Create) 구현 보고서

> 컴퓨터가 꺼지기 전 세션에서 이미 대부분 구현되어 있던 상태(서비스/API/폼/페이지/유닛테스트)를 이어받아, 빠져 있던 조각(공개 꿈 상세 CTA, 테스트 파일 타입 오류)을 완성하고 lint/type-check/test/build + 실제 dev 서버 + 실제 Supabase 2-사용자 격리 검증까지 마쳤다.

---

## 1. 생성/수정 파일

**이번 세션에서 실제로 변경한 파일** (이전 세션이 이미 만들어 둔 나머지는 그대로 재사용, 재작성하지 않음):

| 파일 | 변경 내용 |
|---|---|
| `app/dream/[keyword]/page.tsx` | "이 꿈으로 번호 생성하기" CTA 아래 "이 꿈 기록하기" CTA(secondary 버튼) 추가. `href="/my/journal/dreams/new?dream=${dream.id}"` |
| `lib/api/journal.test.ts` | `mockInsertResult`의 `insert` mock에 파라미터 타입(`Record<string, unknown>`)을 명시해 `tsc --noEmit` 오류(`insert.mock.calls[0][0]` 접근 시 튜플 길이 0 오류) 수정 |
| `docs/PHASE7_DREAM_JOURNAL_CREATE_REPORT.md` | 본 보고서(신규) |

**이전 세션이 이미 구현해 둔 파일**(이번 세션에서 내용 검증만 하고 수정하지 않음):

- `lib/api/journal.ts` — `createDreamJournalEntry`, `parseDreamJournalInput` 추가(조회 함수는 무변경)
- `app/api/journal/dreams/route.ts` — `POST /api/journal/dreams`(신규)
- `components/journal/DreamJournalForm.tsx` — 작성 폼(신규)
- `app/my/journal/dreams/new/page.tsx` — 작성 페이지(신규)
- `app/my/journal/dreams/page.tsx` — 상단/EmptyState에 "꿈 기록하기" CTA 이미 포함
- `lib/constants/index.ts` — `DREAM_JOURNAL_TEXT_MAX_LENGTH = 2000`

Migration/RLS/`proxy.ts`/관리자 기능은 이번 Task 전체 기간 동안 **전혀 수정하지 않았다**.

---

## 2. 실제 DB schema와 INSERT 계약

`supabase/migrations/0004_dream_journal_entries.sql`(Phase1, 무변경)을 그대로 사용했다.

```sql
create table public.dream_journal_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id),
  entry_date date not null,
  dream_text text not null,
  linked_dream_id bigint references public.dreams (id),  -- nullable, 선택적 FK
  created_at timestamptz not null default now()
);
```

INSERT payload(`lib/api/journal.ts`의 `createDreamJournalEntry`):

```ts
{
  user_id: userId,          // 서버가 getCurrentUser()로 결정, body에서 절대 읽지 않음
  entry_date: todayDateString(), // NOT NULL + DEFAULT 없음 → 서버가 UTC 기준 오늘 날짜로 채움
  dream_text: dreamText,    // trim 처리된 원문
  ...(linkedDreamId !== null ? { linked_dream_id: linkedDreamId } : {}), // 조건부, 없으면 컬럼 자체를 안 보냄(NULL 기본값 유지)
}
```

`entry_date`는 NOT NULL이고 UI에 날짜 입력 필드를 새로 만들지 않았다(§7 원칙) — "작성 시점 = 꿈을 기록한 날짜"로 서버가 직접 채운다. `linked_dream_id`가 nullable이라 §6-B(자유 기록)이 스키마 변경 없이 가능했다.

`DREAM_JOURNAL_TEXT_MAX_LENGTH = 2000`은 DB 제약(컬럼이 `text`라 길이 제약 없음)에서 도출된 값이 아니라 애플리케이션 레벨 UX 상한이다 — 임의로 작은 값이 아니라 다이어리 텍스트로 합리적인 값을 이전 세션이 선택했고, 이번 세션에서 실제 Supabase INSERT로 2000자 경계값이 정확히 통과/거부됨을 재확인했다(§7).

---

## 3. 작성 UI/UX

`components/journal/DreamJournalForm.tsx` (Client Component):

- `h1`은 페이지(`app/my/journal/dreams/new/page.tsx`)가 렌더링, 폼은 textarea 이하만 담당
- textarea: `autoFocus`, `maxLength`, 글자 수 표시(`{length} / {MAX}자`)
- 저장 버튼: `disabled={!isValid}` + `loading={status === "saving"}`로 중복 클릭 방지
- 취소: `router.back()`
- 오류: `role="alert"`로 표시, textarea 값은 유지(setDreamText를 오류 경로에서 호출하지 않음)
- 성공: `router.push("/my/journal/dreams")`
- `linkedDreamId`가 있으면 `"{keyword}" 꿈과 연결해서 기록해요` 안내문 표시

새 색상 토큰 없음, 기존 `Button`/DESIGN 토큰만 사용. 날짜/기분/제목 등 DB에 없는 필드는 만들지 않았다.

---

## 4. API/service 계약

`POST /api/journal/dreams`:

| 응답 | 조건 |
|---|---|
| `201 { data: {...} }` | 저장 성공, 저장된 row 그대로 반환 |
| `401 { error: { code: "UNAUTHORIZED", ... } }` | 비로그인 |
| `400 { error: { code: "VALIDATION_ERROR", ... } }` | JSON 파싱 실패 / 빈·공백 문자열 / 최대 길이 초과 / `linkedDreamId` 형식 오류 / 존재하지 않는 `linkedDreamId` |
| `500 { error: { code: "INTERNAL_ERROR", ... } }` | DB 오류 |

`app/api/numbers/route.ts`(Phase5)와 동일한 `{error:{code,message}}` 컨벤션, 동일한 Route Handler 패턴(Server Action 도입 안 함).

`lib/api/journal.ts`의 나머지 조회 함수(`getRecentUserNumbers` 등)는 `getCurrentUserId()`로 비로그인 시 조용히 빈 배열을 반환하는 패턴이지만, `createDreamJournalEntry`는 `saveUserNumbers`(Phase5)와 동일하게 `userId`를 명시적 인자로 받고 호출자(Route Handler)가 이미 인증을 확인했다는 전제를 따른다 — "쓰기 작업에서 비로그인은 조용히 무시할 상태가 아니라 401"이라는 이전 세션의 판단을 그대로 유지했다.

---

## 5. 인증/보안 구조

- `user_id`를 body에서 전혀 읽지 않는다 — `parseDreamJournalInput`은 `dreamText`/`linkedDreamId`만 구조분해하고, 나머지 키(`user_id`/`otherUserId`/`ownerId` 등)는 존재해도 무시된다.
- 실제 저장되는 `user_id`는 `getCurrentUser()`가 반환한 세션의 `user.id`뿐이다.
- `app/my/journal/dreams/new/page.tsx`는 `app/my/journal/dreams/page.tsx`(Phase4)와 동일한 페이지 레벨 인증 패턴(`getCurrentUser()` → 없으면 `/login?next=...`, profile 없으면 `/onboarding`)을 그대로 재사용했다 — `proxy.ts`는 `/my/journal/*` 전체를 예외로 통과시키므로 하위 페이지가 직접 로그인을 확인한다(기존 Phase4 실측 그대로, `proxy.ts` 무수정).
- `dream_journal_entries`의 RLS(`0008_rls_policies.sql`, 무수정)는 SELECT/INSERT/UPDATE/DELETE 전부 `auth.uid() = user_id`로 본인만 허용 — Phase2에서 이미 실제 anon key + 2-사용자 JWT로 이 정책이 정확히 동작함을 검증했었고(`docs/PHASE2_RLS_REAL_USER_TEST_REPORT.md` §3), 이번 세션에서도 실제 API 경로(`POST /api/journal/dreams`, 페이지 렌더)로 다시 확인했다(§7).

---

## 6. 공개 꿈과 개인 기록의 연결 방식

- **A. `/dream/[keyword]` → 기록**: 상세 페이지에 `href="/my/journal/dreams/new?dream=${dream.id}"` CTA 추가(이번 세션). 비로그인 사용자가 눌러도 상세 페이지 자체는 로그인 필수로 만들지 않았다 — 이동한 `/my/journal/dreams/new`가 자체적으로 로그인을 확인해 `/login?next=...`로 보낸다.
- 작성 페이지는 `dream` 쿼리파라미터로 `getDreamById()`(Phase7-3에 이미 존재)를 호출해 실제 꿈이면 `linkedDreamId`/`dreamKeyword`를 폼에 내려주고, 잘못된 값이면 조용히 무시하고 자유 기록으로 폴백한다. 최종 검증은 `POST /api/journal/dreams`가 서버에서 `getDreamById()`로 다시 한다.
- **B. `/my/journal/dreams` → 기록**: `dream` 파라미터 없이 진입 → `linkedDreamId: null`로 저장(스키마가 nullable이라 새 관계를 만들지 않고 가능).

---

## 7. 실제 Supabase 검증

로컬 dev 서버(`npm run dev`) + 실제 Supabase 프로젝트에 대해, Phase2/Phase7-3과 동일한 방법(`establishKakaoSupabaseSession()` 재사용, 임시 `app/api/jtest/route.ts` 생성 후 검증 종료 즉시 삭제)으로 테스트 계정 2개(User A, User B)를 만들어 검증했다.

| 테스트 | 결과 |
|---|---|
| User A 일반 저장(linkedDreamId 없음) | `201`, `linked_dream_id: null` |
| 비로그인 저장 | `401 UNAUTHORIZED` |
| 빈 문자열(`""`) | `400 VALIDATION_ERROR`, "꿈 내용을 입력해주세요." |
| 공백만(`"   \n\t  "`) | `400 VALIDATION_ERROR`, "꿈 내용을 입력해주세요." |
| 2001자(최대 길이 초과) | `400 VALIDATION_ERROR`, "꿈 내용은 2000자를 초과할 수 없습니다." |
| 2000자(경계값) | `201` 성공 — `dream_text` 길이 2000 저장 확인 |
| `user_id` 위조 시도(body에 User B의 uid + `otherUserId`/`ownerId` 포함, User A 세션으로 요청) | `201` 성공했지만 **DB에 저장된 실제 `user_id`는 User A**(위조값 조용히 무시 확인) |
| 존재하지 않는 `linkedDreamId`(999999) | `400 VALIDATION_ERROR`, "존재하지 않는 꿈입니다. (id: 999999)" |
| 실제 존재하는 `linkedDreamId`(1) | `201`, `linked_dream_id: 1` 저장 확인 |
| User A `/my/journal/dreams` 렌더 | `200`, 방금 저장한 항목들이 실제로 표시됨 |
| User B `/my/journal/dreams` 렌더 | `200`, User A의 항목이 **전혀 보이지 않고** EmptyState("아직 기록한 꿈이 없어요")만 표시 — 격리 확인 |
| 비로그인 `/my/journal/dreams` 접근 | `307` → `/login?next=%2Fmy%2Fjournal%2Fdreams` |

검증 종료 후 `dream_journal_entries`/`profiles`의 테스트 계정 관련 행과 Supabase Auth 사용자 2개를 전부 삭제하고, 두 테이블 모두 **잔여 0건**을 응답으로 직접 재확인했다. 임시 라우트(`app/api/jtest/route.ts`)도 삭제했다 — `git status`로 흔적이 없음을 확인.

**참고(발견된 문제 아님)**: 검증 중 Windows Git Bash에서 curl 인자에 한글을 직접 인라인으로 넣은 2건(`하늘을 나는 꿈을 꿨다`, `실제 꿈과 연결`)이 셸 인코딩 문제로 DB에 깨진 바이트로 저장됐다. Node 스크립트로 JSON 파일을 만들어 보낸 나머지 케이스(위조 시도 텍스트, 2000자 텍스트 등)는 모두 정상 저장됐다 — 실제 브라우저의 `fetch()`는 JS 문자열을 항상 올바른 UTF-8로 직렬화하므로 이 문제는 테스트 도구(curl 인라인 인자) 자체의 아티팩트이며 애플리케이션 결함이 아니다.

---

## 8. 기존 Phase4 조회 회귀 검증

- `getRecentDreamJournalEntries`/`getRecentUserNumbers`/`getRecentFortuneResults`/`getDiarySummary`의 기존 테스트 — **한 줄도 수정하지 않고 전부 통과**.
- `app/my/journal/dreams/page.tsx`(Phase4) 자체를 재작성하지 않았다 — 이미 이전 세션이 상단 "꿈 기록하기" 버튼과 EmptyState "첫 꿈 기록하기" CTA를 추가해 둔 상태였고, 조회 로직(`getRecentDreamJournalEntries` 호출부)은 무변경.
- §7 실측에서 방금 작성한 신규 항목이 실제로 `/my/journal/dreams`에 표시됨을 확인 — Phase4 조회 서비스가 Phase7-4가 저장한 새 형식의 row를 문제없이 읽는다.

---

## 9. 테스트/lint/type-check/build

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과(이번 세션에서 `lib/api/journal.test.ts`의 mock 타입 오류 1건 수정 후) |
| `npm test` | 통과 — 12 test files, **168 tests** 전부 통과 |
| `npm run build` | 통과, `/api/journal/dreams`, `/my/journal/dreams/new` 라우트 정상 포함 |

`lib/api/journal.test.ts`의 `parseDreamJournalInput`/`createDreamJournalEntry` 유닛테스트가 지시문 §13의 8개 항목을 이미 커버한다: 정상 저장, 빈 문자열, 공백, 최대 길이 초과, 존재하지 않는 `linkedDreamId`, 기존 조회 함수 회귀. "비로그인 거부"와 "user_id 위조 불가"는 이 프로젝트에 Route Handler 유닛테스트 컨벤션 자체가 없어(다른 라우트도 동일, `app/api/numbers/route.ts` 등 전부 route 레벨 테스트 없음) 이번 세션의 실제 Supabase 통합 검증(§7)으로 확인했다.

---

## 10. 발견된 문제

새로 발견된 결함은 없다. 확인한 사항:

- **컴퓨터 종료 전 세션의 구현은 스펙과 거의 완전히 일치했다** — 서비스/API/폼/페이지가 지시문 §1~§10의 요구사항을 정확히 따르고 있었다. 이번 세션에서 실제로 빠져 있던 것은 딱 두 가지였다: (1) `/dream/[keyword]`의 "이 꿈 기록하기" CTA(§11 요구사항, 코드에 없었음), (2) `lib/api/journal.test.ts`의 타입 오류 1건(`tsc --noEmit` 실패 상태로 남아 있었음). 둘 다 이번 세션에서 수정했다.
- curl 인라인 한글 인자의 셸 인코딩 아티팩트(§7 참고사항) — 애플리케이션 문제 아님, 기록만 남김.

---

## 11. Phase7-5 Final Audit 착수 가능 여부

**가능하다.** lint/type-check/test(168개)/build 전부 통과, 실제 dev 서버 + 실제 Supabase 프로젝트에서 저장/조회/격리(User A/B)/인증 리다이렉트를 전부 실측 확인했고, 테스트 계정·데이터·임시 라우트를 전량 삭제해 원상복구했다(잔여 0건 재확인). Migration/RLS/`proxy.ts`/관리자 기능 등 범위 외 항목은 전혀 건드리지 않았다.

---

## TASK REPORT

1. **생성/수정 파일**: `app/dream/[keyword]/page.tsx`(CTA 추가), `lib/api/journal.test.ts`(타입 오류 수정), `docs/PHASE7_DREAM_JOURNAL_CREATE_REPORT.md`(신규). 나머지(`lib/api/journal.ts`, `app/api/journal/dreams/route.ts`, `components/journal/DreamJournalForm.tsx`, `app/my/journal/dreams/new/page.tsx`, `app/my/journal/dreams/page.tsx`)는 이전 세션이 이미 구현해 둔 상태를 검증만 하고 그대로 유지.

2. **꿈 기록 작성 흐름**: `/dream/[keyword]` → "이 꿈 기록하기" → `/my/journal/dreams/new?dream=<id>`(dream context 유지, 비로그인 시 자동 `/login?next=...`) → 저장 → `/my/journal/dreams`(방금 작성한 기록 즉시 표시). `/my/journal/dreams`에서 직접 "꿈 기록하기"로 진입하면 dream 연결 없는 자유 기록.

3. **API/service 계약**: `POST /api/journal/dreams` — `201 {data}` / `401` / `400` / `500`, `{error:{code,message}}` 컨벤션. `createDreamJournalEntry(userId, dreamText, linkedDreamId?)`가 `entry_date`를 서버에서 채우고 `linked_dream_id` 존재 여부를 검증 후 INSERT.

4. **DB 저장 결과**: 실제 Supabase에서 일반 저장(`linked_dream_id: null`)과 꿈 연동 저장(`linked_dream_id: <실제 id>`) 둘 다 확인, 2000자 경계값 정상 저장, 2001자 정상 거부.

5. **User A/B 보안 검증**: `user_id`/`otherUserId`/`ownerId` 위조 시도 전부 무시되고 세션의 실제 사용자로 저장됨을 실측. User B는 `/my/journal/dreams`에서 User A의 항목을 전혀 볼 수 없음(EmptyState만 표시) 확인. 테스트 계정·데이터 전량 삭제 후 잔여 0건 재확인.

6. **Phase4 조회 회귀 검증**: 기존 조회 함수 테스트 전부 무변경 통과, 실제 페이지에서 신규 저장 항목이 정상 표시됨을 확인 — 회귀 없음.

7. **테스트/Validation**: lint 통과, type-check 통과(수정 1건 후), test 168/168 통과, build 통과.

8. **발견된 문제**: 없음(신규 결함 없음). CTA 누락과 테스트 타입 오류 2건을 이번 세션에서 완성/수정.

9. **Phase7-5 Final Audit 착수 가능 여부**: 가능.
