"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";

import {
  combineIfComplete,
  distributeDigits,
  normalizeTwoDigit,
  onlyDigits,
  parsePartsFromValue,
} from "./birthDateSplitInputLogic";

// claude-code-luck-platform-daily-fortune-number-demo-prompt.md §7: 달력 picker 하나에만
// 의존하지 않는 분할형 생년월일 입력. year(4자리)/month(2자리)/day(2자리) 세 개의 별도
// 입력을 관리하고, 셋 다 채워졌을 때만 부모에게 "YYYY-MM-DD" 정규화 문자열을 올려보낸다 —
// 실제 존재하는 날짜인지(윤년 등)는 이 컴포넌트가 판단하지 않는다(lib/logic/
// guestFortuneValidation.ts의 isValidCalendarDate가 그 책임을 이미 갖고 있어 중복 검증
// 로직을 만들지 않는다) — 부모가 error prop으로 내려주는 메시지만 표시한다. 실제 문자열
// 조립/파싱 로직은 birthDateSplitInputLogic.ts(순수 함수, 단위 테스트됨)에 있다.

export interface BirthDateSplitInputHandle {
  // §9 "제출 시 첫 오류 필드로 focus를 이동한다" — 비어있는 첫 필드, 없으면 day 필드로
  // 이동한다(윤년/미래 날짜 같은 "날짜 자체"의 문제는 대개 day 필드 근처가 자연스럽다).
  focusFirstIncompleteOrLast: () => void;
}

interface BirthDateSplitInputProps {
  idPrefix: string;
  value: string; // "YYYY-MM-DD" 또는 "" — 부모(GuestFortuneForm)가 소유하는 단일 source of truth
  onChange: (value: string) => void;
  error?: string | null;
  errorId?: string;
}

const BirthDateSplitInput = forwardRef<BirthDateSplitInputHandle, BirthDateSplitInputProps>(
  function BirthDateSplitInput({ idPrefix, value, onChange, error, errorId }, ref) {
    // value("YYYY-MM-DD")가 완성된 뒤에는 그 값을 그대로 신뢰하지만, 입력 도중(한 자리만
    // 채운 월/일 등)에는 아직 완성된 "YYYY-MM-DD"가 아니라 부모에 올릴 수 없다 — 그래서
    // 세 필드의 raw 텍스트는 이 컴포넌트가 로컬로 들고 있고, 완성됐을 때만 onChange로 올린다.
    const initial = parsePartsFromValue(value);
    const [year, setYear] = useState(initial.year);
    const [month, setMonth] = useState(initial.month);
    const [day, setDay] = useState(initial.day);

    const yearRef = useRef<HTMLInputElement>(null);
    const monthRef = useRef<HTMLInputElement>(null);
    const dayRef = useRef<HTMLInputElement>(null);

    // 버그 수정: handleMonthChange가 두 자리가 채워지자마자 dayRef.focus()를 "동기적으로"
    // 호출하면, 그 focus() 호출이 month input의 blur 이벤트를 같은 동기 실행 안에서 즉시
    // 발생시킨다 — 이 시점은 setMonth(next)가 아직 리렌더에 반영되기 전이라, handleMonthBlur가
    // 클로저로 캡처한 "month" state는 여전히 이전 값(예: "01" 입력 중 "0"만 있던 상태)이다.
    // 그 stale 값을 normalizeTwoDigit로 패딩하면 "00"이 되어 방금 완성한 "01"을 덮어썼다
    // (실측: "01"→"00", "09"→"00", 첫 자리가 "0"인 모든 두 자리 월/일에서 재현됨). state는
    // 비동기라 신뢰할 수 없으므로, 항상 동기적으로 최신값을 갖는 ref를 별도로 두고 blur/paste
    // 핸들러는 이 ref만 읽는다.
    const monthValueRef = useRef(initial.month);
    const dayValueRef = useRef(initial.day);

    useImperativeHandle(ref, () => ({
      focusFirstIncompleteOrLast() {
        if (year.length < 4) {
          yearRef.current?.focus();
        } else if (month.length < 1) {
          monthRef.current?.focus();
        } else {
          dayRef.current?.focus();
        }
      },
    }));

    function emitIfComplete(nextYear: string, nextMonth: string, nextDay: string) {
      onChange(combineIfComplete({ year: nextYear, month: nextMonth, day: nextDay }) ?? "");
    }

    function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
      const parts = distributeDigits(event.clipboardData.getData("text"));
      if (!parts) {
        return; // 8자리가 아니면 기본 붙여넣기 동작(현재 필드에만 삽입)에 맡긴다.
      }
      event.preventDefault();
      monthValueRef.current = parts.month;
      dayValueRef.current = parts.day;
      setYear(parts.year);
      setMonth(parts.month);
      setDay(parts.day);
      emitIfComplete(parts.year, parts.month, parts.day);
      dayRef.current?.focus();
    }

    function handleYearChange(event: React.ChangeEvent<HTMLInputElement>) {
      const next = onlyDigits(event.target.value).slice(0, 4);
      setYear(next);
      emitIfComplete(next, month, day);
      if (next.length === 4) {
        monthRef.current?.focus();
      }
    }

    function handleMonthChange(event: React.ChangeEvent<HTMLInputElement>) {
      const next = onlyDigits(event.target.value).slice(0, 2);
      monthValueRef.current = next; // ref를 먼저 동기 갱신 — 아래 focus()가 유발하는 blur가
      // 이 값을 즉시 신뢰할 수 있게 한다(state는 아직 반영 전일 수 있음).
      setMonth(next);
      emitIfComplete(year, next, day);
      // "1"~"9"는 아직 두 번째 자리가 올 수 있어 자동 이동하지 않는다 — "01"~"12"처럼
      // 두 자리가 채워지거나 "2"~"9"처럼 더 입력할 수 없는 값일 때만 다음 필드로 넘어간다.
      if (next.length === 2) {
        dayRef.current?.focus();
      }
    }

    function handleDayChange(event: React.ChangeEvent<HTMLInputElement>) {
      const next = onlyDigits(event.target.value).slice(0, 2);
      dayValueRef.current = next;
      setDay(next);
      emitIfComplete(year, month, next);
    }

    // month/day state가 아니라 ref를 읽는다 — 이 blur가 사용자의 자연스러운 포커스 이동뿐
    // 아니라 handleMonthChange/handlePaste가 dayRef.focus()를 동기 호출해 발생시키는 경우도
    // 있는데, 그 경우 state는 아직 최신값으로 리렌더되기 전이다(위 주석 참조).
    function handleMonthBlur() {
      const current = monthValueRef.current;
      const padded = normalizeTwoDigit(current);
      if (padded !== current) {
        monthValueRef.current = padded;
        setMonth(padded);
        emitIfComplete(year, padded, day);
      }
    }

    function handleDayBlur() {
      const current = dayValueRef.current;
      const padded = normalizeTwoDigit(current);
      if (padded !== current) {
        dayValueRef.current = padded;
        setDay(padded);
        emitIfComplete(year, month, padded);
      }
    }

    // Backspace가 빈 필드에서 눌리면 이전 필드로 돌아간다(§7 "Backspace 시 앞 필드로
    // 자연스럽게 돌아갈 수 있게 한다") — 브라우저 기본 동작은 필드 간 이동을 모르므로 직접 구현.
    function handleMonthKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
      if (event.key === "Backspace" && month.length === 0) {
        yearRef.current?.focus();
      }
    }

    function handleDayKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
      if (event.key === "Backspace" && day.length === 0) {
        monthRef.current?.focus();
      }
    }

    const inputClassName =
      "rounded-md border border-border bg-bg-base px-2 py-2 text-center text-body text-text-primary";

    return (
      <fieldset className="flex flex-col gap-1">
        <legend className="text-body font-medium text-text-primary">
          생년월일 <span aria-hidden="true">*</span>
        </legend>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`${idPrefix}-year`} className="sr-only">
            연도 4자리
          </label>
          <input
            ref={yearRef}
            id={`${idPrefix}-year`}
            type="text"
            inputMode="numeric"
            autoComplete="bday-year"
            placeholder="1999"
            maxLength={4}
            value={year}
            onChange={handleYearChange}
            onPaste={handlePaste}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={`${inputClassName} w-20`}
          />
          <span aria-hidden="true" className="text-body text-text-secondary">
            년
          </span>

          <label htmlFor={`${idPrefix}-month`} className="sr-only">
            월 2자리
          </label>
          <input
            ref={monthRef}
            id={`${idPrefix}-month`}
            type="text"
            inputMode="numeric"
            autoComplete="bday-month"
            placeholder="01"
            maxLength={2}
            value={month}
            onChange={handleMonthChange}
            onBlur={handleMonthBlur}
            onKeyDown={handleMonthKeyDown}
            onPaste={handlePaste}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={`${inputClassName} w-14`}
          />
          <span aria-hidden="true" className="text-body text-text-secondary">
            월
          </span>

          <label htmlFor={`${idPrefix}-day`} className="sr-only">
            일 2자리
          </label>
          <input
            ref={dayRef}
            id={`${idPrefix}-day`}
            type="text"
            inputMode="numeric"
            autoComplete="bday-day"
            placeholder="10"
            maxLength={2}
            value={day}
            onChange={handleDayChange}
            onBlur={handleDayBlur}
            onKeyDown={handleDayKeyDown}
            onPaste={handlePaste}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={`${inputClassName} w-14`}
          />
          <span aria-hidden="true" className="text-body text-text-secondary">
            일
          </span>
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-caption text-danger">
            {error}
          </p>
        )}
      </fieldset>
    );
  }
);

export default BirthDateSplitInput;
