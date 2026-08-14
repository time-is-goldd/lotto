-- 0011_profiles_auth_protection.sql
-- docs/PHASE2_AUTH_DECISION.md Decision 3 반영: profiles의 민감 컬럼(provider/birth_date/
-- age_verified/status)을 사용자가 직접 UPDATE로 조작할 수 없도록, `0008`에서 만든
-- profiles_insert_own/profiles_update_own 정책을 제거한다. RLS 정책은 컬럼 단위 제약을
-- 표현할 수 없어(OLD/NEW 비교는 트리거 전용 기능), 행 단위 정책만으로는 age_verified 같은
-- 민감 컬럼을 보호할 수 없다는 것이 근거다(docs/PHASE2_AUTH_ARCHITECTURE_AUDIT.md §3.3-A).
--
-- 이후 profiles INSERT/UPDATE는 app/api/profile/route.ts(service_role, RLS 우회)를 통해서만
-- 수행한다. "정책 없음 = 기본 차단" 원칙(docs/DATABASE_SCHEMA.md §6 "관리자 정책 공통 원칙"과
-- 동일 패턴)으로 authenticated 세션의 직접 INSERT/UPDATE 자체를 원천 차단한다.
--
-- 범위: 기존 테이블/컬럼/FK/INDEX를 변경하지 않는다. 0001~0010/0013을 수정하지 않는다.
-- 새 함수/트리거를 만들지 않는다. profiles_select_own(본인 SELECT)과 DELETE 미허용
-- (정책 없음, §7 A안 — 탈퇴는 UPDATE로 익명화)은 그대로 유지한다.

drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
