import { describe, expect, it } from "vitest";
import { generateTempPassword } from "./temp-password";

describe("임시 비밀번호", () => {
  it("기본 12자, 헷갈리는 글자(0 O 1 l I) 없음", () => {
    for (let i = 0; i < 200; i++) {
      const pw = generateTempPassword();
      expect(pw).toHaveLength(12);
      expect(pw).not.toMatch(/[0O1lI]/);
    }
  });

  it("영문과 숫자를 모두 포함", () => {
    for (let i = 0; i < 200; i++) {
      const pw = generateTempPassword();
      expect(pw).toMatch(/[A-Za-z]/);
      expect(pw).toMatch(/[2-9]/);
    }
  });

  it("매번 다르다", () => {
    const set = new Set(Array.from({ length: 100 }, () => generateTempPassword()));
    expect(set.size).toBe(100);
  });

  it("8자 미만은 만들지 않는다", () => {
    expect(() => generateTempPassword(7)).toThrow();
  });
});
