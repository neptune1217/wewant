import { describe, expect, it } from "vitest";
import {
  filterMembers,
  filterToLabel,
  filterToQuery,
  parseMemberFilter,
  type MemberFilterRow,
} from "./member-filter";

const row = (p: Partial<MemberFilterRow> & Pick<MemberFilterRow, "appointId">): MemberFilterRow => ({
  commId: "c1",
  deptId: "d1",
  name: "홍길동",
  gender: "MALE",
  birthYear: 1970,
  type: "APPOINTED",
  active: true,
  reappointCount: 0,
  ...p,
});

describe("주소(URL) 조건 해석", () => {
  it("아무것도 없으면 재임 중 전체", () => {
    expect(parseMemberFilter({})).toEqual({ status: "ACTIVE" });
  });
  it("모든 조건", () => {
    expect(
      parseMemberFilter({
        name: " 홍 ",
        birthFrom: "1960",
        birthTo: "1979",
        gender: "FEMALE",
        type: "EX_OFFICIO",
        reappoint: "3+",
        status: "ALL",
        comm: "c00002",
        dept: "d00018",
      }),
    ).toEqual({
      name: "홍",
      birthFrom: 1960,
      birthTo: 1979,
      gender: "FEMALE",
      type: "EX_OFFICIO",
      reappoint: "3+",
      status: "ALL",
      commId: "c00002",
      deptId: "d00018",
    });
  });
  it("잘못된 값은 무시한다", () => {
    expect(
      parseMemberFilter({ birthFrom: "abc", birthTo: "19", gender: "X", reappoint: "9", status: "?", type: "Z" }),
    ).toEqual({ status: "ACTIVE" });
  });
  it("시작 연도가 끝보다 크면 바꿔 넣는다", () => {
    const f = parseMemberFilter({ birthFrom: "1980", birthTo: "1970" });
    expect([f.birthFrom, f.birthTo]).toEqual([1970, 1980]);
  });
  it("같은 이름이 여러 번 오면 첫 값", () => {
    expect(parseMemberFilter({ gender: ["MALE", "FEMALE"] }).gender).toBe("MALE");
  });
  it("조건 → 주소 → 조건이 그대로 (화면과 엑셀이 같은 조건)", () => {
    const f = parseMemberFilter({ name: "홍", birthFrom: "1960", reappoint: "1", status: "ENDED", comm: "c1" });
    const back = parseMemberFilter(Object.fromEntries(new URLSearchParams(filterToQuery(f))));
    expect(back).toEqual(f);
  });
  it("기본값(재임 중)은 주소에 넣지 않는다", () => {
    expect(filterToQuery({ status: "ACTIVE" })).toBe("");
  });
});

describe("필터 적용", () => {
  const list = [
    row({ appointId: "t1", name: "홍길동", birthYear: 1960, gender: "MALE" }),
    row({ appointId: "t2", name: "홍길순", birthYear: 1975, gender: "FEMALE", reappointCount: 1 }),
    row({ appointId: "t3", name: "김구", birthYear: 1980, type: "EX_OFFICIO", commId: "c2", deptId: "d2" }),
    row({ appointId: "t4", name: "이순신", birthYear: 1970, active: false, reappointCount: 3 }),
    row({ appointId: "t5", name: "유관순", birthYear: 1990, reappointCount: 5, gender: "FEMALE" }),
  ];
  const ids = (f: Parameters<typeof filterMembers>[1]) => filterMembers(list, f).map((r) => r.appointId);

  it("기본은 재임 중만", () => {
    expect(ids({ status: "ACTIVE" })).toEqual(["t1", "t2", "t3", "t5"]);
  });
  it("해촉만 / 전체", () => {
    expect(ids({ status: "ENDED" })).toEqual(["t4"]);
    expect(ids({ status: "ALL" })).toHaveLength(5);
  });
  it("출생연도 범위는 양 끝 포함", () => {
    expect(ids({ status: "ALL", birthFrom: 1970, birthTo: 1980 })).toEqual(["t2", "t3", "t4"]);
  });
  it("출생연도 한쪽만", () => {
    expect(ids({ status: "ALL", birthFrom: 1980 })).toEqual(["t3", "t5"]);
    expect(ids({ status: "ALL", birthTo: 1960 })).toEqual(["t1"]);
  });
  it("성별", () => {
    expect(ids({ status: "ALL", gender: "FEMALE" })).toEqual(["t2", "t5"]);
  });
  it("위촉유형", () => {
    expect(ids({ status: "ALL", type: "EX_OFFICIO" })).toEqual(["t3"]);
  });
  it("연임횟수: 정확히 1회", () => {
    expect(ids({ status: "ALL", reappoint: "1" })).toEqual(["t2"]);
  });
  it("연임횟수: 3회 이상", () => {
    expect(ids({ status: "ALL", reappoint: "3+" })).toEqual(["t4", "t5"]);
  });
  it("위원회·부서", () => {
    expect(ids({ status: "ALL", commId: "c2" })).toEqual(["t3"]);
    expect(ids({ status: "ALL", deptId: "d1" })).toHaveLength(4);
  });
  it("성명 일부", () => {
    expect(ids({ status: "ALL", name: "길" })).toEqual(["t1", "t2"]);
  });
  it("여러 조건을 함께 (모두 만족)", () => {
    expect(ids({ status: "ACTIVE", gender: "FEMALE", birthFrom: 1980 })).toEqual(["t5"]);
  });
});

describe("조건 설명 (이력·엑셀용)", () => {
  it("조건이 없으면 재임 중 전체", () => {
    expect(filterToLabel({ status: "ACTIVE" }, {})).toEqual(["위해촉 상태: 재임 중"]);
  });
  it("위원회·부서는 이름으로", () => {
    const lines = filterToLabel(
      { status: "ALL", commId: "c1", deptId: "d1", birthFrom: 1960, reappoint: "3+", gender: "MALE" },
      { commName: "민원조정위원회", deptName: "민원담당관" },
    );
    expect(lines).toContain("위원회: 민원조정위원회");
    expect(lines).toContain("부서: 민원담당관");
    expect(lines).toContain("출생연도: 1960년 이후");
    expect(lines).toContain("연임횟수: 3회 이상");
    expect(lines).toContain("성별: 남");
    expect(lines).toContain("위해촉 상태: 전체");
  });
});
