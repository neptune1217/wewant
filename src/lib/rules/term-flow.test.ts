import { describe, expect, it } from "vitest";
import {
  addDays,
  dDay,
  formatDate,
  nextTermDates,
  parseDate,
  positionChangeDates,
  resolveExpireDue,
} from "./term";

const d = parseDate;
const f = (v: Date | null) => (v ? formatDate(v) : null);

describe("날짜 더하기", () => {
  it("월말·연말·윤년을 넘어간다", () => {
    expect(formatDate(addDays(d("2027-12-31"), 1))).toBe("2028-01-01");
    expect(formatDate(addDays(d("2028-02-28"), 1))).toBe("2028-02-29");
    expect(formatDate(addDays(d("2028-03-01"), -1))).toBe("2028-02-29");
  });
});

describe("D-day = 만료 예정일 − 오늘", () => {
  it("남은 날수", () => {
    expect(dDay(d("2026-12-31"), d("2026-11-13"))).toBe(48);
  });
  it("당일은 0, 지나면 음수", () => {
    expect(dDay(d("2026-11-13"), d("2026-11-13"))).toBe(0);
    expect(dDay(d("2026-11-10"), d("2026-11-13"))).toBe(-3);
  });
  it("윤년 2월을 넘어가는 기간", () => {
    expect(dDay(d("2028-03-01"), d("2028-02-28"))).toBe(2);
  });
});

describe("만료 예정일 결정", () => {
  it("위촉직은 위촉일 + 임기 − 1일", () => {
    const r = resolveExpireDue({ appointType: "APPOINTED", start: d("2026-10-01"), termYr: 2 });
    expect("expireDue" in r && f(r.expireDue)).toBe("2028-09-30");
  });
  it("당연직은 만료 예정일이 없다 (직접 입력값도 무시)", () => {
    const r = resolveExpireDue({
      appointType: "EX_OFFICIO",
      start: d("2026-10-01"),
      termYr: 2,
      manual: d("2027-01-01"),
    });
    expect("expireDue" in r && r.expireDue).toBeNull();
  });
  it("윤일 위촉", () => {
    const r = resolveExpireDue({ appointType: "APPOINTED", start: d("2024-02-29"), termYr: 2 });
    expect("expireDue" in r && f(r.expireDue)).toBe("2026-02-28");
  });
  it("보궐: 전임자의 남은 임기로 직접 입력한 값을 쓴다", () => {
    const r = resolveExpireDue({
      appointType: "APPOINTED",
      start: d("2027-03-15"),
      termYr: 2,
      manual: d("2027-12-31"),
    });
    expect("expireDue" in r && f(r.expireDue)).toBe("2027-12-31");
  });
  it("직접 입력한 만료 예정일이 위촉일보다 이르면 오류", () => {
    const r = resolveExpireDue({
      appointType: "APPOINTED",
      start: d("2027-03-15"),
      termYr: 2,
      manual: d("2027-03-14"),
    });
    expect("error" in r && r.error).toMatch(/위촉일/);
  });
  it("위촉일 당일 만료(1일 임기)는 허용", () => {
    const r = resolveExpireDue({
      appointType: "APPOINTED",
      start: d("2027-03-15"),
      termYr: 2,
      manual: d("2027-03-15"),
    });
    expect("expireDue" in r && f(r.expireDue)).toBe("2027-03-15");
  });
});

describe("연임: 다음 임기는 이전 만료 예정일 다음 날부터 (사용자 예시)", () => {
  it("2년 임기: 최초 2026-01-01 ~ 2027-12-31", () => {
    const r = resolveExpireDue({ appointType: "APPOINTED", start: d("2026-01-01"), termYr: 2 });
    expect("expireDue" in r && f(r.expireDue)).toBe("2027-12-31");
  });
  it("연임 1회: 2028-01-01 ~ 2029-12-31", () => {
    const r = nextTermDates(d("2027-12-31"), 2);
    expect("start" in r && [f(r.start), f(r.expireDue)]).toEqual(["2028-01-01", "2029-12-31"]);
  });
  it("연임 2회: 2030-01-01 ~ 2031-12-31", () => {
    const r = nextTermDates(d("2029-12-31"), 2);
    expect("start" in r && [f(r.start), f(r.expireDue)]).toEqual(["2030-01-01", "2031-12-31"]);
  });
  it("10월 시작 예시: 2028-09-30 만료 → 2028-10-01 ~ 2030-09-30", () => {
    const r = nextTermDates(d("2028-09-30"), 2);
    expect("start" in r && [f(r.start), f(r.expireDue)]).toEqual(["2028-10-01", "2030-09-30"]);
  });
  it("윤년을 끼는 연임: 2028-02-28 만료, 1년 → 2028-02-29 ~ 2029-02-28", () => {
    const r = nextTermDates(d("2028-02-28"), 1);
    expect("start" in r && [f(r.start), f(r.expireDue)]).toEqual(["2028-02-29", "2029-02-28"]);
  });
  it("만료 예정일이 없으면(당연직) 연임할 수 없다", () => {
    const r = nextTermDates(null, 2);
    expect("error" in r && r.error).toMatch(/당연직|만료 예정일/);
  });
});

describe("임기 중 위원회 내 직위 변경 (위원 → 위원장)", () => {
  const base = { start: d("2026-10-01"), expireDue: d("2028-09-30") };

  it("이전 건은 변경일 전날 종료, 새 건은 변경일 시작, 만료 예정일은 승계", () => {
    const r = positionChangeDates({ ...base, changeDate: d("2027-03-01") });
    expect("prevEnd" in r && [f(r.prevEnd), f(r.newStart), f(r.newExpireDue)]).toEqual([
      "2027-02-28",
      "2027-03-01",
      "2028-09-30",
    ]);
  });
  it("윤년 3월 1일 변경이면 전날은 2월 29일", () => {
    const r = positionChangeDates({ start: d("2027-10-01"), expireDue: d("2029-09-30"), changeDate: d("2028-03-01") });
    expect("prevEnd" in r && f(r.prevEnd)).toBe("2028-02-29");
  });
  it("만료 예정일 당일 변경도 가능", () => {
    const r = positionChangeDates({ ...base, changeDate: d("2028-09-30") });
    expect("prevEnd" in r && f(r.newStart)).toBe("2028-09-30");
  });
  it("위촉일 당일이나 그 이전 변경은 오류 (이전 건 기간이 없어짐)", () => {
    expect("error" in positionChangeDates({ ...base, changeDate: d("2026-10-01") })).toBe(true);
    expect("error" in positionChangeDates({ ...base, changeDate: d("2026-09-01") })).toBe(true);
  });
  it("만료 예정일 이후 변경은 오류 (연임으로 처리)", () => {
    const r = positionChangeDates({ ...base, changeDate: d("2028-10-01") });
    expect("error" in r && r.error).toMatch(/만료 예정일/);
  });
  it("당연직(만료 예정일 없음)도 직위 변경 가능, 새 건도 만료 예정일 없음", () => {
    const r = positionChangeDates({ start: d("2026-10-01"), expireDue: null, changeDate: d("2027-01-01") });
    expect("prevEnd" in r && f(r.newExpireDue)).toBeNull();
  });
});
