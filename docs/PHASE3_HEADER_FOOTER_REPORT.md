# PHASE3-3 HEADER / FOOTER / AUTH NAVIGATION 보고서

> Phase2 인증 시스템과 Phase3-2 Layout System을 연결해 공통 Header/Footer 및 최소 인증 UI를 구현한 결과다. 인증 로직·`proxy.ts`·Migration/DB/RLS는 전혀 수정하지 않았고, `getCurrentUser()`/`getProfile()`/`POST /api/auth/logout`을 그대로 재사용했다.

---

## 1. 생성/수정 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `components/layout/Header.tsx` | 신규 | 로고/Navigation placeholder/인증 영역 3분할, async Server Component |
| `components/layout/Footer.tsx` | 신규 | 서비스명/Copyright/정책 링크 placeholder |
| `components/auth/LoginButton.tsx` | 신규 | `/login`으로의 순수 네비게이션 링크 |
| `components/auth/ProfileMenu.tsx` | 신규 | 닉네임+마이페이지 링크+LogoutButton (드롭다운 아님, §6) |
| `components/auth/LogoutButton.tsx` | 신규 | 유일한 Client Component. `POST /api/auth/logout` 호출 후 이동 |
| `app/layout.tsx` | 수정 | `PageShell` 안에 `Header → Main → Footer` 순서로 연결 |
| `docs/PHASE3_HEADER_FOOTER_REPORT.md` | 신규 | 본 보고서 |

검증 중 만들었다가 삭제한 것: `app/api/e2etest8/route.ts`(카카오 API 없이 세션 발급용 임시 라우트), 테스트 계정 1개. 최종 코드베이스에 흔적 없음.

**폴더 위치 판단**: 지시문은 5개 컴포넌트를 전부 `components/layout/`에 두라고 예시했지만, [[PHASE3_UI_ARCHITECTURE_PLAN]] §3.2가 이미 `LoginButton`/`ProfileMenu`/`LogoutButton`을 `components/auth/`에 두기로 결정해둔 상태였다("기존 프로젝트 컨벤션과 충돌하면 더 적절한 구조로 판단"이 지시문 자체에도 허용되어 있음). 그 결정을 그대로 따라 `Header`/`Footer`만 `components/layout/`에, 인증 관련 3개는 `components/auth/`에 새로 만들었다 — 같은 값을 두 곳에서 다르게 정하지 않기 위해서다.

---

## 2. 컴포넌트 구조

```
app/layout.tsx
  └─ PageShell
       ├─ Header (async Server Component)
       │    ├─ 로고 (Link "/")
       │    ├─ <nav aria-label="주요 메뉴">  ← 빈 placeholder, flex-1로 자리만 차지
       │    └─ 인증 영역
       │         ├─ 비로그인            → LoginButton (Server, 순수 Link)
       │         ├─ 로그인 + profile 없음 → "온보딩 계속하기" Link (Header 안에 인라인)
       │         └─ 로그인 + profile 있음 → ProfileMenu (Server)
       │                                      └─ LogoutButton ("use client", 유일한 Client Component)
       ├─ Main
       │    └─ {children} ← 각 page.tsx
       └─ Footer (Server Component)
            ├─ 서비스명
            ├─ <nav aria-label="정책 및 안내">  ← 빈 placeholder
            └─ Copyright
```

**Client Component 최소화가 실제로 지켜졌는지**: `Header`/`Footer`/`LoginButton`/`ProfileMenu`는 전부 `"use client"` 없이 async/일반 Server Component다. `LogoutButton` 하나만 클릭 상호작용(상태 변경 + `fetch` + 라우팅)이 꼭 필요해 Client Component로 분리했다 — 이 트리 전체에서 클라이언트로 내려가는 JS는 `LogoutButton` 하나뿐이다.

---

## 3. 인증 상태별 UI

| 상태 | Header 인증 영역 |
|---|---|
| 비로그인 | "로그인" 버튼(`/login`으로 이동) |
| 로그인 + profile 없음 | "온보딩 계속하기" 버튼(`/onboarding`으로 이동) |
| 로그인 + profile 있음 | `{닉네임}님` + "마이페이지"(`/my/profile`) + "로그아웃" |

세 상태 모두 `Header`가 `getCurrentUser()` → (있으면) `getProfile(user.id)` 순으로 서버에서 직접 판정한다 — [[PHASE2_PROXY_REPORT]]/[[PHASE2_ONBOARDING_REPORT]]가 이미 쓰던 것과 동일한 두 함수를 그대로 재사용했을 뿐, 새 판정 로직을 만들지 않았다.

**ProfileMenu는 드롭다운이 아니다**: 지시문이 "Dropdown 라이브러리 설치 금지"라고 명시했고, 이번 Task 원칙("디자인보다 구조 우선", "디자인 고도화 금지")에도 맞춰, 열림/닫힘 상호작용이 있는 진짜 드롭다운 대신 **항상 펼쳐진 가로 배치**로 구현했다. 실제 드롭다운(포커스 트랩, 바깥 클릭 감지 등)은 클라이언트 상태 관리가 필요해 "Client Component 최소화"와 "디자인 고도화 금지" 두 원칙과 동시에 부딧힌다 — 디자인이 확정되는 이후 Task로 미룬다(§7).

---

## 4. Layout 연결 방식

`app/layout.tsx`에서 `PageShell` 자식으로 `Header`/`Main`/`Footer`를 형제로 나열했다(지시문이 요구한 순서 그대로). Phase3-2가 만들어둔 `PageShell`/`Main`의 내부 구조를 전혀 손대지 않고, 그 사이에 `Header`/`Footer`를 끼워 넣기만 했다 — [[PHASE3_LAYOUT_IMPLEMENTATION_REPORT]] §2가 "Header/Footer는 Main과 형제 위치, 나중에 한 줄만 바뀐다"고 예측한 그대로였다.

기존 3개 페이지(`/`, `/login`, `/onboarding`)의 `page.tsx`는 **한 글자도 수정하지 않았다** — `Header`/`Footer`가 전역 레이아웃(`app/layout.tsx`)에 추가된 것이라 각 페이지가 알 필요가 없다.

---

## 5. 접근성

- `<header>`/`<footer>`/`<nav>` 시맨틱 태그를 그대로 사용했다.
- `<nav aria-label="주요 메뉴">`(Header), `<nav aria-label="정책 및 안내">`(Footer) — 페이지에 `<nav>`가 여러 개 있을 미래를 대비해 지금부터 구분 가능한 라벨을 붙였다.
- `Main`의 `id="main-content"`(Phase3-2에서 이미 준비)는 여전히 존재하지만, 이번 Task는 "실제 메뉴 구현 금지"라 Header에 스킵 링크(`<a href="#main-content">본문으로 바로가기</a>`) 자체는 아직 추가하지 않았다 — 스킵 링크는 눈에 보이는 UI 요소라 "디자인 고도화 금지"·"실제 메뉴 구현 금지"에 해당한다고 판단해 다음 Task로 미뤘다(§7).
- 키보드 접근: 모든 상호작용 요소가 `<a>`(Link) 또는 `<button>`이다 — `<div onClick>` 같은 비시맨틱 클릭 핸들러를 하나도 쓰지 않았다. `<a>`/`<button>`은 브라우저가 기본으로 `Tab` 포커스 이동과 `Enter`/`Space` 활성화를 지원하므로 별도 키보드 이벤트 핸들러를 추가하지 않았다.

---

## 6. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 16개 테스트 통과(변경 없음) |
| `npm run build` | 통과(단, `/_not-found`가 `○`(정적)→`ƒ`(동적)로 바뀜 — §7-1 참조) |

### 실제 검증(`npm run dev` + `curl`, 실제 Supabase 프로젝트 대상)

카카오 API를 호출하지 않고 `establishKakaoSupabaseSession()`(기존 코드, [[PHASE2_KAKAO_E2E_REPORT]] 방법과 동일)으로 세션을 발급하는 임시 라우트를 사용했다. 검증 후 라우트/테스트 계정 전량 삭제.

| 시나리오 | 결과 |
|---|---|
| 비로그인 `/` Header | "로그인" 버튼 렌더링 확인(HTML 직접 확인) |
| 비로그인 `/login` Header/Footer | 둘 다 정상 렌더링, Footer 서비스명/Copyright 확인 |
| 비로그인 `/onboarding` | `307` → `/login?next=%2Fonboarding`(기존 그대로, `proxy.ts` 영향 없음) |
| 로그인 + profile 없음 `/` Header | "온보딩 계속하기" 버튼 렌더링 확인 |
| 로그인 + profile 있음(`POST /api/profile`로 생성 후) `/` Header | `{닉네임}님` + 마이페이지 + 로그아웃 렌더링 확인 |
| `POST /api/auth/logout` 호출 | `200 {"success":true}` |
| 로그아웃 후 같은 쿠키로 `/` Header | "로그인" 버튼으로 정상 복귀(서버가 실제로 비로그인 상태를 인식) |
| 로그아웃 후 `/onboarding` 접근 | `307` → `/login?next=%2Fonboarding`(로그아웃이 `proxy.ts` 판정에도 정확히 반영됨) |

**검증하지 못한 부분(환경 제약, 기존 Task들과 동일한 한계)**: 이 환경에는 실제 브라우저가 없어, `LogoutButton`을 실제로 **클릭**했을 때 페이지 새로고침 없이 Header가 즉시 "로그인" 상태로 바뀌는지(클라이언트 사이드 `router.push`+`router.refresh()` 동작)는 확인하지 못했다. 위 표의 "로그아웃 후 Header" 검증은 **새 HTTP 요청**(서버가 다시 렌더링)을 기준으로 한 것이며, 이는 `router.refresh()`가 수행하는 것과 동일한 종류의 재요청이라 서버 로직의 정확성은 충분히 검증됐다고 판단한다.

---

## 7. 발견한 문제

1. **Header의 세션 조회가 `/_not-found`를 포함해 사실상 모든 경로를 동적 렌더링으로 강제한다** — [[PHASE3_UI_ARCHITECTURE_PLAN]] §7-3이 이론적으로 예측했던 리스크가 이번 빌드에서 실제로 확인됐다(`npm run build` 결과 `/_not-found`가 `○`→`ƒ`로 전환). 지금은 콘텐츠 페이지가 하나도 없어(전부 인증/폼 페이지) 실질적 피해가 없지만, **Phase7(꿈해몽)에서 SSG/ISR 대상 정적 페이지가 추가되는 순간 이 문제가 실제로 발생한다.** 이번 Task에서는 Suspense 경계 등의 해결책을 적용하지 않았다 — 지금 정적 페이지가 전혀 없는 상태에서 그 해법(캐싱 전략, PPR 등)을 확정하는 것은 근거 없는 선제 최적화라고 판단했다([[AI_ENGINEERING_CONSTITUTION]] §15-21 "지금 필요하지 않은 최적화를 미리 하지 않는다"). **Phase7 착수 전 반드시 재검토가 필요한 항목으로 명시한다.**
2. **스킵 링크(본문으로 바로가기) 미구현** — `Main`의 `id="main-content"`는 준비돼 있지만, 실제로 그것을 가리키는 링크 UI는 "실제 메뉴 구현 금지"/"디자인 고도화 금지"에 해당한다고 보고 이번엔 추가하지 않았다. 접근성 완성도를 위해 다음 디자인 관련 Task에서 처리 권장.
3. **ProfileMenu가 실제 드롭다운이 아님** — §3에서 설명한 의도된 최소 구현. 디자인이 확정되면 열림/닫힘 상호작용을 추가하는 별도 Task가 필요하다.
4. **LogoutButton의 클라이언트 사이드 시각적 갱신은 실측하지 못함** — §6 "검증하지 못한 부분" 참조, 환경 제약.
5. 그 외 `proxy.ts`/인증 로직/Migration에 대한 영향은 발견되지 않았다 — 전혀 수정하지 않았고 실제 요청으로 동작 변화가 없음을 확인했다.

---

## 8. Phase3-4 착수 가능 여부 (Auth UI 개선 또는 Bottom Navigation)

**가능.** Header/Footer가 실제 인증 상태 3가지 전부를 정확히 반영하고, `proxy.ts`/기존 인증 흐름에 어떤 영향도 주지 않음을 실측으로 확인했다. Bottom Navigation을 다음에 붙이더라도 `PageShell`(Header/Main/Footer의 형제 구조)을 그대로 재사용할 수 있다. 다만 §7-1(정적 페이지 강제 동적화)은 Phase7 착수 전에는 반드시 짚어야 하고, ProfileMenu의 실제 드롭다운화·스킵 링크 추가는 디자인이 더 확정된 이후 Task로 넘긴다.
