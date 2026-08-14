# PHASE3 유지보수 Task 보고서 — High/Medium 항목 정리

> `docs/PHASE3_FINAL_AUDIT_REPORT.md`에서 발견된 High 2건/Medium 2건을 최소 범위로 정리한 결과다. 새 기능·새 페이지·Header/BottomNavigation/GNB 재설계·OAuth·`proxy.ts`·DB/RLS는 전혀 건드리지 않았다. `DESIGN_SYSTEM.md`의 공식 색상 토큰 값도 변경하지 않았다.

---

## 1. 생성/수정 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `components/auth/LoginButton.tsx` | 수정 | className을 `PRIMARY_LINK_BUTTON_CLASSNAME` named export로 분리 + `hover:bg-primary-dark` 추가 |
| `components/layout/Header.tsx` | 수정 | "온보딩 계속하기" 링크가 `PRIMARY_LINK_BUTTON_CLASSNAME` 재사용(중복 제거), 인증 영역 wrapper에 `min-w-0` 추가 |
| `components/auth/ProfileMenu.tsx` | 수정 | 모바일 오버플로우 대응(`min-w-0`/`flex-1`/`truncate`/`shrink-0`) |
| `components/auth/LogoutButton.tsx` | 수정 | `shrink-0 whitespace-nowrap` 추가(ProfileMenu 내 다른 액션과 동일한 안전장치) |
| `components/ui/Button.tsx` | 수정 | `secondary` variant에 `hover:bg-bg-subtle` 추가(기존 토큰 재사용), `destructive`는 대응 토큰이 없어 미변경 + 사유 주석 |
| `components/navigation/BottomNavigation.tsx` | 수정 | 낡은 "placeholder nav" 주석을 실제 구조(GlobalNav)에 맞게 정정 |
| `docs/PHASE3_MAINTENANCE_REPORT.md` | 신규 | 본 보고서 |

`app/page.tsx`(h3 타이포그래피), `DESIGN_SYSTEM.md`(색상 토큰), `proxy.ts`, Header/BottomNavigation/GNB의 구조 자체는 지시대로 변경하지 않았다.

검증 과정에서 만든 임시 파일(`app/api/dev-test-login`, `.wcag_context_check.js`, `scratch_cleanup_test_user.mjs`)과 실제 Supabase 프로젝트에 만들었던 테스트 계정(`kakao-999999901@...`)은 전부 삭제·정리했다.

---

## 2. High 문제 해결 결과

### 2-1. ProfileMenu 모바일 오버플로우 — 해결

`components/auth/ProfileMenu.tsx`:
```tsx
<div className="flex min-w-0 items-center gap-3 text-sm">
  <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{nickname}님</span>
  <Link href="/my/profile" className="shrink-0 text-text-secondary">마이페이지</Link>
  <LogoutButton />  {/* shrink-0 whitespace-nowrap 추가 */}
</div>
```

- **닉네임 내용은 그대로 유지**한다 — DOM에는 전체 닉네임 문자열이 그대로 남고, 공간이 부족할 때만 CSS `truncate`(`overflow:hidden; text-overflow:ellipsis; white-space:nowrap`)로 시각적으로만 말줄임표 처리한다. 삭제·축약된 텍스트를 서버나 클라이언트 상태에 저장하지 않는다.
- **"마이페이지"/"로그아웃"은 항상 완전한 형태로 유지**한다 — `shrink-0`으로 두 액션이 압축·잘림 없이 항상 클릭 가능하게 남고, 남는 공간이 부족해지면 닉네임 쪽(`flex-1`)만 줄어든다.
- `min-w-0`을 나머지 하나(`Header.tsx`의 인증 영역 wrapper `<div className="flex min-w-0 items-center gap-4">`)에도 전파했다 — flex item의 기본값(`min-width:auto`)이 하위 `truncate`의 축소를 막는 문제가 있어, 이 값이 없으면 ProfileMenu 안의 `truncate`가 실제로는 동작하지 않는다.
- **디자인 변경 없음**: 색상·간격·폰트·아이콘 등 시각적 스타일은 전혀 바꾸지 않았고, 레이아웃 동작(무엇이 줄어들고 무엇이 유지되는지)만 CSS로 제어했다.

**실측 검증**: 실제 Supabase 프로젝트에 카카오 API를 우회한 테스트 계정(닉네임 11자, "테스트닉네임아주길게씀")을 만들어 로그인 상태로 홈 페이지를 렌더링한 결과, `ProfileMenu`가 의도한 클래스 그대로 렌더링됨을 확인했다.
```html
<div class="flex min-w-0 items-center gap-3 text-sm">
  <span class="min-w-0 flex-1 truncate font-medium text-text-primary">테스트닉네임아주길게씀님</span>
  <a class="shrink-0 text-text-secondary" href="/my/profile">마이페이지</a>
  <button type="button" class="shrink-0 whitespace-nowrap text-text-secondary disabled:opacity-50">로그아웃</button>
</div>
```
검증 후 테스트 계정(`auth.users`/`profiles`)은 service_role로 완전히 삭제했다.

### 2-2. color-danger / color-success 대비 문제 — 미해결(보고), 토큰 변경 없음

지시받은 대로 실제 foreground/background 조합별로 WCAG 2.1 상대 휘도 공식을 다시 계산했다(단순히 색상 대 흰색이 아니라, 코드베이스에서 실제로 쓰이는 조합 전부):

| 실제 사용 맥락 | 조합 | 대비율 | 판정 |
|---|---|---|---|
| `Input.tsx`/`Textarea.tsx` 에러 텍스트 | `text-danger`(#E0353B) on `bg-base`(#FFFFFF) | 4.429:1 | 일반 텍스트 기준 FAIL (큰 텍스트만 통과) |
| `Button.tsx` destructive 텍스트 | 흰 텍스트 on `bg-danger`(solid) | 4.429:1 | 위와 동일(수학적으로 순서만 바뀐 동일 조합) |
| `Badge.tsx` danger variant | `text-danger` on `bg-danger/10`(흰 배경에 10% 블렌딩된 실제 렌더 색, 약 #FCEBEB) | **3.838:1** | FAIL(큰 텍스트만 겨우 통과) — **흰 배경 위보다 오히려 더 나쁨** |
| `Badge.tsx` success variant | `text-success`(#1AA260) on `bg-success/10`(약 #E8F6EF) | **2.951:1** | **완전 FAIL**(큰 텍스트 기준도 미달) |

**판단(A vs B)**:

- **B(배경/맥락 변경)로 해결 불가능하다는 것을 확인했다.** Badge의 10% 틴트 배경은 흰색에 가까워질수록(투명도를 낮출수록) 대비가 개선되는 방향인데, 이는 결국 "흰 배경 위에 그 색 텍스트"라는 최선의 경우로 수렴한다 — 그런데 그 최선의 경우조차 `color-danger`는 4.429:1(4.5:1에 0.07 부족), `color-success`는 원래 흰 배경에서도 3.29:1(4.5:1에 크게 못 미침)이라 **어떤 배경 조합을 골라도 두 토큰 모두 일반 텍스트 기준 AA를 통과할 수 없다.** 오히려 현재 Badge가 쓰는 자기 색상 위 10% 틴트는 흰 배경보다 대비가 더 나빠, "배경만 바꿔서 해결"이 아니라 사실상 "무엇을 배경으로 골라도 안 되는" 상황이다.
- **A(토큰 값 자체 변경)만이 실질적 해결책이다.** `color-danger`/`color-success`는 `DESIGN_SYSTEM.md` §1.2의 공식 색상값이라, 지시에 따라 **사용자 승인 없이 변경하지 않았다.** 이번 Task에서는 중단하고 보고한다.
- 참고로 두 값 모두 현재는 `/ui-preview`(개발 전용, `noindex`)에서만 실제로 노출되고, `Input`/`Button`의 danger 관련 텍스트도 아직 실제 프로덕션 페이지에서 트리거되는 경로가 없다(에러 상태를 실제로 보여주는 완성된 폼 페이지가 아직 없음) — 당장 사용자에게 노출되는 결함은 아니지만, Phase4에서 실제 폼/알림 UI가 만들어지면 즉시 노출될 것이다.

**권장(결정 필요, 이번 Task 범위 밖)**: `color-danger`를 좀 더 어둡게(예: 채도는 유지하되 명도를 낮춘 톤), `color-success`도 마찬가지로 조정하면 AA를 만족시킬 수 있다 — 다만 이는 브랜드 색상 결정이라 사용자 승인이 필요하다.

---

## 3. Medium 문제 해결 결과

### 3-1. className 중복 — 해결

`LoginButton.tsx`에 `PRIMARY_LINK_BUTTON_CLASSNAME` 상수를 새로 export하고, `LoginButton`과 `Header.tsx`의 "온보딩 계속하기" 링크가 이 상수 하나를 공유하도록 정리했다. 지시대로 별도 컴포넌트나 새 추상화 파일을 만들지 않고, 기존 파일(`LoginButton.tsx`)의 export만 늘리는 최소한의 방법을 택했다 — `components/ui/Button.tsx`가 이미 `buttonClassName()`을 같은 방식(문자열 export)으로 내보내고 있어 기존 프로젝트 관례와도 일치한다.

### 3-2. hover 상태 — 부분 해결(destructive는 토큰 없어 보고만)

- **"온보딩 계속하기" 링크 / `LoginButton`**: `PRIMARY_LINK_BUTTON_CLASSNAME`에 `hover:bg-primary-dark` 추가. `color-primary-dark`는 `DESIGN_SYSTEM.md` §1.1에 "호버/프레스 상태"로 이미 정의된 공식 토큰이라 새 색상이 아니다.
- **`Button.tsx` secondary variant**: `hover:bg-bg-subtle` 추가. `color-bg-subtle`은 이미 `ghost` variant의 호버로 쓰이던 토큰을 그대로 재사용한 것이라 새 색상이 아니다.
- **`Button.tsx` destructive variant**: **호버 없음, 미변경.** `DESIGN_SYSTEM.md`에는 `color-danger`의 호버/프레스 톤(예: `color-danger-dark`)이 전혀 정의돼 있지 않다 — `color-primary`만 `color-primary-dark`라는 전용 호버 톤을 갖고 있다. 지시("정의되어 있지 않다면 임의의 색상을 만들지 말고 보고한다")에 따라 임의로 어둡게 만들거나 투명도를 조정하지 않고, 코드 주석에 사유를 남기고 이 보고서로 보고한다. **결정 필요**: `color-danger-dark` 토큰을 `DESIGN_SYSTEM.md`에 새로 정의할지, 아니면 destructive 버튼은 호버 없이 유지할지 사용자 판단이 필요하다.

---

## 4. Low 문제 처리 결과

- **`BottomNavigation.tsx` 주석 정정**: "Header의 placeholder nav" → "Header가 렌더링하는 GlobalNav"로 수정해 Phase3-7 이후의 실제 구조와 일치시켰다. 랜드마크 라벨을 분리한 이유(중복 방지)라는 핵심 내용은 그대로 유지했다.
- **`app/page.tsx`의 `<h3>`가 `text-h2` 토큰을 쓰는 부분**: heading 계층(h1→h2→h3) 자체에는 문제가 없음을 재확인했다 — 지시대로 **변경하지 않았다**.

---

## 5. WCAG 대비 검증 결과 (요약)

§2-2의 표 참고. 결론: `color-danger`/`color-success`는 어떤 실제 사용 맥락(흰 배경, 자기 색상 틴트 배경, 반전 배경)에서도 일반 텍스트 기준 WCAG AA(4.5:1)를 만족하지 못한다 — 토큰 값 자체의 문제이며, 이번 Task에서는 승인 없이 변경하지 않고 보고로 남긴다.

---

## 6. Validation 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 16개 테스트 통과 |
| `npm run build` | 통과, 라우트 목록 변경 없음(테스트용 임시 라우트 삭제 후 재확인) |

### 추가 검증

| 확인 대상 | 결과 |
|---|---|
| 375px 모바일 ProfileMenu 오버플로우 | 실제 로그인 세션(닉네임 11자)으로 렌더링 결과 확인 — 닉네임은 `truncate`, 마이페이지/로그아웃은 `shrink-0`으로 항상 완전한 형태 유지 |
| 768px breakpoint Header/BottomNavigation 교대 | 기존 `md:flex`/`md:hidden` 구조를 건드리지 않았고, 이번 수정(`min-w-0`, `shrink-0`, hover 클래스)이 breakpoint 자체에 영향 없음을 코드 검토로 확인 |
| 실제 foreground/background WCAG 대비 | §2-2, §5 |
| `/`, `/login`, `/onboarding`, `/ui-preview` 회귀 | `/` 200, `/login` 200, `/onboarding`(비로그인) 307→`/login?next=%2Fonboarding`, `/ui-preview` 200 — 전부 회귀 없음 |
| 인증 상태별 Header 회귀 | 비로그인(LoginButton, hover 클래스 포함) / 로그인+profile없음("온보딩 계속하기", 동일 클래스 공유 확인) / 로그인+profile있음(ProfileMenu, 오버플로우 수정 클래스 확인) 3가지 상태 전부 실제 Supabase 세션으로 렌더링 확인 |
| `proxy.ts` 동작 회귀 | 파일 자체를 열지도 수정하지도 않았음. `/onboarding` 리다이렉트가 기존과 동일하게 동작함을 실측 확인 |
| `git diff` 의도치 않은 변경 확인 | `git status`로 이번 Task에서 건드린 파일이 §1 목록과 정확히 일치함을 확인, 테스트용 임시 라우트/스크립트/계정은 전부 삭제됨 |

---

## 7. 발견된 추가 문제

새로 발견된 문제는 없다. §2-2에서 다룬 색상 대비 문제와 §3-2의 destructive 호버 문제는 이번 Task의 조사 결과 "코드 수정이 아니라 디자인 토큰 결정이 필요한 사안"임이 더 명확해졌을 뿐, 새로운 카테고리의 결함은 아니다.

---

## 8. Phase3 최종 상태

**안정화 완료.** 감사에서 발견된 4건 중 실제로 코드로 해결 가능했던 3건(ProfileMenu 오버플로우, className 중복, secondary hover)은 모두 해결했다. 나머지 2건(color-danger/success 토큰, destructive hover)은 코드 수정이 아니라 `DESIGN_SYSTEM.md`의 공식 값 변경이 필요한 사안임을 실측으로 확정하고, 지시에 따라 사용자 승인 없이 변경하지 않은 채 명확한 근거와 함께 보고했다.

## 9. Phase4 착수 가능 여부

**가능.** UI Foundation의 코드 레벨 결함은 정리됐다. Phase4 착수 전 사용자 결정이 필요한 것은 단 하나의 주제(색상 토큰)로 좁혀졌다: (1) `color-danger`/`color-success`를 AA 기준에 맞게 조정할지, (2) 조정한다면 `color-danger-dark`처럼 호버용 파생 톤도 함께 정의할지. 이 결정은 Phase4의 실제 기능 구현(에러 상태가 실제로 보이는 폼, 당첨 결과 배지 등)이 시작되기 전에 내리는 것을 권장하지만, Phase4 착수 자체를 막지는 않는다.
