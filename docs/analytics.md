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
| `dream_result_viewed` | Parent/Situation 진입 | `dream_id`, `dream_type`, `referrer_type` | ⏳ 미연결 |
| `related_dream_clicked` | 관련 꿈 클릭 | `from_dream_id`, `to_dream_id` | ⏳ 미연결 |
| `dream_number_cta_clicked` | 꿈→번호 CTA 클릭 | `dream_id`, `dream_type` | ⏳ 미연결 |
| `save_number_clicked` | 저장 CTA 클릭(비회원 로그인 유도 포함) | `authenticated`, `source` | ⏳ 미연결 |
| `fortune_viewed` | 오늘 결과 확인 | `is_return_visit` | ⏳ 미연결 |
| `result_comparison_viewed` | 저장 번호 비교 확인 | `draw_id`, `saved_set_count` | ⏳ 미연결 |

미연결 6개는 전부 현재 서버 컴포넌트(Parent/Situation 페이지, `DreamSituationCard`)에
onClick이 필요한 링크라 클라이언트 컴포넌트 전환이 필요하다 — 애니메이션·저장 로직처럼
민감한 코드가 아니라 위험은 낮지만, 이번 작업에서는 §12(꿈 숫자 병합 로직)와 §13/§14(로그인
next/reason) 수정을 우선하느라 범위에서 제외했다. `trackProductEvent("이벤트명", {...})` 한
줄만 추가하면 되는 상태다.

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
