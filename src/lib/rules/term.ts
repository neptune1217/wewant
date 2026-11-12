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
