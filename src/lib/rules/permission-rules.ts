/**
 * 권한 판정 규칙 (순수 함수, DB·세션과 무관)
 *
 * 서버 코드는 이 파일을 직접 쓰지 않고 `src/lib/permissions.ts`를 거친다.
 * permissions.ts가 세션에서 Actor를 만들고 이 규칙을 다시 내보낸다.
 *
 * 핵심 원칙 (CLAUDE.md 규칙 1·2)
 * - 편집 권한 기준은 위원회의 mng_user_id 한 사람이다. 같은 부서 동료라도 편집할 수 없다.
 * - 총괄(r01)은 전체 가능.
 * - 비활성 사용자는 아무것도 할 수 없다.
 */

export const AUTH_ADMIN = "r01"; // 총괄
export const AUTH_DEPT = "r02"; // 부서

/** 권한을 판단할 사용자 */
export type Actor = {
  userId: string;
  authId: string;
  active: boolean;
};

/** 권한 판단에 필요한 위원회 정보 */
export type CommRef = {
  mngUserId: string;
};

/** 열람 요청 건 (TB_AccessReq 중 이 위원회에 대한 것) */
export type AccessGrant = {
  reqUserId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  /** 이 날짜(포함)까지 열람 가능. 시간 없는 날짜(UTC 자정) */
  viewUntil: Date | null;
};

/** 총괄 여부 (활성 사용자만) */
export function isAdmin(actor: Actor): boolean {
  return actor.active && actor.authId === AUTH_ADMIN;
}

/** 위원회 담당자 본인 여부 (활성 사용자만) */
function isManager(actor: Actor, comm: CommRef): boolean {
  return actor.active && comm.mngUserId === actor.userId;
}

/** 부서·사용자·위원회직위명 같은 기준정보 관리 */
export function canManageMaster(actor: Actor): boolean {
  return isAdmin(actor);
}

/** 위원회 정보·위촉(위원 명부) 생성·수정·비활성화 */
export function canEditComm(actor: Actor, comm: CommRef): boolean {
  return isAdmin(actor) || isManager(actor, comm);
}

/**
 * 위원회 상세(위원 명부) 열람
 * 총괄·담당자는 항상, 그 외에는 본인 요청이 승인되고 오늘이 view_until 이전(당일 포함)일 때만.
 */
export function canViewCommDetail(
  actor: Actor,
  comm: CommRef,
  grants: AccessGrant[],
  today: Date,
): boolean {
  if (!actor.active) return false;
  if (canEditComm(actor, comm)) return true;
  return grants.some(
    (g) =>
      g.reqUserId === actor.userId &&
      g.status === "APPROVED" &&
      g.viewUntil !== null &&
      g.viewUntil.getTime() >= today.getTime(),
  );
}

/**
 * 열람 요청 — 담당자·총괄은 이미 열람할 수 있으므로 요청 대상이 아니다.
 * (대기 중·열람 중 중복 요청 여부는 access-rules.ts의 requestBlockReason)
 */
export function canRequestAccess(actor: Actor, comm: CommRef): boolean {
  return actor.active && !canEditComm(actor, comm);
}

/** 열람 요청 승인·거절 — 위원회의 현재 담당자와 총괄 (담당자가 바뀌면 새 담당자) */
export function canDecideAccess(actor: Actor, comm: CommRef): boolean {
  return canEditComm(actor, comm);
}

/** 엑셀 내보내기 — 열람 권한이 있는 위원회만 */
export function canExportComm(
  actor: Actor,
  comm: CommRef,
  grants: AccessGrant[],
  today: Date,
): boolean {
  return canViewCommDetail(actor, comm, grants, today);
}

/**
 * 인물(TB_Person) 수정
 * 총괄, 또는 그 인물의 위촉 건이 모두 본인 담당 위원회에 있을 때.
 * @param appointComms 그 인물의 모든 위촉 건이 속한 위원회 목록
 */
export function canEditPerson(actor: Actor, appointComms: CommRef[]): boolean {
  if (isAdmin(actor)) return true;
  return actor.active && appointComms.every((c) => isManager(actor, c));
}

/**
 * 소속직위(TB_Pos) 행의 글자 수정(오타 정정)
 * 총괄, 또는 그 행을 참조하는 위촉 건이 모두 본인 담당 위원회에 있을 때.
 * (소속직위 "변경"은 행 수정이 아니라 위촉 건의 pos_id 교체이며 canEditComm으로 판단한다.)
 * @param referencingComms 그 행을 참조하는 위촉 건이 속한 위원회 목록
 */
export function canEditPos(actor: Actor, referencingComms: CommRef[]): boolean {
  return canEditPerson(actor, referencingComms);
}

/** 사용자 정보 열람 — 부서 계정은 본인 것만, 총괄은 모두 */
export function canViewUser(actor: Actor, targetUserId: string): boolean {
  if (isAdmin(actor)) return true;
  return actor.active && actor.userId === targetUserId;
}

/** 인물 등록 — 활성 사용자 누구나 (중복 확인은 등록 화면이 먼저 묻는다) */
export function canCreatePerson(actor: Actor): boolean {
  return actor.active;
}

/** 인물의 소속직위 새 행 추가 — 활성 사용자 누구나 (기존 행 글자 수정은 canEditPos) */
export function canAddPosition(actor: Actor): boolean {
  return actor.active;
}
