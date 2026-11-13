import { describe, expect, it } from "vitest";
import {
  capacityWarning,
  checkDismissDate,
  hasActiveInComm,
  reappointCount,
  reappointWarning,
  shouldDeactivatePos,
  tenureByPosition,
  type AppointLite,
} from "./appoint-rules";
import { parseDate } from "./term";

const d = parseDate;

/** 테스트용 위촉 건 만들기 */
const ap = (p: Partial<AppointLite> & Pick<AppointLite, "appointId">): AppointLite => ({
  commId: "c1",
  personId: "p1",
  apposId: "s3",
  type: "APPOINTED",
  kind: "NEW",
  start: d("2026-01-01"),
  end: null,
  active: true,
  ...p,
});

describe("연임횟수 = 최초 임기를 뺀, 연임으로 추가된 임기 수 (사용자 예시)", () => {
  // 임기 2년: 최초 2026-01-01~2027-12-31, 연임1 2028-01-01~2029-12-31, 연임2 2030-01-01~2031-12-31
  const first = ap({ appointId: "t1", kind: "NEW", start: d("2026-01-01"), end: d("2027-12-31"), active: false });
  const re1 = ap({ appointId: "t2", kind: "REAPPOINT", start: d("2028-01-01"), end: d("2029-12-31"), active: false });
  const re2 = ap({ appointId: "t3", kind: "REAPPOINT", start: d("2030-01-01") });

  it("최초 임기만 있으면 0회", () => {
    expect(reappointCount([first], "c1", "p1")).toBe(0);
  });
  it("연임 1회 후 1회", () => {
    expect(reappointCount([first, re1], "c1", "p1")).toBe(1);
  });
  it("연임 2회 후 2회", () => {
    expect(reappointCount([first, re1, re2], "c1", "p1")).toBe(2);
  });
  it("임기 중 직위변경으로 나뉜 건은 세지 않는다 (같은 임기)", () => {
    const split = ap({ appointId: "t4", kind: "POS_CHANGE", apposId: "s1", start: d("2029-01-01") });
    expect(reappointCount([first, re1, split], "c1", "p1")).toBe(1);
  });
  it("보궐 위촉은 연임이 아니다", () => {
    expect(reappointCount([ap({ appointId: "t5", kind: "BY_ELECT" })], "c1", "p1")).toBe(0);
  });
  it("다른 위원회·다른 인물의 연임은 세지 않는다", () => {
    const otherComm = ap({ appointId: "t6", kind: "REAPPOINT", commId: "c2" });
    const otherPerson = ap({ appointId: "t7", kind: "REAPPOINT", personId: "p2" });
    expect(reappointCount([first, otherComm, otherPerson], "c1", "p1")).toBe(0);
  });
  it("당연직 건은 세지 않는다", () => {
    expect(reappointCount([ap({ appointId: "t8", kind: "REAPPOINT", type: "EX_OFFICIO" })], "c1", "p1")).toBe(0);
  });
});

describe("연임은 연속된 임기 — 공백 후 신규 위촉되면 0회로 초기화 (사용자 예시)", () => {
  // 임기 2년: 2026~2027 최초, 2028~2029 연임 1회 후 임기만료 해촉, 공백, 2032-01-01 신규 위촉
  const first = ap({ appointId: "t1", kind: "NEW", start: d("2026-01-01"), end: d("2027-12-31"), active: false });
  const re1 = ap({ appointId: "t2", kind: "REAPPOINT", start: d("2028-01-01"), end: d("2029-12-31"), active: false });
  const again = ap({ appointId: "t3", kind: "NEW", start: d("2032-01-01"), end: null, active: true });

  it("2032년 신규 위촉 후 연임횟수는 0회", () => {
    expect(reappointCount([first, re1, again], "c1", "p1")).toBe(0);
  });
  it("저장 순서가 섞여 있어도 위촉일 순으로 판단", () => {
    expect(reappointCount([again, re1, first], "c1", "p1")).toBe(0);
  });
  it("2032년 임기 뒤 연임하면 다시 1회부터", () => {
    const re2 = ap({ appointId: "t4", kind: "REAPPOINT", start: d("2034-01-01") });
    const ended = { ...again, end: d("2033-12-31"), active: false };
    expect(reappointCount([first, re1, ended, re2], "c1", "p1")).toBe(1);
  });
  it("과거 건 기준으로 보면 그 당시의 연임횟수 (명부의 해촉 줄 표시용)", () => {
    expect(reappointCount([first, re1, again], "c1", "p1", "t2")).toBe(1);
    expect(reappointCount([first, re1, again], "c1", "p1", "t1")).toBe(0);
    expect(reappointCount([first, re1, again], "c1", "p1", "t3")).toBe(0);
  });
  it("보궐로 새로 시작해도 초기화", () => {
    const byElect = ap({ appointId: "t5", kind: "BY_ELECT", start: d("2032-01-01") });
    expect(reappointCount([first, re1, byElect], "c1", "p1")).toBe(0);
  });
  it("연속 임기 중 직위변경으로 나뉜 건은 끊지 않는다", () => {
    const split = ap({ appointId: "t6", kind: "POS_CHANGE", apposId: "s1", start: d("2029-03-01") });
    const re1Ended = { ...re1, end: d("2029-02-28") };
    const re2 = ap({ appointId: "t7", kind: "REAPPOINT", apposId: "s1", start: d("2030-01-01") });
    expect(reappointCount([first, re1Ended, split, re2], "c1", "p1")).toBe(2);
  });
});

describe("연임 가능횟수 경고 (차단하지 않음)", () => {
  it("연임 가능횟수 0회 위원회: 첫 연임부터 경고", () => {
    expect(reappointWarning(0, 0)).toMatch(/연임할 수 없는|0회/);
  });
  it("가능횟수 1회, 지금까지 0회 → 이번 연임은 허용 범위", () => {
    expect(reappointWarning(0, 1)).toBeNull();
  });
  it("가능횟수 1회, 이미 1회 → 이번이 2번째라 경고", () => {
    expect(reappointWarning(1, 1)).toMatch(/2번째/);
  });
  it("가능횟수 2회, 이미 1회 → 허용 범위", () => {
    expect(reappointWarning(1, 2)).toBeNull();
  });
});

describe("정원 초과 경고 (차단하지 않음)", () => {
  it("정원 안이면 없음", () => {
    expect(capacityWarning(9, 10)).toBeNull();
  });
  it("정원이 찼을 때 한 명 더 → 경고", () => {
    expect(capacityWarning(10, 10)).toMatch(/정원 10명/);
  });
});

describe("같은 위원회에 같은 인물이 이미 재임 중인지", () => {
  const list = [ap({ appointId: "t1" }), ap({ appointId: "t2", active: false, personId: "p2" })];
  it("재임 중이면 true", () => {
    expect(hasActiveInComm(list, "c1", "p1")).toBe(true);
  });
  it("해촉된 건만 있으면 false", () => {
    expect(hasActiveInComm(list, "c1", "p2")).toBe(false);
  });
  it("다른 위원회면 false", () => {
    expect(hasActiveInComm(list, "c2", "p1")).toBe(false);
  });
  it("자기 자신(연임·직위변경 처리 중인 건)은 빼고 판단", () => {
    expect(hasActiveInComm(list, "c1", "p1", "t1")).toBe(false);
  });
});

describe("해촉일 검사", () => {
  it("위촉일 이후(당일 포함)면 통과", () => {
    expect(checkDismissDate(d("2026-01-01"), d("2026-01-01"))).toBeNull();
    expect(checkDismissDate(d("2026-01-01"), d("2026-06-30"))).toBeNull();
  });
  it("위촉일보다 이르면 오류", () => {
    expect(checkDismissDate(d("2026-01-01"), d("2025-12-31"))).toMatch(/위촉일/);
  });
});

describe("직위별 재임기간 합산 (같은 위원회·같은 인물, 위원회 내 직위별)", () => {
  const today = d("2027-12-31");
  it("위원 → 위원장으로 바뀐 경우 각각 합산 (양 끝 날 포함)", () => {
    const list = [
      ap({ appointId: "t1", apposId: "s3", start: d("2026-01-01"), end: d("2026-12-31"), active: false }),
      ap({ appointId: "t2", apposId: "s1", kind: "POS_CHANGE", start: d("2027-01-01") }),
    ];
    const r = tenureByPosition(list, "c1", "p1", today);
    expect(r.get("s3")).toBe(365);
    expect(r.get("s1")).toBe(365);
  });
  it("재임 중인 건은 오늘까지", () => {
    const r = tenureByPosition([ap({ appointId: "t1", start: d("2027-12-01") })], "c1", "p1", today);
    expect(r.get("s3")).toBe(31);
  });
  it("아직 시작 전인 건은 0일", () => {
    const r = tenureByPosition([ap({ appointId: "t1", start: d("2028-01-01") })], "c1", "p1", today);
    expect(r.get("s3")).toBe(0);
  });
  it("윤년 포함 기간", () => {
    const r = tenureByPosition(
      [ap({ appointId: "t1", start: d("2028-01-01"), end: d("2028-12-31"), active: false })],
      "c1",
      "p1",
      d("2029-06-01"),
    );
    expect(r.get("s3")).toBe(366);
  });
});

describe("소속직위 교체 후 옛 행 비활성화", () => {
  it("아무 위촉 건도 가리키지 않으면 비활성화", () => {
    expect(shouldDeactivatePos(0)).toBe(true);
  });
  it("다른 위원회 위촉 건이 아직 가리키면 그대로", () => {
    expect(shouldDeactivatePos(1)).toBe(false);
  });
});
