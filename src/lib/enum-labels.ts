/**
 * 선택값의 한글 표기 ↔ 코드 값 대응표.
 * DB에는 한글(@map 값)이 저장되지만, Prisma 코드에서는 영문 값(GUKSO 등)을 쓴다.
 * 화면 표시와 엑셀 읽기·쓰기는 이 표를 거친다.
 */
import {
  AppointKind,
  AppointType,
  AuditAction,
  DeptType,
  EndReason,
  Gender,
  InstType,
  OpType,
  ReqStatus,
} from "@/generated/prisma/enums";

export const DEPT_TYPE_LABEL = { [DeptType.GUKSO]: "국소", [DeptType.BUSEO]: "부서" } as const;

export const INST_TYPE_LABEL = {
  [InstType.LAW]: "법령",
  [InstType.ORDINANCE]: "조례",
  [InstType.ETC]: "기타",
} as const;

export const OP_TYPE_LABEL = { [OpType.STANDING]: "상설", [OpType.NON_STANDING]: "비상설" } as const;

export const GENDER_LABEL = { [Gender.MALE]: "남", [Gender.FEMALE]: "여" } as const;

export const APPOINT_TYPE_LABEL = {
  [AppointType.EX_OFFICIO]: "당연직",
  [AppointType.APPOINTED]: "위촉직",
} as const;

export const APPOINT_KIND_LABEL = {
  [AppointKind.NEW]: "신규",
  [AppointKind.REAPPOINT]: "연임",
  [AppointKind.BY_ELECT]: "보궐",
  [AppointKind.POS_CHANGE]: "직위변경",
} as const;

export const END_REASON_LABEL = {
  [EndReason.EXPIRED]: "임기만료",
  [EndReason.RESIGNED]: "사임",
  [EndReason.DISMISSED]: "해촉",
  [EndReason.POS_CHANGE]: "직위변경",
  [EndReason.ETC]: "기타",
} as const;

export const REQ_STATUS_LABEL = {
  [ReqStatus.PENDING]: "대기",
  [ReqStatus.APPROVED]: "승인",
  [ReqStatus.REJECTED]: "거절",
} as const;

export const AUDIT_ACTION_LABEL = {
  [AuditAction.CREATE]: "생성",
  [AuditAction.UPDATE]: "수정",
  [AuditAction.DELETE]: "삭제",
  [AuditAction.EXPORT]: "내보내기",
  [AuditAction.LOGIN]: "로그인",
} as const;

/** 한글 표기 → 코드 값. 표에 없는 값이면 오류를 낸다. */
export function fromLabel<K extends string>(
  table: Record<K, string>,
  label: string,
  fieldName: string,
): K {
  const found = (Object.keys(table) as K[]).find((k) => table[k] === label.trim());
  if (!found) {
    throw new Error(`${fieldName}: 알 수 없는 값 "${label}" (가능한 값: ${Object.values(table).join(", ")})`);
  }
  return found;
}
