import { describe, expect, it } from "vitest";
import {
  checkDeptHierarchy,
  deptDeactivationBlockers,
  checkUserChange,
  type UserChange,
} from "./master-rules";
import { AUTH_ADMIN, AUTH_DEPT, type Actor } from "./permission-rules";

describe("부서 계층 검사", () => {
  const activeGukso = { deptId: "d00001", deptType: "GUKSO" as const, active: true };

  it("국소는 상위 부서가 없어야 한다", () => {
    expect(checkDeptHierarchy({ deptType: "GUKSO", parent: null })).toBeNull();
    expect(checkDeptHierarchy({ deptType: "GUKSO", parent: activeGukso })).toMatch(/국소/);
  });

  it("부서는 활성 국소를 상위로 둘 수 있다", () => {
    expect(checkDeptHierarchy({ deptType: "BUSEO", parent: activeGukso })).toBeNull();
  });

  it("부서는 상위 없이 둘 수 있다 (사업소)", () => {
    expect(checkDeptHierarchy({ deptType: "BUSEO", parent: null })).toBeNull();
  });

  it("부서의 상위가 부서이면 안 된다", () => {
    const parent = { deptId: "d00012", deptType: "BUSEO" as const, active: true };
    expect(checkDeptHierarchy({ deptType: "BUSEO", parent })).toMatch(/국소만/);
  });

  it("비활성 국소는 상위로 고를 수 없다", () => {
    const parent = { ...activeGukso, active: false };
    expect(checkDeptHierarchy({ deptType: "BUSEO", parent })).toMatch(/비활성/);
  });

  it("자기 자신을 상위로 고를 수 없다", () => {
    expect(
      checkDeptHierarchy({ selfId: "d00001", deptType: "BUSEO", parent: activeGukso }),
    ).toMatch(/자기 자신/);
  });

  it("활성 하위 부서가 있는 국소는 부서로 바꿀 수 없다", () => {
    expect(
      checkDeptHierarchy({ selfId: "d00001", deptType: "BUSEO", parent: null, activeChildCount: 5 }),
    ).toMatch(/하위 부서 5개/);
    expect(
      checkDeptHierarchy({ selfId: "d00001", deptType: "BUSEO", parent: null, activeChildCount: 0 }),
    ).toBeNull();
  });
});

describe("부서 비활성화 가능 여부", () => {
  it("연결된 활성 항목이 없으면 가능", () => {
    expect(deptDeactivationBlockers({ activeChildren: 0, activeUsers: 0, activeComms: 0 })).toEqual([]);
  });

  it("남아 있는 항목을 모두 알려 준다", () => {
    expect(deptDeactivationBlockers({ activeChildren: 2, activeUsers: 1, activeComms: 3 })).toEqual([
      "활성 하위 부서 2개",
      "소속 활성 사용자 1명",
      "소관 활성 위원회 3개",
    ]);
  });

  it("하나만 남아도 막는다", () => {
    expect(deptDeactivationBlockers({ activeChildren: 0, activeUsers: 0, activeComms: 1 })).toEqual([
      "소관 활성 위원회 1개",
    ]);
  });
});

describe("사용자 변경 보호 규칙 (본인·마지막 총괄)", () => {
  const me: Actor = { userId: "u00001", authId: AUTH_ADMIN, active: true };
  const other = { userId: "u00009", authId: AUTH_ADMIN, active: true };
  const deptUser = { userId: "u00002", authId: AUTH_DEPT, active: true };
  const keep = (t: { authId: string; active: boolean }): UserChange => ({
    newAuthId: t.authId,
    newActive: t.active,
  });

  it("평범한 수정은 허용", () => {
    expect(checkUserChange(me, deptUser, keep(deptUser), 1)).toBeNull();
  });

  it("자기 자신은 비활성화할 수 없다", () => {
    expect(checkUserChange(me, { ...me }, { newAuthId: AUTH_ADMIN, newActive: false }, 2)).toMatch(
      /본인/,
    );
  });

  it("자기 자신의 총괄 권한을 내릴 수 없다", () => {
    expect(checkUserChange(me, { ...me }, { newAuthId: AUTH_DEPT, newActive: true }, 2)).toMatch(
      /본인/,
    );
  });

  it("마지막 활성 총괄은 비활성화하거나 권한을 내릴 수 없다", () => {
    expect(checkUserChange(me, other, { newAuthId: AUTH_ADMIN, newActive: false }, 1)).toMatch(
      /최소 1명/,
    );
    expect(checkUserChange(me, other, { newAuthId: AUTH_DEPT, newActive: true }, 1)).toMatch(
      /최소 1명/,
    );
  });

  it("다른 활성 총괄이 있으면 다른 총괄을 내릴 수 있다", () => {
    expect(checkUserChange(me, other, { newAuthId: AUTH_DEPT, newActive: true }, 2)).toBeNull();
  });

  it("부서 계정의 비활성화·권한 변경은 총괄 수와 무관", () => {
    expect(checkUserChange(me, deptUser, { newAuthId: AUTH_DEPT, newActive: false }, 1)).toBeNull();
    expect(checkUserChange(me, deptUser, { newAuthId: AUTH_ADMIN, newActive: true }, 1)).toBeNull();
  });

  it("비활성 총괄을 다시 활성화하는 것은 허용", () => {
    const inactiveAdmin = { userId: "u00010", authId: AUTH_ADMIN, active: false };
    expect(
      checkUserChange(me, inactiveAdmin, { newAuthId: AUTH_ADMIN, newActive: true }, 1),
    ).toBeNull();
  });
});
