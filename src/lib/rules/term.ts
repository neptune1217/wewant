/**
 * 임기 계산 규칙 (순수 함수, DB·화면과 무관)
 *
 * 날짜는 "시간 없는 날짜"로 다룬다. JS Date로 표현할 때는 항상 UTC 자정으로 맞춘다.
 * (Prisma가 @db.Date 필드를 UTC 자정 Date로 돌려주는 방식과 같다.)
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" → UTC 자정 Date. 형식이 틀리거나 없는 날짜면 오류. */
export function parseDate(text: string): Date {
  const m = DATE_RE.exec(text);
  if (!m) throw new Error(`날짜 형식이 올바르지 않습니다: ${text}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    throw new Error(`존재하지 않는 날짜입니다: ${text}`);
  }
  return date;
}

/** Date → "YYYY-MM-DD" (UTC 기준) */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * 임기만료 예정일 기본값 = 위촉일 + 임기년수 − 1일
 * 예: 2026-10-01 위촉, 임기 2년 → 2028-09-30
 *
 * 윤일(2/29) 위촉 후 만료 해에 2/29가 없으면 3/1을 기념일로 보아 2/28이 된다.
 */
export function calcExpireDue(appointStart: Date, termYr: number): Date {
  if (!Number.isInteger(termYr) || termYr < 1) {
    throw new Error(`임기년수는 1 이상의 정수여야 합니다: ${termYr}`);
  }
  const y = appointStart.getUTCFullYear() + termYr;
  const m = appointStart.getUTCMonth();
  const d = appointStart.getUTCDate();
  // Date.UTC는 없는 날짜(평년 2/29)를 다음 날(3/1)로 넘긴다. 거기서 하루를 뺀다.
  return new Date(Date.UTC(y, m, d) - 24 * 60 * 60 * 1000);
}

// ───────────── 5단계: 위촉 흐름별 날짜 계산 ─────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/** 날짜에 일수를 더한다 (음수면 뺀다) */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** D-day = 만료 예정일 − 오늘 (일). 당일 0, 지나면 음수 */
export function dDay(expireDue: Date, today: Date): number {
  return Math.round((expireDue.getTime() - today.getTime()) / DAY_MS);
}

export type AppointTypeCode = "EX_OFFICIO" | "APPOINTED";

/**
 * 만료 예정일 결정
 * - 당연직: 없음(null)
 * - 직접 입력값(보궐 등)이 있으면 그 값. 위촉일보다 이르면 오류
 * - 없으면 기본값 = 위촉일 + 임기년수 − 1일
 */
export function resolveExpireDue(input: {
  appointType: AppointTypeCode;
  start: Date;
  termYr: number;
  manual?: Date | null;
}): { expireDue: Date | null } | { error: string } {
  if (input.appointType === "EX_OFFICIO") return { expireDue: null };
  if (input.manual) {
    if (input.manual.getTime() < input.start.getTime()) {
      return { error: "만료 예정일은 위촉일과 같거나 이후여야 합니다." };
    }
    return { expireDue: input.manual };
  }
  return { expireDue: calcExpireDue(input.start, input.termYr) };
}

/**
 * 연임: 다음 임기 날짜. 이전 만료 예정일 다음 날 시작, 만료 예정일은 새로 계산.
 * 예) 2년 임기, 2027-12-31 만료 → 2028-01-01 ~ 2029-12-31
 */
export function nextTermDates(
  prevExpireDue: Date | null,
  termYr: number,
): { start: Date; expireDue: Date } | { error: string } {
  if (!prevExpireDue) return { error: "만료 예정일이 없는 위촉(당연직)은 연임할 수 없습니다." };
  const start = addDays(prevExpireDue, 1);
  return { start, expireDue: calcExpireDue(start, termYr) };
}

/**
 * 임기 중 위원회 내 직위 변경 (위원 → 위원장 등)
 * 이전 건은 변경일 전날 종료, 새 건은 변경일 시작, 만료 예정일은 남은 임기를 승계한다.
 */
export function positionChangeDates(input: {
  start: Date;
  expireDue: Date | null;
  changeDate: Date;
}): { prevEnd: Date; newStart: Date; newExpireDue: Date | null } | { error: string } {
  const { start, expireDue, changeDate } = input;
  if (changeDate.getTime() <= start.getTime()) {
    return { error: "직위 변경일은 현재 위촉일 다음 날 이후여야 합니다." };
  }
  if (expireDue && changeDate.getTime() > expireDue.getTime()) {
    return { error: "직위 변경일이 만료 예정일보다 늦습니다. 임기가 끝났다면 연임으로 처리하세요." };
  }
  return { prevEnd: addDays(changeDate, -1), newStart: changeDate, newExpireDue: expireDue };
}

/** 앞 날짜가 뒤 날짜와 같거나 이른가 */
export function checkDateOrder(earlier: Date, later: Date): boolean {
  return earlier.getTime() <= later.getTime();
}
