import { describe, expect, it } from "vitest";
import {
  appointedCommCount,
  DUP_WARN_THRESHOLD,
  dupIconLabel,
  isCountedDupAppoint,
  isDuplicateWarn,
  newAppointDupWarning,
  type DupAppoint,
} from "./duplicate-rules";

/** 테스트용 위촉 건 (기본: 재임 중 위촉직, 운영 중 위원회) */
const ap = (p: Partial<DupAppoint> & Pick<DupAppoint, "commId">): DupAppoint => ({
  personId: "p1",
  type: "APPOINTED",
  active: true,
  commActive: true,
  commApproved: true,
  ...p,
});

describe("위촉직 건수 = 재임 중인 위촉직이 있는 집계 대상 위원회 수", () => {
  it("위촉직 3개 위원회 → 3", () => {
    const list = [ap({ commId: "c1" }), ap({ commId: "c2" }), ap({ commId: "c3" })];
    expect(appointedCommCount(list, "p1")).toBe(3);
  });
  it("당연직은 세지 않는다", () => {
    const list = [ap({ commId: "c1" }), ap({ commId: "c2", type: "EX_OFFICIO" })];
    expect(appointedCommCount(list, "p1")).toBe(1);
  });
  it("해촉된(재임 중이 아닌) 건은 세지 않는다", () => {
    const list = [ap({ commId: "c1" }), ap({ commId: "c2", active: false })];
    expect(appointedCommCount(list, "p1")).toBe(1);
  });
  it("승인 대기·비활성 위원회는 세지 않는다", () => {
    const list = [
      ap({ commId: "c1" }),
      ap({ commId: "c2", commApproved: false }),
      ap({ commId: "c3", commActive: false }),
    ];
    expect(appointedCommCount(list, "p1")).toBe(1);
  });
  it("동명이인은 인물 고유코드로 따로 센다", () => {
    const list = [
      ap({ commId: "c1", personId: "p1" }),
      ap({ commId: "c2", personId: "p1" }),
      ap({ commId: "c3", personId: "p2" }),
    ];
    expect(appointedCommCount(list, "p1")).toBe(2);
    expect(appointedCommCount(list, "p2")).toBe(1);
  });
  it("같은 위원회의 건이 둘이어도 한 위원회로 센다 (연임 직후 새 건 등)", () => {
    const list = [ap({ commId: "c1" }), ap({ commId: "c1" })];
    expect(appointedCommCount(list, "p1")).toBe(1);
  });
  it("건별 판정", () => {
    expect(isCountedDupAppoint(ap({ commId: "c1" }))).toBe(true);
    expect(isCountedDupAppoint(ap({ commId: "c1", type: "EX_OFFICIO" }))).toBe(false);
  });
});

describe("경고 아이콘: 위촉직 4개 이상", () => {
  it("기준은 4", () => {
    expect(DUP_WARN_THRESHOLD).toBe(4);
  });
  it("3개는 아이콘 없음, 4개부터 표시", () => {
    expect(isDuplicateWarn(3)).toBe(false);
    expect(isDuplicateWarn(4)).toBe(true);
    expect(isDuplicateWarn(5)).toBe(true);
  });
  it("아이콘 설명 문구", () => {
    expect(dupIconLabel(4)).toBe("위촉직 4개 위원회 중복 위촉");
  });
});

describe("신규 위촉 저장 전 경고 (차단하지 않음)", () => {
  it("이미 위촉직 3개 → 4번째 위촉직이면 경고", () => {
    expect(newAppointDupWarning(3, "APPOINTED")).toMatch(/위촉직이 4개가 됩니다/);
  });
  it("이미 4개 → 5개가 된다고 경고", () => {
    expect(newAppointDupWarning(4, "APPOINTED")).toMatch(/5개/);
  });
  it("2개 → 3번째는 경고 없음", () => {
    expect(newAppointDupWarning(2, "APPOINTED")).toBeNull();
  });
  it("당연직으로 위촉하면 경고하지 않는다", () => {
    expect(newAppointDupWarning(5, "EX_OFFICIO")).toBeNull();
  });
});
