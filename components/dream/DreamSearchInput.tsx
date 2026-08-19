"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import Input from "@/components/ui/Input";
import { trackProductEvent } from "@/lib/analytics/trackProductEvent";
import type { DreamSearchResult } from "@/lib/api/dreamSearch";

// Phase10-9 §30/§31/§32: Parent 45개 규모에서 사용자가 "꿈에서 무엇이 나왔나요?" 정도로만
// 입력해도 관련 Parent/Situation을 바로 찾을 수 있게 하는 최소 검색 UI다. 복잡한 semantic
// search나 별도 검색 결과 페이지를 만들지 않는다 — 입력 즉시 드롭다운으로 몇 개만 보여주고
// 클릭하면 바로 해당 페이지로 이동하는 것으로 충분하다(§31 "최대 몇 개의 관련 결과").
// debounce(300ms): 매 keystroke마다 요청을 보내지 않기 위한 가장 단순한 방식 — 별도
// 라이브러리 없이 setTimeout으로 충분하다.
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 1;

interface DreamSearchInputProps {
  // claude-code-luck-platform-launch-prompt.md §20 dream_search_submitted.location — 이 검색
  // UI가 지금은 app/dream/page.tsx 한 곳에서만 쓰이지만, 홈 Hero가 나중에 같은 컴포넌트를
  // 재사용하게 되면 호출부가 값만 바꿔주면 되도록 prop으로 뺐다.
  location?: "home" | "dream";
}

export default function DreamSearchInput({ location = "dream" }: DreamSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DreamSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/dream/search?q=${encodeURIComponent(trimmed)}`);
        if (!response.ok) {
          return;
        }
        const body = (await response.json()) as { data: DreamSearchResult[] };
        setResults(body.data);
        setIsOpen(true);
        trackProductEvent("dream_search_submitted", {
          query_length: trimmed.length,
          result_count: body.data.length,
          location,
        });
      } catch {
        // 검색 실패는 조용히 무시한다 — 검색은 보조 기능이라 에러 UI로 페이지 전체를
        // 방해하지 않는다(§32 "로그인 강요 popup 금지"와 같은 원칙: 보조 기능은 조용히 실패).
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, location]);

  // 바깥 클릭 시 드롭다운을 닫는다 — 모바일에서 결과를 고른 뒤에도 드롭다운이 화면을
  // 계속 가리지 않게 한다(§31 "모바일에서 사용하기 쉬워야 한다").
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        type="search"
        placeholder="꿈에서 무엇이 나왔나요? (예: 뱀 물림)"
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          if (value.trim().length < MIN_QUERY_LENGTH) {
            setResults([]);
            setIsOpen(false);
          }
        }}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        aria-label="꿈 검색"
      />

      {isOpen && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-card border border-border bg-bg-base shadow-card">
          {results.length === 0 ? (
            <li className="px-4 py-3 text-caption text-text-secondary">검색 결과가 없어요.</li>
          ) : (
            results.map((result) => (
              <li key={`${result.type}-${result.href}`}>
                <Link
                  href={result.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-bg-subtle"
                >
                  <span className="min-w-0 truncate text-body text-text-primary">{result.title}</span>
                  <span className="shrink-0 text-caption text-text-secondary">
                    {result.type === "parent" ? "꿈 종류" : "세부 상황"}
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
