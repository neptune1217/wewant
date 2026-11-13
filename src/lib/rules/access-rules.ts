/**
 * 열람 요청(TB_AccessReq) 규칙 (순수 함수, DB와 무관)
 *
 * - 열람 가능일(view_until) = 승인일 + 열람 기간(일) − 1일. 그날까지(당일 포함) 읽기 전용으로 열람한다
 * - 대기 중이거나 열람 기간 안이면 새 요청을 받지 않는다. 거절·만료 후에는 다시 요청해야 한다
 * - 누가 요청·처리할 수 있는지는 permission-rules.ts (canRequestAccess, canDecideAccess)
 */
import { addDays } from "./term";

/** 열람 기간 범위 (일) */
export const MIN_VIEW_DAYS = 1;
export const MAX_VIEW_DAYS = 90;
export const DEFAULT_VIEW_DAYS = 7;

export type AccessReqLite = {
  reqId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reqAt: Date;
  /** 승인 건만. 이 날짜(포함)까지 열람 가능 */
  viewUntil: Date | null;
};

export type AccessStatusKind = "NONE" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export type AccessStatus = {
  kind: AccessStatusKind;
  /** 열람 중이거나 만료된 경우의 열람 가능일 */
  viewUntil: Date | null;
};

/** 열람 가능일 = 승인일 + 기간 − 1일 */
export function viewUntilDate(approveDate: Date, viewDays: number): Date {
  return addDays(approveDate, viewDays - 1);
}

function isViewing(r: AccessReqLite, today: Date): boolean {
  return r.status === "APPROVED" && r.viewUntil !== null && r.viewUntil.getTime() >= today.getTime();
}

/**
 * 한 사용자의 한 위원회에 대한 열람 상태.
 * 열람 기간 안인 승인 건이 있으면 열람 중, 아니면 가장 최근 요청의 상태.
 */
export function accessStatus(reqs: AccessReqLite[], today: Date): AccessStatus {
  const viewing = reqs
    .filter((r) => isViewing(r, today))
    .sort((a, b) => b.viewUntil!.getTime() - a.viewUntil!.getTime())[0];
  if (viewing) return { kind: "APPROVED", viewUntil: viewing.viewUntil };

  const latest = [...reqs].sort(
    (a, b) => b.reqAt.getTime() - a.reqAt.getTime() || b.reqId.localeCompare(a.reqId),
  )[0];
  if (!latest) return { kind: "NONE", viewUntil: null };
  if (latest.status === "APPROVED") return { kind: "EXPIRED", viewUntil: latest.viewUntil };
  return { kind: latest.status, viewUntil: null };
}

/** 새 요청을 막는 이유 (없으면 요청 가능) */
export function requestBlockReason(reqs: AccessReqLite[], today: Date): string | null {
  if (reqs.some((r) => r.status === "PENDING")) return "이미 처리 대기 중인 열람 요청이 있습니다.";
  if (reqs.some((r) => isViewing(r, today))) return "이미 열람 중입니다. 열람 기간이 끝난 뒤 다시 요청하세요.";
  return null;
}
