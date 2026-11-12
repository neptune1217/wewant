import { randomInt } from "node:crypto";

// 전화로 불러 주기 쉽도록 헷갈리는 글자(0 O 1 l I)는 뺀다
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const ALL = LETTERS + DIGITS;

/** 임시 비밀번호 (영문+숫자, 기본 12자). 계정 발급·비밀번호 초기화에 쓴다. */
export function generateTempPassword(length = 12): string {
  if (length < 8) throw new Error("임시 비밀번호는 8자 이상이어야 합니다.");
  const chars = [
    LETTERS[randomInt(LETTERS.length)],
    DIGITS[randomInt(DIGITS.length)],
    ...Array.from({ length: length - 2 }, () => ALL[randomInt(ALL.length)]),
  ];
  // 섞기 (Fisher–Yates)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
