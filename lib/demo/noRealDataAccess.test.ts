import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// claude-code-luck-platform-daily-fortune-number-demo-prompt.md §18/§27: "demo route에서
// Supabase write/network call이 발생하지 않는 테스트를 추가한다." 실제 네트워크 mocking으로
// 검증하려면 이 프로젝트에 없는 jsdom/통합 테스트 러너가 필요하다 — 대신 app/demo/**의 소스
// 코드 자체가 데이터 접근 모듈을 import하지 않는지 정적으로 검사한다. import 자체가 없으면
// 그 경로로 Supabase 호출이 발생할 방법이 없다(실행 시점 검증보다 강한 보장 — "안 부른다"가
// 아니라 "부를 수 없다").
const DEMO_APP_DIR = join(process.cwd(), "app", "demo");

const FORBIDDEN_IMPORT_PATTERNS = [
  "@/lib/supabase",
  "@/lib/auth/session",
  "@/lib/auth/profile",
  "@/lib/api/",
];

// 이 파일 자체를 포함해 소스에 "왜 getCurrentUser를 안 쓰는지" 설명하는 주석이 있을 수
// 있어(app/demo/layout.tsx 참조), 주석을 먼저 제거한 뒤에만 실제 호출 여부를 검사한다.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...listSourceFiles(fullPath));
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("app/demo/** does not import real data/auth adapters", () => {
  const files = listSourceFiles(DEMO_APP_DIR);

  it("finds at least the expected demo route files (sanity check for the scan itself)", () => {
    expect(files.length).toBeGreaterThanOrEqual(5); // layout + index + fortune/journal/results
  });

  it.each(files)("%s has no forbidden import", (filePath) => {
    const content = stripComments(readFileSync(filePath, "utf8"));
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      expect(content).not.toContain(pattern);
    }
  });

  it.each(files)("%s does not call getCurrentUser/createClient directly", (filePath) => {
    const content = stripComments(readFileSync(filePath, "utf8"));
    expect(content).not.toMatch(/getCurrentUser\s*\(/);
    expect(content).not.toMatch(/createClient\s*\(/);
  });
});
