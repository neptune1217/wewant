/**
 * 기준정보(부서·사용자) 관리 규칙 (순수 함수, DB와 무관)
 * 서버 동작이 DB에서 필요한 값을 모아 넘기고, 결과가 오류 문구면 저장하지 않는다.
 */
import { AUTH_ADMIN, type Actor } from "./permission-rules";

export type DeptTypeCode = "GUKSO" | "BUSEO";

export type DeptParentRef = {
  deptId: string;
  deptType: DeptTypeCode;
  active: boolean;
};

/**
 * 부서 계층 검사. 문제가 없으면 null, 있으면 화면에 보여 줄 문구.
 * - 국소: 상위 부서 없음
 * - 부서: 상위 없음(사업소) 또는 활성 국소
 * - 활성 하위 부서가 있는 국소는 부서로 바꿀 수 없음
 */
export function checkDeptHierarchy(input: {
  selfId?: string;
  deptType: DeptTypeCode;
  parent: DeptParentRef | null;
  activeChildCount?: number;
}): string | null {
  const { selfId, deptType, parent, activeChildCount = 0 } = input;

  if (deptType === "GUKSO") {
    return parent ? "국소는 상위 부서를 가질 수 없습니다." : null;
  }

  if (activeChildCount > 0) {
    return `활성 하위 부서 ${activeChildCount}개가 있어 부서로 바꿀 수 없습니다. 하위 부서를 먼저 옮기거나 비활성화하세요.`;
  }
  if (!parent) return null;
  if (selfId && parent.deptId === selfId) return "자기 자신을 상위 부서로 고를 수 없습니다.";
  if (parent.deptType !== "GUKSO") return "상위 부서는 국소만 고를 수 있습니다.";
  if (!parent.active) return "비활성 국소는 상위 부서로 고를 수 없습니다.";
  return null;
}

/**
 * 부서 비활성화를 막는 이유 목록. 빈 배열이면 비활성화 가능.
 */
export function deptDeactivationBlockers(counts: {
  activeChildren: number;
  activeUsers: number;
  activeComms: number;
}): string[] {
  const reasons: string[] = [];
  if (counts.activeChildren > 0) reasons.push(`활성 하위 부서 ${counts.activeChildren}개`);
  if (counts.activeUsers > 0) reasons.push(`소속 활성 사용자 ${counts.activeUsers}명`);
  if (counts.activeComms > 0) reasons.push(`소관 활성 위원회 ${counts.activeComms}개`);
  return reasons;
}

export type UserChange = { newAuthId: string; newActive: boolean };

/**
 * 사용자 권한·활성 상태 변경 보호 규칙. 문제가 없으면 null.
 * - 본인을 비활성화하거나 본인의 총괄 권한을 내릴 수 없다
 * - 활성 총괄은 최소 1명 남아야 한다
 * @param activeAdminCount 변경 전 활성 총괄 수 (대상 포함)
 */
export function checkUserChange(
  actor: Actor,
  target: { userId: string; authId: string; active: boolean },
  change: UserChange,
  activeAdminCount: number,
): string | null {
  const isSelf = actor.userId === target.userId;
  if (isSelf && !change.newActive) return "본인 계정은 비활성화할 수 없습니다.";
  if (isSelf && target.authId === AUTH_ADMIN && change.newAuthId !== AUTH_ADMIN) {
    return "본인의 총괄 권한은 내릴 수 없습니다.";
  }

  const wasActiveAdmin = target.active && target.authId === AUTH_ADMIN;
  const staysActiveAdmin = change.newActive && change.newAuthId === AUTH_ADMIN;
  if (wasActiveAdmin && !staysActiveAdmin && activeAdminCount <= 1) {
    return "활성 총괄담당자는 최소 1명 있어야 합니다.";
  }
  return null;
}
