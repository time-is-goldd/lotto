#!/usr/bin/env node
// Phase10-11A: 비파괴적(read-only GET) Production smoke check. 인증이 필요한 라우트
// (/my/*, /admin/*)는 포함하지 않는다 — 그건 실제 로그인 세션이 있어야 의미가 있는
// 별도의 브라우저 E2E 영역이다(docs/DOMAIN_PREPURCHASE_READINESS_REPORT.md §Final Kakao
// E2E Checklist 참조). BASE_URL 하나만 바꾸면 지금(임시 Vercel 도메인)도, 최종 도메인
// 연결 후(Phase10-11B)도 동일하게 재사용할 수 있다.
//
// 사용법:
//   node scripts/smoke-check.mjs https://lotto-blue-sigma.vercel.app
//   node scripts/smoke-check.mjs https://luckplatform.co.kr
// (인자를 생략하면 http://localhost:3000)

const BASE_URL = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

// 대표 Parent/Situation은 실제 존재를 보장하기 위해 45개 Flagship 중 이미 여러 Wave에서
// 반복 검증된 "돼지꿈"을 그대로 재사용한다(새 하드코딩 대신 기존에 안정적으로 존재가
// 확인된 슬러그를 재사용) — Dream 콘텐츠 자체를 이번 Task에서 만들지 않는다는 원칙과도
// 맞다.
const ROUTES = [
  { path: "/", expect: 200 },
  { path: "/login", expect: 200 },
  { path: "/generate", expect: 200 },
  { path: "/fortune", expect: 200 },
  { path: "/dream", expect: 200 },
  { path: `/dream/${encodeURIComponent("돼지꿈")}`, expect: 200, label: "representative parent" },
  {
    path: `/dream/${encodeURIComponent("돼지꿈")}/${encodeURIComponent("돼지를-보는-꿈")}`,
    expect: 200,
    label: "representative situation",
  },
  { path: "/faq", expect: 200 },
  { path: "/about", expect: 200 },
  { path: "/privacy", expect: 200 },
  { path: "/terms", expect: 200 },
  { path: "/robots.txt", expect: 200 },
  { path: "/sitemap.xml", expect: 200 },
];

function checkHostConsistency(url, body, contentType) {
  const issues = [];
  if (contentType?.includes("xml") || contentType?.includes("text/plain") || contentType?.includes("html")) {
    if (body.includes("localhost")) issues.push("body contains 'localhost'");
    if (body.includes("vercel.app") && !BASE_URL.includes("vercel.app")) {
      issues.push("body contains 'vercel.app' but BASE_URL is not a vercel.app host");
    }
  }
  return issues;
}

let failCount = 0;
const results = [];
let sitemapInfo = null;

for (const route of ROUTES) {
  const url = `${BASE_URL}${route.path}`;
  try {
    const res = await fetch(url, { redirect: "manual" });
    const contentType = res.headers.get("content-type") ?? "";
    const body = await res.text();
    const hostIssues = checkHostConsistency(url, body, contentType);
    const statusOk = res.status === route.expect;
    const ok = statusOk && hostIssues.length === 0;
    if (!ok) failCount++;
    results.push({
      path: route.path,
      label: route.label ?? "",
      status: res.status,
      expected: route.expect,
      ok,
      hostIssues,
    });

    // Phase10-11A: sitemap.xml은 revalidate=3600(ISR)이라 X-Vercel-Cache: HIT + Age가 크면
    // 배포/DB 변경이 실제로는 반영됐는데도 캐시가 오래된 스냅샷을 계속 서빙할 수 있다
    // (docs/DOMAIN_PREPURCHASE_READINESS_REPORT.md에서 lotto-blue-sigma.vercel.app 실측으로
    // 발견 — Age 15시간, URL 개수가 DB 현재 상태(61 Parent/396 Situation)보다 훨씬 적었음).
    // URL 200 여부만으로는 이 staleness를 못 잡아서 개수/캐시 상태를 별도로 출력한다.
    if (route.path === "/sitemap.xml") {
      const urlCount = (body.match(/<loc>/g) ?? []).length;
      sitemapInfo = {
        urlCount,
        cacheStatus: res.headers.get("x-vercel-cache"),
        age: res.headers.get("age"),
        lastModified: res.headers.get("last-modified"),
      };
    }
  } catch (err) {
    failCount++;
    results.push({ path: route.path, label: route.label ?? "", error: err.message, ok: false });
  }
}

console.log(`Smoke check against ${BASE_URL}\n`);
for (const r of results) {
  const mark = r.ok ? "PASS" : "FAIL";
  const extra = r.error
    ? ` error=${r.error}`
    : ` status=${r.status}(expected ${r.expected})${r.hostIssues?.length ? " hostIssues=" + r.hostIssues.join(",") : ""}`;
  console.log(`[${mark}] ${r.path}${r.label ? ` (${r.label})` : ""}${extra}`);
}

if (sitemapInfo) {
  console.log(
    `\nsitemap.xml: ${sitemapInfo.urlCount} URLs, cache=${sitemapInfo.cacheStatus ?? "n/a"}, age=${sitemapInfo.age ?? "n/a"}s, last-modified=${sitemapInfo.lastModified ?? "n/a"}`
  );
  console.log(
    "  -> compare against current DB dreams/dream_situations count manually; if this looks stale (HIT + large age, low URL count), the ISR cache has not refreshed since the last content change."
  );
}

console.log(`\n${results.length - failCount}/${results.length} passed`);
process.exit(failCount > 0 ? 1 : 0);
