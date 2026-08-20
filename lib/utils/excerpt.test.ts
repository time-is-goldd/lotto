import { describe, expect, it } from "vitest";

import { buildExcerpt, excerptBySentence, toPlainText } from "./excerpt";

describe("toPlainText", () => {
  it("removes ## heading lines entirely", () => {
    const raw = "## 돼지꿈은 보통 어떻게 해석할까?\n실제 본문 문장입니다.";
    expect(toPlainText(raw)).toBe("실제 본문 문장입니다.");
  });

  it("strips bold/italic/code/link markdown but keeps the text", () => {
    const raw = "**굵게** *기울임* `코드` [링크](https://example.com) 그대로";
    expect(toPlainText(raw)).toBe("굵게 기울임 코드 링크 그대로");
  });

  it("joins multiple lines into one paragraph with single spaces", () => {
    const raw = "첫 줄입니다.\n\n둘째 줄입니다.\n셋째 줄입니다.";
    expect(toPlainText(raw)).toBe("첫 줄입니다. 둘째 줄입니다. 셋째 줄입니다.");
  });

  it("returns a single-paragraph legacy dream unchanged (no heading, no markdown)", () => {
    const raw = "돼지꿈은 예로부터 대표적인 재물운 상승의 길몽으로 여겨진다.";
    expect(toPlainText(raw)).toBe(raw);
  });
});

describe("excerptBySentence", () => {
  it("returns the text unchanged when already within maxLength", () => {
    expect(excerptBySentence("짧은 문장입니다.", 100)).toBe("짧은 문장입니다.");
  });

  it("cuts at the last complete sentence within maxLength, never mid-sentence", () => {
    const text = "첫 문장입니다. 둘째 문장은 조금 더 깁니다. 셋째 문장.";
    // 첫 문장 끝(8자)만 20자 이내이고, 둘째 문장 끝(25자)은 넘어가므로 첫 문장까지만 남는다.
    const result = excerptBySentence(text, 20);
    expect(result).toBe("첫 문장입니다.");
    expect(result.endsWith(".")).toBe(true);
  });

  it("never ends mid-word/mid-sentence when a clean sentence boundary exists before maxLength", () => {
    const firstSentence = "단순히 돼지를 보기만 했는지, 돼지가 직접 다가오는지에 따라 해석이 달라진다.";
    const text = `${firstSentence} 다음 문장이 이어진다.`;
    const result = excerptBySentence(text, firstSentence.length + 5);
    expect(result).toBe(firstSentence);
  });

  it("falls back to the last space (not mid-word) when the first sentence alone exceeds maxLength", () => {
    const text = "가나다라마바사아자차카타파하 " + "단어".repeat(30) + " 끝.";
    const result = excerptBySentence(text, 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(text.startsWith(result)).toBe(true);
    // 잘린 지점이 실제 공백 경계였는지 확인 — 다음 글자가 이어지는 단어 중간이 아니어야 한다.
    expect(text[result.length]).not.toMatch(/\S/);
  });
});

describe("buildExcerpt", () => {
  it("combines markdown stripping and sentence-boundary truncation", () => {
    const firstSentence = "단순히 돼지를 보기만 했는지, 돼지가 직접 다가오는지에 따라 해석이 달라진다.";
    const raw = `## 돼지꿈은 보통 어떻게 해석할까?\n${firstSentence} 다음 문장이 이어진다.`;
    const result = buildExcerpt(raw, firstSentence.length + 5);
    expect(result).not.toMatch(/#/);
    expect(result).toBe(firstSentence);
  });

  it("never leaves raw markdown tokens in the output for realistic long content", () => {
    const raw =
      "## 소제목\n본문 **강조** 내용이 이어지고 이어지고 이어지고 이어지고 이어지고 이어지고 계속됩니다. 그리고 다음 문장도 있습니다.";
    const result = buildExcerpt(raw, 60);
    expect(result).not.toContain("#");
    expect(result).not.toContain("**");
  });
});
