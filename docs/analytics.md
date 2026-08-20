# 분석 이벤트 (claude-code-luck-platform-launch-prompt.md §20)

`lib/analytics/trackProductEvent.ts`가 provider에 종속되지 않는 최소 래퍼다.
`NEXT_PUBLIC_ANALYTICS_ENDPOINT`(.env.example 참조)가 비어 있으면 개발 환경 콘솔 로그만
남기고 어떤 데이터도 외부로 나가지 않는다(fail-closed 기본값) — 아직 실제 분석 provider를
연결하지 않았기 때문에 프로덕션에서도 지금은 순수 no-op이다.

## 연결 방법

1. 이벤트를 수집할 endpoint(자체 서버 또는 provider가 제공하는 URL)를 준비한다.
2. `NEXT_PUBLIC_ANALYTICS_ENDPOINT`에 그 URL을 설정한다(Vercel 환경변수 + 로컬 `.env.local`).
3. 클라이언트에서는 `navigator.sendBeacon`을, 서버(Route Handler)에서는 `fetch(..., { keepalive: true })`를 자동으로 선택해 `{ event, properties, timestamp }` JSON을 POST한다 — payload 형식이 provider와 안 맞으면 endpoint 앞단(자체 서버)에서 변환한다.
4. 전송 실패는 항상 조용히 무시된다 — 분석 전송이 실제 기능(번호 저장, 로그인 등)을 막지 않는다.

## 이벤트 정의와 구현 상태

타입은 `lib/analytics/events.ts`(`ProductEventName`/`ProductEventPropertiesMap`)에 전부
정의되어 있다 — 아래 "미연결" 이벤트도 타입은 이미 있어 호출부만 추가하면 된다.

| 이벤트 | 발생 시점 | 속성 | 상태 |
|---|---|---|---|
| `dream_search_submitted` | 꿈 검색 결과 수신 | `query_length`, `result_count`, `location` | ✅ `components/dream/DreamSearchInput.tsx` |
| `numbers_generated` | 6개 번호 확정(최초 생성/다시 생성 모두) | `source`, `dream_number_count` | ✅ `components/generate/NumberGenerator.tsx` |
| `login_started` | 카카오 로그인 개시 | `reason` | ✅ `app/api/auth/kakao/login/route.ts` |
| `login_completed` | 카카오 인증 성공(온보딩 완료 여부 무관) | `reason` | ✅ `app/api/auth/kakao/callback/route.ts` |
| `number_saved` | `user_numbers` INSERT 성공 직후 | `source`, `draw_id`(항상 null — 저장 시점에 특정 회차를 지정하지 않는 스키마) | ✅ `app/api/numbers/route.ts` |
| `save_number_clicked` | 저장 CTA 클릭(비회원 로그인 유도) | `authenticated`, `source` | ✅ `components/generate/NumberGenerator.tsx` |
| `dream_result_viewed` | Parent/Situation 진입 | `dream_id`, `dream_type`, `referrer_type` | ⏳ 미연결 |
| `related_dream_clicked` | 관련 꿈 클릭 | `from_dream_id`, `to_dream_id` | ⏳ 미연결 |
| `dream_number_cta_clicked` | 꿈→번호 CTA 클릭 | `dream_id`, `dream_type` | ⏳ 미연결 |
| `generate_page_viewed` | `/generate` 진입(생성 여부와 무관) | `source`(`"direct"` \| `"dream"`) | ✅ `components/generate/NumberGenerator.tsx` |
| `fortune_viewed` | 오늘 결과 확인 | `is_return_visit` | ⏳ 미연결(아래 fortune_* 계열이 더 세분화된 대체) |
| `result_comparison_viewed` | 저장 번호 비교 확인 | `draw_id`, `saved_set_count` | ⏳ 미연결 |

미연결 4개는 전부 현재 서버 컴포넌트(Parent/Situation 페이지, `DreamSituationCard`)에
onClick이 필요한 링크라 클라이언트 컴포넌트 전환이 필요하다 — 애니메이션·저장 로직처럼
민감한 코드가 아니라 위험은 낮지만, 이번 작업에서는 §12(꿈 숫자 병합 로직)와 §13/§14(로그인
next/reason) 수정을 우선하느라 범위에서 제외했다. `trackProductEvent("이벤트명", {...})` 한
줄만 추가하면 되는 상태다.

### 오늘의 행운 funnel

`fortune_form_viewed`/`fortune_form_submitted`/`fortune_login_cta_clicked`/
`fortune_profile_saved`는 claude-code-luck-platform-fortune-domain-followup-prompt.md §21이
정의했다. `fortune_reveal_started`/`fortune_revealed`(단순히 "애니메이션이 재생됐는지")는
claude-code-luck-platform-daily-fortune-number-demo-prompt.md §6("결과를 다시 보는 행위를
신규 생성으로 집계하지 않는다")에 따라 **제거하고**
`fortune_generation_started`/`fortune_generated`/`fortune_result_reopened`/
`fortune_limit_hit`로 대체했다 — 같은 사용자 행동(공개 버튼 클릭/폼 제출)을 "애니메이션
재생 여부"와 "생성 vs 재확인" 두 축으로 동시에 추적하면 오히려 집계가 헷갈린다. `auth_state`는
`"anonymous" | "profile-pending" | "member"` 중 해당 화면이 실제로 쓰는 값만 쓴다.

| 이벤트 | 발생 시점 | 속성 | 상태 |
|---|---|---|---|
| `fortune_form_viewed` | 비회원/프로필 미완성 폼 노출 | `auth_state` | ✅ `components/fortune/GuestFortuneForm.tsx` |
| `fortune_form_submitted` | 유효한 폼 제출(브라우저 내 계산 완료 직후) | `auth_state`, `has_gender`, `has_birth_time` | ✅ `GuestFortuneForm.tsx` |
| `fortune_generation_started` | 오늘 새 운세 생성 시작(공개 버튼 클릭/폼 제출) | `auth_state` | ✅ `GuestFortuneForm.tsx`/`MemberFortuneReveal.tsx` |
| `fortune_generated` | 오늘 새 결과가 실제로 화면에 표시됨(애니메이션 종료 후, 한 번만) | `auth_state` | ✅ `GuestFortuneForm.tsx`/`MemberFortuneReveal.tsx` |
| `fortune_result_reopened` | 같은 날 기존 결과 재확인(회원 재방문, 비회원 같은 프로필 재제출/바로가기 클릭) | `auth_state` | ✅ `GuestFortuneForm.tsx`/`MemberFortuneReveal.tsx` |
| `fortune_limit_hit` | 비회원이 같은 날 같은 프로필로 다시 제출해 새 생성 대신 저장된 결과로 전환됨 | `auth_state`(`"anonymous"` \| `"profile-pending"`만) | ✅ `GuestFortuneForm.tsx` |
| `fortune_login_cta_clicked` | 비회원 결과 하단 로그인 CTA 클릭 | `location` | ✅ `GuestFortuneForm.tsx` (`location: "fortune_guest_result"`) |
| `fortune_profile_saved` | 사용자 확인 후 프로필 저장 성공 | `has_gender`, `has_birth_time` | ⏳ 미연결 — `ProfileFortuneFieldsForm.tsx`가 §11 "내 정보 수정"의 실제 저장 경로이지만, 이 이벤트는 §9(OAuth 직후 게스트 입력값을 확인 후 프로필에 저장하는 흐름)를 겨냥한 것이라 아직 그 흐름 자체가 구현되지 않았다(아래 "의도적으로 미룬 것" 참조). |

회원은 `MemberFortuneReveal.tsx`가 `isNew`(오늘 이미 DB row가 있었는지)로
`fortune_generation_started`/`fortune_result_reopened`를 분기하고, `fortune_generated`는
`isNew`일 때만 보낸다(재확인은 "생성"이 아니므로). 비회원은 `GuestFortuneForm.tsx`가
localStorage(`lib/storage/guestFortuneStore.ts`)에서 같은 날 같은 프로필 결과를 찾으면
`fortune_limit_hit`+`fortune_result_reopened`를 함께 보내고 새로 계산하지 않는다 — 폼 입력
전에 보여주는 "오늘 확인한 운세 다시 보기" 바로가기를 눌렀을 때도 `fortune_result_reopened`만
보낸다(그 시점엔 아직 "생성을 시도"한 게 아니므로 `fortune_limit_hit`은 보내지 않는다).

### 비회원 운세 계산의 서버 비경유(claude-code-luck-platform-daily-fortune-number-demo-prompt.md §13)

`GuestFortuneForm.tsx`는 더 이상 `/api/fortune/guest`를 호출하지 않는다(그 라우트 자체를
삭제했다) — `lib/logic/dailyFortune.ts`를 브라우저에서 직접 import해 계산한다. 이 파일이
쓰던 Node `crypto.createHash("sha256")`를 브라우저에도 있는 동기 해시(FNV-1a 32bit,
`hashToSeed()`)로 바꿔 Node 의존성을 없앴다 — 결과적으로 비회원의 생년월일·성별·태어난
시각은 그 어떤 네트워크 요청에도 실려 나가지 않는다.

### 비회원 하루 1회 제한 — localStorage 스키마 (`lib/storage/guestFortuneStore.ts`)

| 저장 키 | 값 | 서버 전송 |
|---|---|---|
| `luckplatform:fortune:salt:v1` | `crypto.getRandomValues()`로 만든 base64url device salt | 안 함 |
| `luckplatform:fortune:entry:v1:<profileKey>` | `{ schemaVersion, date, result, generatedAt }` | 안 함 |
| `luckplatform:fortune:index:v1` | `[{ profileKey, date, generatedAt }]`(생년월일 없음, "오늘 확인한 운세 다시 보기" 목록용) | 안 함 |

`profileKey` = SHA-256(schemaVersion + deviceSalt + 생년월일 + gender-or-unknown +
birthTime-or-unknown)의 hex 문자열(`lib/storage/guestFortuneKey.ts`) — 원래 생년월일을
복원할 수 없다. `schemaVersion` 불일치·JSON 파싱 실패는 조용히 폐기(재계산 유도), 7일보다
오래된 항목은 mount 시 자동 정리한다. `localStorage.setItem`이 throw하면(Safari 강화 개인정보
보호 모드, quota 초과 등) 세션 동안만 유지되는 메모리 Map으로 자동 전환하고 폼에
안내 문구를 띄운다(`isUsingMemoryFallback()`).

### 의도적으로 미룬 것 — OAuth 직후 게스트 입력값 프리필

claude-code-luck-platform-fortune-domain-followup-prompt.md §8/§9는 "로그인 전 입력한 값을
sessionStorage에 잠시 보관했다가, 로그인 후 사용자가 확인·동의하면 프로필에 저장"하는 흐름을
"구현한다면"이라는 조건으로 허용했다. 이번 작업에서는 구현하지 않았다 — 대신 `/fortune` 결과
하단 CTA로 로그인/온보딩까지만 안내하고, 프로필 저장은 기존 온보딩 폼(생년월일 필수 입력)과
`components/account/ProfileFortuneFieldsForm.tsx`(성별·태어난 시각만, `/my/account`)가 그대로
담당한다. 입력했던 값이 로그인 후 자동으로 넘어가지 않고 다시 입력해야 하는 것이 현재 동작이다
— "조용히 자동 저장"보다 안전한 손실이라고 판단했다(§8 "조용히 자동 저장하지 마라"의 반대
극단인 "아예 안 건드림"을 택함).

## 원칙

- `view`(조회)와 `success`(실제 성공)를 혼동하지 않는다 — 예: `number_saved`는 DB INSERT가
  실제로 성공한 뒤에만 보낸다(저장 실패/검증 실패 시 전송하지 않음).
- 개인식별정보(닉네임, 생년월일, 꿈 일기 원문 등)는 어떤 이벤트의 property로도 넣지 않는다.
- 같은 렌더링에서 이벤트가 중복 전송되지 않도록 각 호출부가 자체적으로 dedupe 키를 둔다
  (예: `NumberGenerator.tsx`의 `trackedKeyRef`).

## 핵심 Funnel과 North Star

North Star: **꿈 페이지에서 시작해 번호를 저장하고 해당 회차 결과 비교까지 완료한 주간
사용자 수.**

계산에 필요한 이벤트 체인(전부 위 표에 정의됨, 일부는 미연결):

```
dream_result_viewed → dream_number_cta_clicked → numbers_generated(source=dream)
  → save_number_clicked → login_started/login_completed(reason=save-number)
  → number_saved(source=dream) → result_comparison_viewed
```

각 단계 완료율 = 다음 단계 고유 사용자 수 / 이전 단계 고유 사용자 수. `dream_number_cta_clicked`,
`save_number_clicked`, `result_comparison_viewed`가 미연결이라 현재는 `numbers_generated`
(source=dream 비율)와 `number_saved`(source=dream 비율)까지만 실측 가능하다 — 나머지 3개
이벤트를 연결해야 전체 퍼널을 끝까지 볼 수 있다.
