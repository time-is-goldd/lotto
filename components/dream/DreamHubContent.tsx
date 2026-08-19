interface DreamHubContentProps {
  interpretation: string;
}

interface Section {
  heading: string | null;
  paragraphs: string[];
}

// Phase10-9 §12: 새 column/table을 추가하지 않고 기존 dreams.interpretation(TEXT) 안에
// "## 소제목" 줄만 규칙으로 추가해 Parent hub를 여러 섹션으로 표현한다. 기존 25개 Parent는
// "##"가 전혀 없는 한 문단짜리 텍스트라 아래 파서를 거쳐도 지금과 똑같이 문단 하나로
// 렌더링된다(하위 호환) — 이 컴포넌트가 생기기 전의 app/dream/[keyword]/page.tsx 동작을
// 그대로 보존한다.
function parseSections(interpretation: string): Section[] {
  const lines = interpretation.split("\n");
  const sections: Section[] = [{ heading: null, paragraphs: [] }];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("## ")) {
      sections.push({ heading: line.slice(3).trim(), paragraphs: [] });
      continue;
    }
    if (line.length === 0) {
      continue;
    }
    sections[sections.length - 1].paragraphs.push(line);
  }

  return sections.filter((section) => section.heading !== null || section.paragraphs.length > 0);
}

// 실제 <h2>로 렌더링한다(지시문 §17 "단순 CSS heading div로 전부 처리하지 않는다") — 헤딩이
// 없는 섹션(레거시 Parent 전체, 또는 "##" 이전에 오는 서문)은 heading 없이 문단만 보여준다.
export default function DreamHubContent({ interpretation }: DreamHubContentProps) {
  const sections = parseSections(interpretation);

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section, index) => (
        <div key={index} className="flex flex-col gap-2">
          {section.heading && (
            <h2 className="text-h2 font-bold text-text-primary">{section.heading}</h2>
          )}
          {section.paragraphs.map((paragraph, paragraphIndex) => (
            <p
              key={paragraphIndex}
              className="whitespace-pre-wrap break-words text-body text-text-primary"
            >
              {paragraph}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
