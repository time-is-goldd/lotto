# DESIGN SYSTEM — 디자인 시스템 정의

> v3.0 개정(claude-code-luck-platform-home-brand-daily-numbers-prompt.md — Home·브랜드 컬러·
> "오늘의 세 조합" 재구성). 브랜드 컬러를 블루에서 딥레드/골드로 교체한 배경과 새 토큰의
> "왜"는 [[DESIGN_DIRECTION]]에 있다 — 이 문서는 계속 "무엇을 어떤 값으로"만 다룬다.
> v2.0 개정(다이어리/멤버십/파트너 아이콘, 멤버십 등급 표시 추가). [[UI_UX_GUIDELINE]]의 원칙을 실제 재사용 가능한 디자인 토큰과 컴포넌트로 구체화한다.

---

## 1. 컬러 시스템

### 1.1 브랜드 컬러
| 토큰 | 값 | 용도 |
|---|---|---|
| `color-primary` | #B42318 (딥레드) | Primary CTA, 현재 탭, 핵심 링크, focus ring |
| `color-primary-dark` | #8F1D14 | 호버/프레스 상태 |
| `color-soft-red` | #FFF0ED | 매우 제한적인 강조 표면(신규, v3.0) |
| `color-accent-gold` | #F4B740 (실제 꿈 숫자 전용) | "오늘의 세 조합"에서 꿈에서 유래한 숫자만 강조 — 당첨 하이라이트 등 다른 용도로 확장하지 않는다([[DESIGN_DIRECTION]] §3 시그니처 규칙) |
| `color-soft-gold` | #FFF6D8 | 로그인 혜택 band, 숫자 보조 표면(신규, v3.0) |
| `color-kakao` | #FEE500 | 카카오 로그인/공유 버튼 전용(브랜드 가이드 준수, 현재 실제 로그인 CTA는 Primary red를 쓰고 이 토큰은 아직 소비하는 컴포넌트가 없다 — 범위 밖) |

v2.0에서 이 표는 `#1B4DFF`(블루)를 브랜드 컬러로 정의했었다. v3.0에서 딥레드/골드로 교체한
것은 새 브랜드가 아니라 **같은 토큰 이름의 값 교체**다 — 매핑 근거는 [[DESIGN_DIRECTION]] §4.

### 1.2 기본 팔레트
| 토큰 | 값 | 용도 |
|---|---|---|
| `color-bg-base` | #FFFDFC | 기본 배경(화이트에 가까운 아이보리, v3.0 조정) |
| `color-bg-surface` | #FFFFFF | 폼·꿈 숫자 결과 행 등 배경 위에서 한 단 떠야 하는 표면(신규, v3.0) |
| `color-bg-subtle` | #F7F8FA | 카드/섹션 구분 배경(변경 없음 — 이미 중립적인 옅은 색이라 v3.0 팔레트와 충돌하지 않는다) |
| `color-text-primary` | #18181B | 본문 텍스트(v3.0, 기존 #1A1A1A와 사실상 동일한 톤 — 대비율 영향 없음) |
| `color-text-secondary` | #68615C | 보조 텍스트(v3.0, 기존 #5B5F66의 차가운 회색에서 따뜻한 회색으로) |
| `color-border` | #E8E2DC | 구분선, 입력 테두리(v3.0, 따뜻한 톤으로 조정) |
| `color-success` | #1AA260 | 당첨/성공 상태(변경 없음 — 실제 의미가 있는 semantic color) |
| `color-danger` | #E0353B | 오류, 미당첨 강조(변경 없음, 단독 사용 금지 원칙 유지) |

모든 색상 조합은 [[UI_UX_GUIDELINE]] §4의 WCAG AA 대비율(4.5:1)을 충족하도록 검증한다.
`color-text-secondary`(#68615C) on `color-bg-base`(#FFFDFC)는 대비율 약 5.4:1, `color-primary`
흰 텍스트(#FFFFFF on #B42318)는 약 7.9:1로 AA/AAA를 모두 충족한다.

## 2. 타이포그래피 스케일

| 토큰 | 크기 | 용도 |
|---|---|---|
| `font-display` | 32px / Bold | 랜딩 히어로 카피 |
| `font-h1` | 28px / Bold | 페이지 제목 |
| `font-h2` | 22px / Bold | 섹션 제목 |
| `font-body-lg` | 18px / Regular | 핵심 본문(운세 결과 등) |
| `font-body` | 16px / Regular | 기본 본문 |
| `font-caption` | 14px / Regular | 보조 정보(최소 사용, 시니어 화면에서는 지양) |
| `font-button` | 20px / Bold | CTA 버튼 텍스트 |
| `font-display-desktop` | 52px / Bold | Home Hero H1 전용 데스크톱 크기(신규, v3.0). 모바일은 기존 `font-display`(32px)를 그대로 쓰고 `md:` 브레이크포인트에서만 이 토큰으로 커진다 — claude-code-luck-platform-home-brand-daily-numbers-prompt.md §3.3 "데스크톱 48~56px" 요구 반영. |

행간 1.6, 자간 기본값(한글 자간 조정 없음 — 가독성 우선). Home Hero H1만 예외로 `leading-tight`
(모바일)/`leading-[1.18]`(데스크톱)을 지정한다 — 위 프롬프트 §3.3 "데스크톱 1.15~1.22" 범위.

## 3. 간격 시스템 (Spacing Scale)

8px 기준 배수 체계: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`
- 컴포넌트 내부 패딩: 16px 기본
- 섹션 간 간격: 32px 이상 (정보 밀도 완화, [[UI_UX_GUIDELINE]] §5)

## 4. 컴포넌트 라이브러리

### 4.1 버튼 (Button)
- Primary: `color-primary` 배경, 흰 텍스트, 높이 56px, radius 12px
- Secondary: 흰 배경 + `color-primary` 테두리
- Kakao: `color-kakao` 배경, 검정 텍스트(카카오 브랜드 가이드 준수)
- Disabled: `color-border` 배경, `color-text-secondary` 텍스트

### 4.2 번호 볼 (Lotto Ball) — 시그니처 컴포넌트
- 원형, 지름 44px(모바일)/56px(데스크톱)
- 번호 구간별 색상 구분(공식 로또 색상 관례 참고): 1-10 노랑, 11-20 파랑, 21-30 빨강, 31-40 회색, 41-45 초록
- 보너스 번호는 테두리 강조(점선 또는 별도 라벨)로 구분

### 4.3 카드 (Card)
- 배경 `color-bg-subtle`, radius 16px, 그림자 최소화(과도한 그림자는 시니어 화면에서 지저분해 보임 — `box-shadow: 0 1px 4px rgba(0,0,0,0.06)` 수준)
- 카드 내부 제목(18px Bold) + 본문(16px) + CTA 버튼 구조 통일

### 4.4 토스트/알림 배지
- 토스트: 하단 고정, 2~3초 자동 소멸, 아이콘+텍스트
- 알림 뱃지: 빨간 원 + 숫자, 헤더 벨 아이콘 우상단

### 4.5 입력 필드 (Input)
- 높이 52px, radius 8px, 포커스 시 `color-primary` 테두리 강조
- 날짜 선택은 네이티브 드럼롤/셀렉트 컴포넌트 우선 ([[UI_UX_GUIDELINE]] §7)

### 4.6 탭바 (Bottom Tab Bar)
- 높이 64px, 5개 항목 균등 분할, 활성 탭은 `color-primary` 아이콘+텍스트, 비활성은 `color-text-secondary`

### 4.7 배지/뱃지 (Achievement Badge)
- 명예의전당/배틀 우승 등급별 색상: 금(#FFD700)/은(#C0C0C0)/동(#CD7F32)
- 원형 메달 아이콘 + 등수 텍스트 조합

### 4.8 멤버십 등급 표시 (신규, Phase 7 대비)
- 무료(Free): 별도 배지 없음
- 프리미엄(Premium): `color-accent-gold` 기반 다이아몬드 아이콘 + "Premium" 라벨, 프로필/닉네임 옆 소형 배지로 노출
- 톤: 과시적이지 않게, 작고 은은한 표시로 제한 (시니어 사용자 대상 서비스 톤과 충돌하지 않도록 §10 톤앤매너 준수)

### 4.9 오늘의 세 조합 결과 행 (신규, v3.0)

claude-code-luck-platform-home-brand-daily-numbers-prompt.md §9.4의 "카드 3개 대신 구분선이 있는
결과 행" 요구를 구현한 컴포넌트(`components/generate/DailyComboRow.tsx`).

- 카드가 아니라 `border-t border-border`(첫 행 제외)로 구분되는 행 목록.
- 각 행 제목: "첫 번째 조합"/"두 번째 조합"/"세 번째 조합".
- 번호 구슬: 모바일 40px(`h-10 w-10`), 데스크톱 44~48px(`md:h-12 md:w-12`).
- 꿈 숫자: `bg-accent-gold` 채우기 + `aria-label="꿈 숫자 N"` + 하단 범례. 일반 숫자: `bg-bg-surface`
  + `border-2 border-border`. 색만으로 구분하지 않는다(§9.4 "색만으로 둘을 구분하지 않는다").
- Home의 "핵심 기능 3개" 섹션과 같은 "열린 레이아웃 + 구분선" 언어를 공유해 Home과 /generate가
  하나의 디자인 시스템처럼 보이게 한다.

## 5. 아이콘 세트 원칙

- 스타일: 라인 아이콘(2px stroke) 통일, 채우기형과 혼용 금지
- 크기: 24px(본문 내), 32px(탭바/카드), 항상 텍스트 라벨 동반 ([[UI_UX_GUIDELINE]] §6)
- 핵심 아이콘 매핑: 번호생성(주사위/볼), 꿈해몽(달/구름), 운세(별), 통계(막대그래프), 배틀(트로피), 명예의전당(왕관), 당첨사례(선물), 커뮤니티(말풍선), 가이드(책), FAQ(물음표)
- **신규 아이콘 (Luck Platform 확장, v2.0)**: 행운 다이어리(노트/펼쳐진 다이어리 — 하단 탭 4번째 자리 고정, [[UI_UX_GUIDELINE]] §13.3), 로또명당(지도핀), 친구초대(사람+화살표), 멤버십(다이아몬드/왕관 변형), 파트너/입점(악수), 계산기(계산기 아이콘)

## 6. 모션/애니메이션 원칙

- 번호 생성 결과 노출: 볼이 하나씩 굴러나오는 순차 애니메이션, 총 소요 0.8~1.2초 ([[USER_PSYCHOLOGY]] §5 기대감 형성 근거)
- 트랜지션: 200~300ms ease-out 통일, 과도한 바운스/스프링 효과 지양(산만함 방지)
- `prefers-reduced-motion` 설정 시 모든 장식적 애니메이션 비활성화 ([[UI_UX_GUIDELINE]] §11)

## 7. 반응형 그리드

- 모바일 우선: 360~430px 기준 1컬럼
- 태블릿: 2컬럼 그리드 전환 (768px~)
- 데스크톱: 최대 콘텐츠 폭 1200px 중앙 정렬, 좌우 여백 확보 (과도하게 넓은 텍스트 라인 방지)

## 8. 다크모드 정책

초기 버전 미지원 ([[UI_UX_GUIDELINE]] §4 근거). 추후 젊은 사용자층 확대 시 별도 토글 기능으로 Phase 3 이후 검토 ([[ROADMAP]]).

## 9. 디자인 토큰 관리 원칙

모든 색상/폰트/간격 값은 코드베이스 내 중앙 토큰 파일(예: `design-tokens.json`)로 관리하여 하드코딩을 금지한다 — 브랜드 컬러 변경 시 전체 일괄 반영 가능하도록 [[IMPLEMENTATION_PLAN]] 단계에서 구조를 확정한다.
