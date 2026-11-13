import { describe, expect, it } from "vitest";
import {
  approvedOnCreate,
  checkCommCreate,
  checkCommUpdate,
  commStatus,
  isCountedComm,
  legalBasisError,
} from "./comm-rules";
import { AUTH_ADMIN, AUTH_DEPT, type Actor } from "./permission-rules";

const admin: Actor = { userId: "u00001", authId: AUTH_ADMIN, active: true };
const deptA: Actor = { userId: "u00002", authId: AUTH_DEPT, active: true };
const deptB: Actor = { userId: "u00003", authId: AUTH_DEPT, active: true };
const inactiveDept: Actor = { userId: "u00002", authId: AUTH_DEPT, active: false };

describe("위원회 등록 허용 여부", () => {
  it("부서 계정은 본인을 담당자로 등록할 수 있다", () => {
    expect(checkCommCreate(deptA, { mngUserId: "u00002" })).toBeNull();
  });
  it("부서 계정은 다른 사람을 담당자로 등록할 수 없다", () => {
    expect(checkCommCreate(deptA, { mngUserId: "u00003" })).toMatch(/본인/);
  });
  it("총괄은 누구든 담당자로 지정할 수 있다", () => {
    expect(checkCommCreate(admin, { mngUserId: "u00003" })).toBeNull();
  });
  it("비활성 사용자는 등록할 수 없다", () => {
    expect(checkCommCreate(inactiveDept, { mngUserId: "u00002" })).toMatch(/권한/);
  });
});

describe("위원회 등록 시 승인 상태", () => {
  it("총괄이 등록하면 바로 승인", () => {
    expect(approvedOnCreate(admin)).toBe(true);
  });
  it("부서 계정이 등록하면 승인 대기", () => {
    expect(approvedOnCreate(deptA)).toBe(false);
  });
});

describe("위원회 수정 허용 여부 — 담당자 한 사람 + 총괄", () => {
  const commA = { mngUserId: "u00002" };

  it("담당자 본인은 수정 가능 (담당자 그대로)", () => {
    expect(checkCommUpdate(deptA, commA, { mngUserId: "u00002" })).toBeNull();
  });
  it("담당자가 아닌 부서 계정은 수정 불가", () => {
    expect(checkCommUpdate(deptB, commA, { mngUserId: "u00002" })).toMatch(/권한/);
  });
  it("담당자 본인도 담당자를 바꿀 수는 없다 (인계는 총괄)", () => {
    expect(checkCommUpdate(deptA, commA, { mngUserId: "u00003" })).toMatch(/총괄/);
  });
  it("담당자가 아닌 계정이 담당자를 자기로 바꾸려 해도 불가", () => {
    expect(checkCommUpdate(deptB, commA, { mngUserId: "u00003" })).toMatch(/권한/);
  });
  it("총괄은 수정과 담당자 변경 모두 가능", () => {
    expect(checkCommUpdate(admin, commA, { mngUserId: "u00003" })).toBeNull();
  });
  it("비활성 사용자는 본인 담당이어도 불가", () => {
    expect(checkCommUpdate(inactiveDept, commA, { mngUserId: "u00002" })).toMatch(/권한/);
  });
});

describe("설치유형별 근거 입력", () => {
  it("법령이면 근거법령명 필수", () => {
    expect(legalBasisError("LAW", null, "조례명")).toEqual({
      field: "legal_1",
      message: expect.stringMatching(/근거법령명/),
    });
    expect(legalBasisError("LAW", "법령명", null)).toBeNull();
  });
  it("조례면 근거조례규칙명 필수", () => {
    expect(legalBasisError("ORDINANCE", "법령명", null)).toEqual({
      field: "legal_2",
      message: expect.stringMatching(/근거조례규칙명/),
    });
    expect(legalBasisError("ORDINANCE", null, "조례명")).toBeNull();
  });
  it("기타면 둘 다 비워도 된다", () => {
    expect(legalBasisError("ETC", null, null)).toBeNull();
    expect(legalBasisError("ETC", "법령명", null)).toBeNull();
  });
});

describe("집계(통계·중복위촉 등) 포함 여부 — 활성이면서 승인된 위원회만", () => {
  it("활성 + 승인 → 포함", () => {
    expect(isCountedComm({ active: true, approved: true })).toBe(true);
  });
  it("승인 대기 → 제외", () => {
    expect(isCountedComm({ active: true, approved: false })).toBe(false);
  });
  it("비활성 → 제외", () => {
    expect(isCountedComm({ active: false, approved: true })).toBe(false);
  });
});

describe("위원회 상태 표시값", () => {
  it("운영 중 / 승인 대기 / 비활성", () => {
    expect(commStatus({ active: true, approved: true })).toBe("ACTIVE");
    expect(commStatus({ active: true, approved: false })).toBe("PENDING");
    expect(commStatus({ active: false, approved: true })).toBe("INACTIVE");
    expect(commStatus({ active: false, approved: false })).toBe("INACTIVE");
  });
});
