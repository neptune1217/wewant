import { describe, expect, it } from "vitest";
import { calcExpireDue, formatDate, parseDate } from "./term";

/** 문자열 날짜로 계산해 문자열로 돌려받는 테스트용 도우미 */
const due = (start: string, termYr: number) =>
  formatDate(calcExpireDue(parseDate(start), termYr));

describe("임기만료 예정일 = 위촉일 + 임기년수 − 1일", () => {
  it("문서 예시: 2026-10-01 위촉, 임기 2년 → 2028-09-30", () => {
    expect(due("2026-10-01", 2)).toBe("2028-09-30");
  });

  it("임기 1년", () => {
    expect(due("2026-10-07", 1)).toBe("2027-10-06");
  });

  it("1월 1일 위촉이면 임기 마지막 해의 12월 31일", () => {
    expect(due("2026-01-01", 3)).toBe("2028-12-31");
  });

  it("월초 위촉이면 전월 말일 (2월 말 윤년)", () => {
    expect(due("2023-03-01", 1)).toBe("2024-02-29");
  });

  it("월초 위촉이면 전월 말일 (2월 말 평년)", () => {
    expect(due("2024-03-01", 1)).toBe("2025-02-28");
  });

  it("윤일(2/29) 위촉, 만료 해가 평년 → 2/28", () => {
    expect(due("2024-02-29", 1)).toBe("2025-02-28");
  });

  it("윤일(2/29) 위촉, 만료 해도 윤년 → 2/28", () => {
    expect(due("2024-02-29", 4)).toBe("2028-02-28");
  });

  it("연말을 넘어가는 경우", () => {
    expect(due("2026-12-31", 2)).toBe("2028-12-30");
  });

  it("원본 날짜를 바꾸지 않는다", () => {
    const start = parseDate("2026-10-01");
    calcExpireDue(start, 2);
    expect(formatDate(start)).toBe("2026-10-01");
  });

  it("임기년수가 1 미만이거나 정수가 아니면 오류", () => {
    expect(() => due("2026-10-01", 0)).toThrow();
    expect(() => due("2026-10-01", -1)).toThrow();
    expect(() => due("2026-10-01", 1.5)).toThrow();
  });
});

describe("날짜 변환", () => {
  it("YYYY-MM-DD 문자열을 시간 없는 날짜(UTC 자정)로 읽는다", () => {
    expect(parseDate("2026-10-01").toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("존재하지 않는 날짜나 잘못된 형식은 오류", () => {
    expect(() => parseDate("2025-02-29")).toThrow();
    expect(() => parseDate("2026-13-01")).toThrow();
    expect(() => parseDate("2026/10/01")).toThrow();
  });
});
