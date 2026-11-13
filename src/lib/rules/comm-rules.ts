/**
 * 위원회(TB_Comm) 규칙 (순수 함수, DB와 무관)
 *
 * - 편집 권한: 담당자(mng_user_id) 한 사람 + 총괄 (CLAUDE.md 규칙 2)
 * - 담당자 변경(인사이동 인계)은 총괄만
 * - 부서 계정이 등록한 위원회는 총괄이 승인할 때까지 "승인 대기"이며 집계에서 빠진다
 */
import { canEditComm, isAdmin, type Actor, type CommRef } from "./permission-rules";

const NO_PERMISSION = "이 위원회를 수정할 권한이 없습니다.";

/** 위원회 등록 허용 여부. 문제가 없으면 null */
export function checkCommCreate(actor: Actor, input: { mngUserId: string }): string | null {
  if (!actor.active) return "위원회를 등록할 권한이 없습니다.";
  if (isAdmin(actor)) return null;
  if (input.mngUserId !== actor.userId) return "부서 계정은 본인을 담당자로만 등록할 수 있습니다.";
  return null;
}

/** 등록 직후 승인 여부: 총괄이 등록하면 바로 승인, 부서 계정이면 승인 대기 */
export function approvedOnCreate(actor: Actor): boolean {
  return isAdmin(actor);
}

/** 위원회 수정 허용 여부. 문제가 없으면 null */
export function checkCommUpdate(
  actor: Actor,
  comm: CommRef,
  input: { mngUserId: string },
): string | null {
  if (!canEditComm(actor, comm)) return NO_PERMISSION;
  if (!isAdmin(actor) && input.mngUserId !== comm.mngUserId) {
    return "담당자 변경은 총괄담당자만 할 수 있습니다.";
  }
  return null;
}

export type InstTypeCode = "LAW" | "ORDINANCE" | "ETC";

/** 설치유형별 근거 필수 입력: 법령 → 근거법령명, 조례 → 근거조례규칙명, 기타 → 선택 */
export function legalBasisError(
  instType: InstTypeCode,
  legal1: string | null,
  legal2: string | null,
): { field: "legal_1" | "legal_2"; message: string } | null {
  if (instType === "LAW" && !legal1) {
    return { field: "legal_1", message: "설치유형이 법령이면 근거법령명을 입력하세요." };
  }
  if (instType === "ORDINANCE" && !legal2) {
    return { field: "legal_2", message: "설치유형이 조례면 근거조례규칙명을 입력하세요." };
  }
  return null;
}

/**
 * 통계·중복위촉 수·홈 요약 등 집계에 포함할 위원회인가: 활성이면서 승인된 위원회만.
 * 이후 단계의 모든 집계는 이 함수(또는 같은 조건의 DB 조건 COUNTED_COMM_WHERE)를 쓴다.
 */
export function isCountedComm(comm: { active: boolean; approved: boolean }): boolean {
  return comm.active && comm.approved;
}

/** DB 조회용 같은 조건 (Prisma where) */
export const COUNTED_COMM_WHERE = { comm_activ: true, comm_approved: true } as const;

export type CommStatus = "ACTIVE" | "PENDING" | "INACTIVE";

/** 화면 표시용 상태: 운영 중 / 승인 대기 / 비활성 */
export function commStatus(comm: { active: boolean; approved: boolean }): CommStatus {
  if (!comm.active) return "INACTIVE";
  return comm.approved ? "ACTIVE" : "PENDING";
}

export const COMM_STATUS_LABEL: Record<CommStatus, string> = {
  ACTIVE: "운영 중",
  PENDING: "승인 대기",
  INACTIVE: "비활성",
};
