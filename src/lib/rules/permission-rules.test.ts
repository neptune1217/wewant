import { describe, expect, it } from "vitest";
import {
  AUTH_ADMIN,
  AUTH_DEPT,
  canAddPosition,
  canDecideAccess,
  canCreatePerson,
  canEditComm,
  canEditPerson,
  canEditPos,
  canExportComm,
  canManageMaster,
  canRequestAccess,
  canViewCommDetail,
  canViewUser,
  isAdmin,
  type AccessGrant,
  type Actor,
} from "./permission-rules";
import { parseDate } from "./term";

// 가상 사용자
const admin: Actor = { userId: "u00001", authId: AUTH_ADMIN, active: true };
const deptA: Actor = { userId: "u00002", authId: AUTH_DEPT, active: true };
const deptB: Actor = { userId: "u00003", authId: AUTH_DEPT, active: true };
const inactiveAdmin: Actor = { userId: "u00009", authId: AUTH_ADMIN, active: false };
const inactiveDept: Actor = { userId: "u00002", authId: AUTH_DEPT, active: false };

// 위원회 담당자: c1은 deptA, c2는 deptB
const commA = { mngUserId: "u00002" };
const commB = { mngUserId: "u00003" };

const today = parseDate("2026-11-13");

describe("총괄 여부", () => {
  it("r01만 총괄", () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(deptA)).toBe(false);
  });
  it("비활성 사용자는 총괄이 아니다", () => {
    expect(isAdmin(inactiveAdmin)).toBe(false);
  });
});

describe("기준정보(조직·사용자·위원회직위명) 관리", () => {
  it("총괄만 가능", () => {
    expect(canManageMaster(admin)).toBe(true);
    expect(canManageMaster(deptA)).toBe(false);
  });
});

describe("위원회 편집 — 담당자(mng_user_id) 한 사람 + 총괄", () => {
  it("담당자 본인은 편집 가능", () => {
    expect(canEditComm(deptA, commA)).toBe(true);
  });
  it("다른 담당자의 위원회는 편집 불가 (같은 부서 동료여도)", () => {
    expect(canEditComm(deptB, commA)).toBe(false);
  });
  it("총괄은 모든 위원회 편집 가능", () => {
    expect(canEditComm(admin, commA)).toBe(true);
    expect(canEditComm(admin, commB)).toBe(true);
  });
  it("비활성 사용자는 본인 담당이어도 불가", () => {
    expect(canEditComm(inactiveDept, commA)).toBe(false);
    expect(canEditComm(inactiveAdmin, commA)).toBe(false);
  });
});

describe("위원회 상세 열람 — 담당자·총괄·승인된 열람 기간", () => {
  const grant = (g: Partial<AccessGrant>): AccessGrant => ({
    reqUserId: "u00003",
    status: "APPROVED",
    viewUntil: parseDate("2026-11-20"),
    ...g,
  });

  it("담당자 본인과 총괄은 항상 열람", () => {
    expect(canViewCommDetail(deptA, commA, [], today)).toBe(true);
    expect(canViewCommDetail(admin, commA, [], today)).toBe(true);
  });
  it("요청이 없으면 타 담당자는 열람 불가", () => {
    expect(canViewCommDetail(deptB, commA, [], today)).toBe(false);
  });
  it("승인되고 기간 안이면 열람 가능", () => {
    expect(canViewCommDetail(deptB, commA, [grant({})], today)).toBe(true);
  });
  it("view_until 당일까지 열람 가능", () => {
    expect(canViewCommDetail(deptB, commA, [grant({ viewUntil: today })], today)).toBe(true);
  });
  it("view_until 다음 날부터 열람 불가 (재요청 필요)", () => {
    expect(
      canViewCommDetail(deptB, commA, [grant({ viewUntil: parseDate("2026-11-12") })], today),
    ).toBe(false);
  });
  it("대기·거절 상태는 열람 불가", () => {
    expect(canViewCommDetail(deptB, commA, [grant({ status: "PENDING" })], today)).toBe(false);
    expect(canViewCommDetail(deptB, commA, [grant({ status: "REJECTED" })], today)).toBe(false);
  });
  it("다른 사람에게 승인된 건으로는 열람 불가", () => {
    const other: Actor = { userId: "u00004", authId: AUTH_DEPT, active: true };
    expect(canViewCommDetail(other, commA, [grant({})], today)).toBe(false);
  });
  it("승인 건에 기간이 없으면 열람 불가", () => {
    expect(canViewCommDetail(deptB, commA, [grant({ viewUntil: null })], today)).toBe(false);
  });
  it("열람 승인을 받아도 편집은 불가", () => {
    expect(canViewCommDetail(deptB, commA, [grant({})], today)).toBe(true);
    expect(canEditComm(deptB, commA)).toBe(false);
  });
  it("비활성 사용자는 열람 불가", () => {
    expect(canViewCommDetail(inactiveDept, commA, [], today)).toBe(false);
  });
});

describe("인물 수정 — 그 인물의 위촉 건이 모두 본인 담당 위원회에 있을 때만", () => {
  it("모든 위촉 건이 본인 담당이면 가능", () => {
    expect(canEditPerson(deptA, [commA, commA])).toBe(true);
  });
  it("하나라도 다른 담당자 위원회에 있으면 불가", () => {
    expect(canEditPerson(deptA, [commA, commB])).toBe(false);
  });
  it("위촉 건이 없는 인물(방금 등록한 인물)은 부서 담당자도 가능", () => {
    expect(canEditPerson(deptA, [])).toBe(true);
  });
  it("총괄은 항상 가능", () => {
    expect(canEditPerson(admin, [commA, commB])).toBe(true);
  });
  it("비활성 사용자는 불가", () => {
    expect(canEditPerson(inactiveDept, [])).toBe(false);
  });
});

describe("소속직위(TB_Pos) 글자 수정 — 그 행을 참조하는 위촉 건이 모두 본인 담당일 때만", () => {
  it("참조 건이 모두 본인 담당이면 가능", () => {
    expect(canEditPos(deptA, [commA])).toBe(true);
  });
  it("다른 담당자 위원회가 참조 중이면 불가", () => {
    expect(canEditPos(deptA, [commA, commB])).toBe(false);
  });
  it("총괄은 항상 가능", () => {
    expect(canEditPos(admin, [commB])).toBe(true);
  });
});

describe("사용자정보 열람", () => {
  it("부서 계정은 본인 것만", () => {
    expect(canViewUser(deptA, "u00002")).toBe(true);
    expect(canViewUser(deptA, "u00003")).toBe(false);
  });
  it("총괄은 모두", () => {
    expect(canViewUser(admin, "u00003")).toBe(true);
  });
  it("비활성 사용자는 본인 것도 불가", () => {
    expect(canViewUser(inactiveDept, "u00002")).toBe(false);
  });
});

describe("엑셀 내보내기 — 열람 권한이 있는 위원회만", () => {
  it("열람 권한과 같다", () => {
    expect(canExportComm(deptA, commA, [], today)).toBe(true);
    expect(canExportComm(deptB, commA, [], today)).toBe(false);
    expect(canExportComm(admin, commB, [], today)).toBe(true);
  });
});

describe("인물 등록·소속직위 추가 (5단계) — 활성 사용자 누구나", () => {
  it("총괄·부서 모두 가능", () => {
    expect(canCreatePerson(admin)).toBe(true);
    expect(canCreatePerson(deptA)).toBe(true);
    expect(canAddPosition(deptB)).toBe(true);
  });
  it("비활성 사용자는 불가", () => {
    expect(canCreatePerson(inactiveDept)).toBe(false);
    expect(canAddPosition(inactiveDept)).toBe(false);
  });
});

describe("열람 요청·처리", () => {
  it("담당자도 총괄도 아닌 부서 계정만 요청할 수 있다", () => {
    expect(canRequestAccess(deptB, commA)).toBe(true);
  });
  it("담당자 본인과 총괄은 요청할 필요가 없다(불가)", () => {
    expect(canRequestAccess(deptA, commA)).toBe(false);
    expect(canRequestAccess(admin, commA)).toBe(false);
  });
  it("비활성 사용자는 요청 불가", () => {
    expect(canRequestAccess({ ...deptB, active: false }, commA)).toBe(false);
  });
  it("승인·거절은 현재 담당자와 총괄만", () => {
    expect(canDecideAccess(deptA, commA)).toBe(true);
    expect(canDecideAccess(admin, commA)).toBe(true);
    expect(canDecideAccess(deptB, commA)).toBe(false);
  });
  it("담당자가 바뀌면 새 담당자가 처리한다", () => {
    const handedOver = { mngUserId: "u00003" };
    expect(canDecideAccess(deptA, handedOver)).toBe(false);
    expect(canDecideAccess(deptB, handedOver)).toBe(true);
  });
  it("비활성 사용자는 처리 불가", () => {
    expect(canDecideAccess(inactiveDept, commA)).toBe(false);
  });
});
