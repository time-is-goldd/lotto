# Phase10-5 — 실제 운영자 Kakao Browser E2E + Admin Registration 보고서

**이 보고서는 합성(synthetic) 세션이 아니라, 실제 운영자가 자신의 Kakao 계정으로 브라우저에서 직접 로그인한 결과를 검증한 기록이다.** 로그인/재로그인/온보딩/관리자 등록 단계 어디에도 테스트 헬퍼로 대체한 부분이 없다.

## 1. 기존 Kakao auth architecture

Phase2에서 설계된 구조를 그대로 재사용했다(재설계 없음): `app/login/page.tsx`(카카오로 로그인 링크) → `app/api/auth/kakao/login/route.ts`(state를 httpOnly 쿠키에 저장하고 Kakao 인가 URL로 리다이렉트, `redirect_uri`는 `NEXT_PUBLIC_SITE_URL` 기반으로 계산) → `app/api/auth/kakao/callback/route.ts`(state 검증, 토큰 교환, 프로필 조회, 세션 발급, 프로필 존재 여부에 따라 리다이렉트) → `lib/auth/kakao.ts`(`deriveKakaoSyntheticEmail`로 결정적 합성 이메일 생성, `establishKakaoSupabaseSession`이 `generateLink`+`verifyOtp`로 실제 세션 발급, `app_metadata.auth_provider`를 커스텀 키로 별도 저장) → 필요 시 `/onboarding`(프로필 없을 때만) → `app/api/profile/route.ts`(프로필 생성). `proxy.ts`가 `/onboarding`, `/my/*`, `/login`, `/api/admin/*`를 게이트한다. 코드 변경 없이 그대로 사용했다.

## 2. 실제 Browser Login 결과

운영자가 `http://localhost:3000/login`에서 카카오로 로그인 버튼을 눌러 실제 본인 Kakao 계정으로 로그인했다. 진행 중 Kakao Developers Console의 **Redirect URI 미등록(KOE006)** 오류가 실제로 발생해 함께 해결했다 — 원인은 "카카오 로그인 리다이렉트 URI" 칸에 전체 경로가 아니라 origin만(`http://localhost:3000`) 등록돼 있었던 것으로, `http://localhost:3000/api/auth/kakao/callback`(전체 경로)로 정정 후 정상 진행됐다. 이는 §24가 허용하는 "발견된 명확한 auth bug"가 아니라 운영자 측 외부 설정(Kakao Developers Console) 문제였다 — 코드 수정은 없었다.

## 3. callback

콜백이 정상적으로 인가 코드를 받아 토큰 교환 → 프로필 조회 → 세션 수립까지 완료됐다. 최초 로그인 시 프로필이 없어 `/onboarding`으로 진입했고, 온보딩 완료 후 정상적으로 사이트에 진입했다.

## 4. Supabase user 생성

실제 remote Supabase에서 직접 확인: `auth.users`에 실제 운영자 계정 1건 생성됨. 합성 이메일은 설계된 패턴(`kakao-{카카오id}@users.noreply.luckplatform.local`) 그대로였고, 실제 카카오 이메일은 전혀 저장되지 않는다 — 이 보고서에도 전체 값을 적지 않고 도메인 뒷부분만 남기고 마스킹했다.

## 5. profile/onboarding

`profiles`에 동일 user id로 1건 생성됨, `provider: "kakao"`(자동 판정, 클라이언트 입력 아님), `status: "active"`. 운영자가 실제로 입력한 nickname은 별도 값(카카오 프로필 기본값이 아니라 온보딩에서 직접 정한 값)이며, 이 보고서에는 기록하지 않는다(§18/§19).

## 6. logout

운영자가 실제로 로그아웃을 수행했고, 이후 `/login` 재접근 시 비로그인 상태로 정상 전환됨을 확인했다.

## 7. same-account relogin

로그아웃 후 **같은 Kakao 계정**으로 재로그인했다. 결과: `auth.users` 여전히 1건(신규 행 생성 안 됨), 같은 user id의 `last_sign_in_at`만 갱신됨(재로그인이 실제로 반영됐다는 증거), `profiles` 여전히 1건, 온보딩 화면이 다시 뜨지 않음(운영자 직접 확인) — 전부 기대한 대로였다.

## 8. duplicate prevention

위 §7 재로그인 검증이 곧 중복 방지 검증이다 — `auth.users`/`profiles` 둘 다 중복 행이 생기지 않았다. `deriveKakaoSyntheticEmail`이 카카오 id 기반 결정적 함수이기 때문에 같은 카카오 계정은 항상 같은 합성 이메일 → 같은 Supabase user로 귀결되는 설계가 실제로 작동함을 실측으로 확인했다.

## 9. session persistence

운영자가 로그인 상태에서 `/`, `/fortune`, `/generate`, `/my/journal`, `/my/journal/results`를 차례로 방문하고 새로고침까지 수행해 세션이 끊기지 않음을 직접 확인했다.

## 10. Daily Fortune 실제 계정 검증

운영자가 `/fortune`에서 실제 계정으로 오늘의 운세를 생성했고(`fortune_results`에 1건, `result_date`가 오늘 날짜), 새로고침 후에도 같은 결과가 나왔음을 운영자가 직접 확인했다 — DB로도 재확인한 결과 같은 user+날짜 조합에 행이 정확히 1건뿐이었다(중복 생성 없음). RLS 확인: `fortune_results_select_own`(0017, `to authenticated`만, anon 정책 없음)이 그대로 유지되고 있고, 익명 키로 직접 SELECT를 시도한 결과 빈 배열만 반환됨을 확인했다 — Phase10-4B의 privacy fix에 회귀가 없다.

## 11. admin registration procedure

Phase6/Phase9가 설계한 방식 그대로 — `admins` 테이블은 client INSERT 정책이 없어(0012) `service_role`로만 행을 추가할 수 있다. 등록 전 3가지를 직접 재확인했다: (1) 해당 `auth.users` 행이 실재하는지, (2) 해당 `profiles` 행이 실재하는지, (3) `admins`에 아직 없는지 — 셋 다 확인 후, **§2~§10에서 실제로 로그인/재로그인까지 검증을 마친 바로 그 user id**로 `role: "super"`(스키마의 유일한 enum 값, 0012 원문 확인) 행을 1건 삽입했다. UID/이메일을 하드코딩하지 않았고, migration도 추가하지 않았다 — 순수 데이터 삽입(one-time service_role 절차)이다.

## 12. admin route verification

운영자가 실제 로그인 세션 그대로(재로그인 불필요) `/admin`, `/admin/draws`, `/admin/dreams`, `/admin/faq`, `/admin/guides`에 정상 접근했고, `/admin/dreams/[id]/edit`에서 세부 꿈 상황 목록도 정상적으로 보임을 확인했다. 운영 콘텐츠는 전혀 수정하지 않았다.

## 13. normal user protection

별도 임시 테스트 계정(가짜 카카오 id, `admins` 행 없음)으로 검증: `GET /admin` → `404`(관리자 아님, 기존 `app/admin/layout.tsx`의 `notFound()` 그대로), `POST /api/admin/draws`/`POST /api/admin/dreams` → 둘 다 `403`. `admins` 테이블에 대한 self-promotion 시도(anon 키로 직접 INSERT)는 `401`/`42501`("row-level security policy" 위반) — 클라이언트 INSERT 정책이 아예 없어 DB 레벨에서 원천 차단됨을 실측으로 확인했다. 테스트 계정은 검증 직후 삭제했다.

## 14. redirect URI

dev 환경 기준 실제 코드가 요청하는 콜백 URI를 직접 계산해 확인했다: `http://localhost:3000/api/auth/kakao/callback`(`NEXT_PUBLIC_SITE_URL` + 고정 경로, 코드에서 하드코딩 아님). §2에서 겪은 KOE006도 바로 이 값이 Kakao Developers Console에 등록돼 있지 않아 발생한 문제였다 — 등록 후 해결됨을 실측으로 확인했다. Production redirect URI는 실제 배포 도메인이 정해지면 같은 패턴(`{production 도메인}/api/auth/kakao/callback`)으로 등록하면 된다 — 이번 Task 시점에는 production 도메인이 아직 없어(로컬 dev만 검증 대상) 실제 등록 여부는 확인 대상에서 제외했다.

## 15. error handling

기존 콜백 에러 처리(카카오 거부 시 `reason=kakao_denied`, state 불일치/누락 시 `reason=invalid_state`, 서버 오류 시 `reason=server_error`)는 코드 리뷰로 재확인했다 — raw OAuth/Supabase 에러나 시크릿을 사용자에게 노출하지 않는 구조 그대로다. 이번 Task에서 실제로 겪은 유일한 에러(KOE006)는 Kakao 자체 화면에서 발생한 것으로, 이 앱의 에러 핸들링 코드 경로를 거치지 않았다(콜백에 도달하기 전 단계).

## 16. secrets/privacy

이 보고서 어디에도 카카오 access/refresh token, service role key, 전체 합성 이메일, OAuth secret을 그대로 적지 않았다 — 이메일은 도메인 뒷부분만 남기고 마스킹했고, nickname/birth_date 등 운영자가 입력한 개인 정보는 기록하지 않았다. §3(환경변수)도 존재 여부만 확인하고 값은 출력하지 않았다.

## 17. account withdrawal 현 상태

회원 탈퇴/`auth.admin.deleteUser`/프로필 익명화·삭제 기능은 **코드베이스 어디에도 존재하지 않는다**(`app/`, `lib/`, `components/` 전수 검색으로 재확인 — 짐작이 아니다). `profiles.status` enum에 `"withdrawn"` 값은 정의돼 있지만 실제로 이 값을 읽거나 쓰는 코드는 없다. `app/privacy/page.tsx`에 탈퇴 관련 문구가 있다면 실제 구현과 어긋날 수 있어 수정 후보로 남긴다 — 이번 Task에서 대규모 법적 문서 재작성은 하지 않았다. **Launch Blocker 후보로 기록**(§21).

## 18. operator/legal info 남은 항목

운영자가 이번에 로그인에 사용한 Kakao nickname/프로필을 사업자 정보나 법적 운영자 정보로 자동 사용하지 않았다 — 완전히 별개로 취급했다. Phase10-3에서 남겨진 필요 정보(공개 연락 채널, 사업자/운영자 정보, 탈퇴 정책)는 이번 Task 범위가 아니며 여전히 별도 결정이 필요한 상태로 남아있다.

## 19. tests/build

- `tsc --noEmit`: 통과.
- `next lint`: 통과.
- 전체 테스트: **463 passed**(기존과 동일 — 이번 Task는 코드 변경이 없는 순수 검증 Task라 테스트 파일도 추가/수정하지 않았다).
- `next build`: 성공, 라우트 51개(변경 없음 — 임시 `app/api/jtest/route.ts`는 빌드 전 삭제해 최종 빌드에 포함되지 않는다).
- migration: `0001~0019`(변경 없음, 이번 Task는 migration을 추가하지 않았다).

## 20. cleanup

테스트로 만든 것만 정리했다: 임시 정상-사용자 테스트 계정 1건(`auth.users`에서 삭제), 임시 검증 라우트 `app/api/jtest/route.ts`(파일 삭제, 흔적 없음). **실제 운영자의 `auth.users`/`profiles`/`admins`/`fortune_results` 행은 전부 그대로 유지했다** — 실사용 데이터로 간주해 삭제하지 않았다. 최종 상태 재확인: `auth.users` 1건(운영자만), `profiles` 1건, `admins` 1건(role: super), `fortune_results` 1건, `dreams` 25건(불변), `dream_situations` 101건(불변), `draws` 10건·회차 1227~1236(불변).

## 21. 남은 Launch Blockers

1. **회원 탈퇴 기능 부재**(§17) — 실제 운영자 계정이 이제 존재하므로, 정식 서비스 오픈 전 반드시 결정/구현이 필요하다.
2. **사업자/운영자 법적 정보, 공개 연락 채널, 탈퇴 정책 미확정**(§18, Phase10-3에서 이미 식별된 항목, 여전히 미해결).
3. **Production redirect URI 미등록**(§14) — production 도메인이 정해지는 즉시 Kakao Developers Console에 `{production 도메인}/api/auth/kakao/callback`을 추가로 등록해야 한다.

## 22. 다음 작업 추천

**로또 당첨번호 자동 연동** — 운영자가 검증 중 직접 요청한 사항으로, 현재는 `/admin/draws`에서 매 회차를 수동 입력해야 한다. 공식 로또 사이트에서 회차 데이터를 가져와 자동으로 반영하는 기능(스크래핑/공식 API 연동 + 주기적 실행)을 별도 Task로 검토할 것을 권장한다 — 이번 Task 금지 목록(Edge Function/Cron/automatic content-generation runtime)과 겹치는 부분이 있어 아키텍처 결정이 먼저 필요하다.

---

## TASK REPORT — Kakao Operator E2E

- **Real Human Kakao Login**: 완료(운영자 본인 Kakao 계정, 실제 브라우저)
- **Synthetic Session Used As Substitute**: 아니오(로그인/재로그인/온보딩/관리자 등록 전 과정 실제 인간 수행 — synthetic 세션은 §13 일반 사용자 보호 검증에서만, 그마저도 별도 격리된 테스트 계정으로만 사용)
- **Supabase Auth User**: 생성됨(1건, 실제 운영자)
- **Profile**: 생성됨(1건, `provider: kakao`, `status: active`)
- **Onboarding**: 완료(최초 1회만 노출, 재로그인 시 재노출 안 됨)
- **Logout**: 정상 동작
- **Same-account Relogin**: 성공(동일 user id 유지)
- **Duplicate Auth User**: 없음(재로그인 후에도 1건 유지)
- **Duplicate Profile**: 없음(재로그인 후에도 1건 유지)
- **Session Persistence**: PASS(`/`, `/fortune`, `/generate`, `/my/journal`, `/my/journal/results` + 새로고침 전부 유지)
- **Daily Fortune Real Account**: PASS(실제 생성, 동일 날짜 재조회 시 동일 결과, RLS anon 차단 유지)
- **Operator Admin Registered**: 완료(실제 로그인에 쓰인 user id, `role: super`, 하드코딩 없음)
- **Admin Dashboard**: PASS(`/admin` 접근 확인)
- **Admin Draws**: PASS(`/admin/draws` 접근 + 잘못된 값 제출 시 검증 오류만 발생, 실제 회차 미추가)
- **Admin Dreams**: PASS(`/admin/dreams` + 세부 상황 목록까지 확인)
- **Admin FAQ**: PASS
- **Admin Guides**: PASS
- **Normal User Admin Access**: 차단됨(`/admin` 404, admin API 403, self-promotion RLS 거부 42501)
- **Admin API Gate**: PASS(관리자 인증 통과 후 validation에서 정상 거부, raw 에러 미노출)
- **Hardcoded UID/Email**: 없음
- **Tests**: 463 passed(기존과 동일, 코드 변경 없음)
- **Build**: 성공(라우트 51개, 변경 없음)
- **Cleanup**: PASS(테스트 계정/임시 라우트만 삭제, 실제 운영자 데이터 전부 유지)
- **Kakao E2E**: **PASS**
- **Remaining Launch Blockers**: 회원 탈퇴 기능 부재 / 사업자·운영자 법적 정보 미확정 / production redirect URI 미등록
- **다음 작업**: 로또 당첨번호 공식 사이트 자동 연동 검토
