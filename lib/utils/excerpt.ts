// claude-code-luck-platform-fortune-domain-followup-prompt.md §16/§17: 꿈해몽 본문
// (dreams.interpretation/dream_situations.body)은 "## 소제목" 경량 마크다운을 포함할 수
// 있고(supabase/migrations/0020-0021), 카드 미리보기·meta description 어디에도 그 마크업
// 기호가 그대로 노출되면 안 된다. 이 파일은 그 두 용도(카드 excerpt, description)가 공유하는
// "markdown 제거 → 문장 단위로 자르기" 로직을 한 곳에 모은다 — 기존에는
// app/dream/[keyword]/page.tsx가 heading 스킵만 자체 구현했고, DreamCard.tsx와
// app/dream/[keyword]/[situation]/page.tsx는 markdown/글자수 처리를 아예 하지 않았다.

// "## 소제목" 줄은 통째로 제거한다(components/dream/DreamHubContent.tsx의 파서가 "## "로
// 시작하는 줄을 섹션 제목으로 취급하는 것과 동일한 규칙) — 프리뷰/description은 서사문 요약이지
// 소제목까지 이어 붙일 필요가 없다.
function removeHeadingLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
}

// bold(**)/italic(*)/inline code(`)/link([text](url))만 처리한다 — 이 콘텐츠가 실제로 쓰는
// markdown 어휘가 이 정도로 한정되어 있어(supabase/migrations/0019-0021 실측), 범용 markdown
// 파서를 새 의존성으로 추가하지 않는다.
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

// heading 제거 → inline markdown 제거 → 줄바꿈을 공백으로 합치고 중복 공백을 정리한다.
// 결과는 순수 플레인 텍스트 한 문단이라, 카드에도 <meta description>에도 그대로 안전하게 쓸 수 있다.
export function toPlainText(raw: string): string {
  const withoutHeadings = removeHeadingLines(raw);
  const withoutInlineMarkdown = stripInlineMarkdown(withoutHeadings);

  return withoutInlineMarkdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const SENTENCE_END_PATTERN = /[.!?](?=\s|$)/g;

// maxLength 안에서 마지막으로 완결된 문장까지만 반환한다("돼지를 보기만 했는지, 돼지가 직접
// 다"처럼 문장 중간에서 끊기는 것을 방지). 첫 문장 자체가 maxLength보다 길면 예외적으로 마지막
// 공백에서 잘라 최소한 단어 중간은 끊지 않는다 — 텍스트 자체가 사실상 문장 경계가 없는
// 드문 경우에 대한 안전장치일 뿐, 일반적인 본문에서는 발생하지 않는다.
export function excerptBySentence(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  let lastSentenceEnd = -1;
  SENTENCE_END_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_END_PATTERN.exec(text)) !== null) {
    const endIndex = match.index + 1; // 마침표/물음표/느낌표까지 포함
    if (endIndex > maxLength) {
      break;
    }
    lastSentenceEnd = endIndex;
  }

  if (lastSentenceEnd > 0) {
    return text.slice(0, lastSentenceEnd).trim();
  }

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trim();
}

// DreamCard.tsx/generateMetadata 양쪽이 부르는 단일 진입점 — "markdown 제거 → 문장 단위로
// 자르기"를 항상 같은 순서로 적용해, 두 호출부가 서로 다른 규칙으로 어긋나지 않게 한다.
export function buildExcerpt(raw: string, maxLength: number): string {
  return excerptBySentence(toPlainText(raw), maxLength);
}
