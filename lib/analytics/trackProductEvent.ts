import type { ProductEventName, ProductEventPropertiesMap } from "./events";

// claude-code-luck-platform-launch-prompt.md §20: "provider에 종속되지 않는 trackProductEvent
// 래퍼"를 만들되 "설정되지 않았을 때 앱이 깨지거나 개인정보를 무단 전송하면 안 된다." 이
// 파일은 서버(Route Handler/Server Component, Node)와 클라이언트(Client Component, 브라우저)
// 양쪽에서 그대로 import해 쓸 수 있게 "use client"를 붙이지 않았다 — typeof window로만
// 환경을 분기한다. 실제 분석 provider(GA4/Amplitude/자체 수집기 등)는 아직 연결되어 있지
// 않다(docs/analytics.md 참조) — NEXT_PUBLIC_ANALYTICS_ENDPOINT가 설정되지 않으면 개발 환경
// 콘솔 로그만 남기고 아무 데이터도 외부로 나가지 않는다.
//
// lib/utils/env.ts의 getSiteUrl()과 동일한 이유로 process.env를 모듈 top-level이 아니라
// 함수 안에서 읽는다 — 테스트가 매번 process.env를 바꿔가며 두 경로(설정됨/안 됨)를 모두
// 검증할 수 있고, Next.js가 NEXT_PUBLIC_* 값을 빌드 타임에 인라인하는 동작과도 충돌하지 않는다.
function getAnalyticsEndpoint(): string | undefined {
  return process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
}

function sendPayload(endpoint: string, payload: string): void {
  // sendBeacon은 페이지 이탈 도중에도 전송을 보장하는 브라우저 전용 API라 클라이언트에서만
  // 쓴다 — 서버(Route Handler)에는 navigator 자체가 없다.
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, payload);
    return;
  }

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // 분석 전송 실패가 실제 기능(번호 저장, 로그인 등)을 막으면 안 된다 — 조용히 무시한다.
  });
}

// event별 property 타입을 ProductEventPropertiesMap에서 그대로 끌어와, 이름과 속성이 항상
// 짝이 맞게 강제한다(예: "numbers_generated"를 쓰면서 "draw_id" property를 넣는 실수를
// 컴파일 타임에 막는다).
export function trackProductEvent<E extends ProductEventName>(
  event: E,
  properties: ProductEventPropertiesMap[E]
): void {
  const endpoint = getAnalyticsEndpoint();

  if (!endpoint) {
    if (process.env.NODE_ENV !== "production") {
      // 개발 중에만 실제로 어떤 이벤트가 발생했는지 눈으로 확인할 유일한 경로다.
      // NEXT_PUBLIC_ANALYTICS_ENDPOINT가 없는 프로덕션에서는 이 분기 자체에 들어오지만
      // NODE_ENV 체크로 로그를 남기지 않는다.
      console.info(`[analytics] ${event}`, properties);
    }
    return;
  }

  const payload = JSON.stringify({
    event,
    properties,
    timestamp: new Date().toISOString(),
  });

  sendPayload(endpoint, payload);
}
