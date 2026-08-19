export function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`환경변수 ${name}가 설정되지 않았습니다.`);
  }

  return value;
}

// Phase10-7 배포 리허설에서 NEXT_PUBLIC_SITE_URL이 최초 설정 이후 9일간
// http://localhost:3000으로 방치돼 있었던 사고(docs/VERCEL_DEPLOYMENT_REHEARSAL_REPORT.md §6)의
// 재발 방지 장치. Vercel은 Preview/Production을 가리지 않고 배포된 모든 환경에서
// process.env.VERCEL="1"을 자동으로 심어준다 — 로컬 `next dev`/`next build`에는 이 값이 없으므로
// 로컬 개발/빌드는 그대로 localhost를 허용한다(과도한 validator로 로컬 워크플로우를 깨뜨리지
// 않는다). Preview와 Production을 구분하지 않는 이유: 둘 다 실제 https 도메인(*.vercel.app 또는
// 최종 커스텀 도메인)을 쓰지 localhost가 될 수 없으므로, "localhost가 아니어야 한다"는 조건
// 하나로 두 환경 모두를 올바르게 검증할 수 있다(최종 도메인 하나로 값을 고정할 필요가 없다).
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

function isVercelDeployment(): boolean {
  return process.env.VERCEL === "1";
}

// sitemap.xml/robots.txt/Kakao redirect_uri가 모두 이 값 하나에서 파생된다
// (app/sitemap.ts, app/robots.ts, lib/auth/kakao.ts) — 그래서 getEnv("NEXT_PUBLIC_SITE_URL")를
// 여러 곳에서 직접 부르는 대신 이 함수 하나로 모으고, Vercel에 배포된 상태에서만 fail-fast로
// 검증한다. 값이 잘못됐을 때 사이트가 "조용히" 잘못된 URL로 계속 서비스되는 대신, 배포/요청
// 시점에 명확한 에러로 즉시 드러나게 하는 것이 목표다(9일간 아무도 몰랐던 사고를 반복하지
// 않기 위함).
export function getSiteUrl(): string {
  const raw = getEnv("NEXT_PUBLIC_SITE_URL");

  if (!isVercelDeployment()) {
    return raw;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`NEXT_PUBLIC_SITE_URL이 유효한 URL이 아닙니다: "${raw}"`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(
      `Vercel 배포에서는 NEXT_PUBLIC_SITE_URL이 https여야 합니다 (현재 값: "${raw}")`
    );
  }

  if (LOCAL_HOSTNAMES.has(parsed.hostname)) {
    throw new Error(
      `Vercel 배포에서 NEXT_PUBLIC_SITE_URL이 localhost를 가리키고 있습니다: "${raw}" — ` +
        `sitemap/robots/Kakao 로그인이 전부 깨집니다. Vercel 프로젝트 환경변수를 확인하세요.`
    );
  }

  // app/sitemap.ts/app/robots.ts/lib/auth/kakao.ts는 이 값을 `${getSiteUrl()}/path` 형태로
  // 단순 문자열 결합한다(URL 인스턴스가 아니다) — trailing slash가 붙어 있으면
  // "https://example.com//dream" 같은 이중 슬래시가 조용히 만들어진다. `new URL()` 기반
  // 검증(위 protocol/hostname 체크)은 trailing slash를 정규화해 통과시켜버리므로 별도로
  // raw 문자열을 검사해야 한다(Phase10-11A §8/§13, 도메인 전환 시점의 사소하지만 실제
  // sitemap/canonical을 깨뜨릴 수 있는 실수를 미리 막는다).
  if (raw.endsWith("/")) {
    throw new Error(
      `Vercel 배포에서 NEXT_PUBLIC_SITE_URL 끝에 "/"가 있으면 안 됩니다: "${raw}" — ` +
        `sitemap/canonical URL에 이중 슬래시가 생깁니다. 값을 "${raw.slice(0, -1)}"로 수정하세요.`
    );
  }

  return raw;
}
