import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import { getEnv } from "@/lib/utils/env";

// docs/PHASE2_AUTH_DECISION.md Decision 2: REST API + Admin API 방식.
// 카카오는 Supabase Auth의 기본 OAuth 프로바이더가 아니므로, 카카오 REST API로 직접
// 인증한 뒤 Supabase Admin API로 세션을 발급한다(OIDC 커스텀 프로바이더 방식은 채택하지 않음).

const KAKAO_AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize";
const KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const KAKAO_USER_ME_URL = "https://kapi.kakao.com/v2/user/me";

// login/callback 두 Route Handler가 공유하는 1회용 CSRF state 쿠키 이름.
export const KAKAO_OAUTH_STATE_COOKIE = "kakao_oauth_state";

export interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

export interface KakaoUserProfile {
  id: number;
  nickname: string | null;
}

interface KakaoUserMeResponse {
  id: number;
  kakao_account?: { profile?: { nickname?: string | null } };
  properties?: { nickname?: string | null };
}

export function getKakaoRedirectUri(): string {
  return `${getEnv("NEXT_PUBLIC_SITE_URL")}/api/auth/kakao/callback`;
}

export function buildKakaoAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getEnv("KAKAO_REST_API_KEY"),
    redirect_uri: getKakaoRedirectUri(),
    response_type: "code",
    state,
  });

  return `${KAKAO_AUTHORIZE_URL}?${params.toString()}`;
}

// 절대 access_token/refresh_token/client_secret을 로그로 남기지 않는다 — 실패 시에도
// HTTP status만 메시지에 담는다(docs/PHASE2_KAKAO_POC_REPORT.md §5 보안 요구사항).
export async function exchangeKakaoCodeForToken(code: string): Promise<KakaoTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: getEnv("KAKAO_REST_API_KEY"),
    client_secret: getEnv("KAKAO_CLIENT_SECRET"),
    redirect_uri: getKakaoRedirectUri(),
    code,
  });

  const response = await fetch(KAKAO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`카카오 토큰 교환 실패 (status: ${response.status})`);
  }

  const body = (await response.json()) as KakaoTokenResponse;

  if (typeof body.access_token !== "string") {
    throw new Error("카카오 토큰 응답 형식이 올바르지 않습니다.");
  }

  return body;
}

export async function fetchKakaoUserProfile(accessToken: string): Promise<KakaoUserProfile> {
  const response = await fetch(KAKAO_USER_ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`카카오 사용자 정보 조회 실패 (status: ${response.status})`);
  }

  const body = (await response.json()) as KakaoUserMeResponse;

  if (typeof body.id !== "number") {
    throw new Error("카카오 사용자 정보 응답 형식이 올바르지 않습니다.");
  }

  return {
    id: body.id,
    nickname: body.kakao_account?.profile?.nickname ?? body.properties?.nickname ?? null,
  };
}

// Supabase auth.users는 이메일 기반 신원 체계다. 카카오 기본 동의항목(닉네임·프로필)은
// 이메일을 제공하지 않으므로(이메일은 비즈니스 심사가 필요한 별도 동의항목), 카카오 고유
// id로부터 결정론적인 합성 이메일을 만들어 auth.users의 식별자로 쓴다 — 실제 수신 가능한
// 주소가 아니며 발송 목적이 아니다. 같은 카카오 계정은 항상 같은 이메일로 매핑되므로
// 재로그인 시 admin.generateLink가 새 사용자가 아니라 기존 사용자를 반환한다.
export function deriveKakaoSyntheticEmail(kakaoUserId: number): string {
  return `kakao-${kakaoUserId}@users.noreply.luckplatform.local`;
}

// service_role(Admin API)은 이 함수 안에서만 쓴다 — 카카오처럼 Supabase Auth가 기본
// 지원하지 않는 프로바이더의 사용자를 만들고 세션을 발급하는 것은 Admin API 없이는
// 불가능한 작업이다(docs/PHASE2_AUTH_DECISION.md Decision 2가 이미 승인한 "REST API +
// Admin API" 접근 자체의 요구사항). 실제로 세션 쿠키를 굽는 마지막 단계(verifyOtp)는
// anon key 기반 lib/supabase/server.ts로 수행해, service_role 사용 범위를 "사용자
// 생성/연결"로만 최소화한다.
export async function establishKakaoSupabaseSession(kakaoUser: KakaoUserProfile): Promise<string> {
  const email = deriveKakaoSyntheticEmail(kakaoUser.id);
  const admin = createServiceClient();

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      data: {
        nickname: kakaoUser.nickname,
        kakao_id: kakaoUser.id,
      },
    },
  });

  if (linkError || !linkData.properties?.hashed_token) {
    throw new Error("카카오 연동 세션 발급(generateLink)에 실패했습니다.");
  }

  // provider를 app_metadata에 명시한다 — lib/auth/session.ts의 resolveProfileProvider()가
  // 이 값을 읽어 profiles.provider를 결정한다(docs/PHASE2_PROFILE_SERVICE_REPORT.md §4).
  // 재로그인 시에도 매번 같은 값으로 갱신하므로 멱등적이다.
  //
  // app_metadata.provider/providers는 GoTrue가 auth.identities로부터 자동 재계산하는
  // 예약 필드라 admin.updateUserById로 덮어써도 유지되지 않는다(magiclink 검증 경로는
  // email identity를 만들기 때문에 provider가 "email"로 되돌아감 — 실제 Supabase 프로젝트
  // 대상 실측으로 발견, docs/PHASE2_KAKAO_E2E_REPORT.md 참조). 예약 필드와 충돌하지 않는
  // 커스텀 키(auth_provider)에 저장한다 — 여전히 app_metadata이므로 service_role만 쓸 수
  // 있고 클라이언트 세션(user_metadata)으로는 위조할 수 없다.
  const { error: metadataError } = await admin.auth.admin.updateUserById(linkData.user.id, {
    app_metadata: { auth_provider: "kakao", kakao_id: kakaoUser.id },
  });

  if (metadataError) {
    throw new Error("카카오 provider 메타데이터 갱신에 실패했습니다.");
  }

  // token_hash로 검증할 때는 email을 함께 보내면 안 된다 — GoTrue가 "Only the token_hash
  // and type should be provided"(400 validation_failed)로 거부한다. 또한 verifyOtp의
  // type은 "magiclink"가 아니라 "email"이어야 한다 — auth-js 자체 문서가 "signup/magiclink
  // 타입은 verifyOtp에서 deprecated"라고 명시하며, 실측 결과 최초 로그인(신규 사용자) 시
  // "magiclink"를 쓰면 otp_expired(403)로 실패하고 재로그인(기존 사용자)에서만 우연히
  // 통과했다 — "email"로 통일하면 신규/기존 사용자 모두 성공한다(실제 Supabase 프로젝트
  // 대상 실측으로 발견, docs/PHASE2_KAKAO_E2E_REPORT.md 참조).
  const supabase = await createServerClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties.hashed_token,
  });

  if (verifyError) {
    throw new Error("카카오 세션 검증(verifyOtp)에 실패했습니다.");
  }

  return linkData.user.id;
}
