/**
 * 중복위촉 규칙 (순수 함수, DB와 무관)
 *
 * 위촉직 건수 = 그 인물이 "지금 재임 중인 위촉직"을 가진 집계 대상 위원회(활성+승인) 수.
 * - 당연직, 해촉된 건, 승인 대기·비활성 위원회는 세지 않는다
 * - 동명이인은 인물 고유코드(person_id)로 구분한다
 * - 입력은 막지 않고 경고만 한다 (CLAUDE.md 규칙 6)
 */
import { isCountedComm } from "./comm-rules";

export type DupAppoint = {
  personId: string;
  commId: string;
  type: "EX_OFFICIO" | "APPOINTED";
  /** 재임 중 (appoint_activ) */
  active: boolean;
  commActive: boolean;
  commApproved: boolean;
};

/** 경고 아이콘 기준: 위촉직 4개 이상 (조례상 3개까지가 원칙) */
export const DUP_WARN_THRESHOLD = 4;

/** 이 위촉 건이 중복위촉 건수에 들어가는지 */
export function isCountedDupAppoint(a: DupAppoint): boolean {
  return a.active && a.type === "APPOINTED" && isCountedComm({ active: a.commActive, approved: a.commApproved });
}

/** 인물의 위촉직 건수 (같은 위원회는 한 번만) */
export function appointedCommCount(appoints: DupAppoint[], personId: string): number {
  const comms = new Set<string>();
  for (const a of appoints) {
    if (a.personId === personId && isCountedDupAppoint(a)) comms.add(a.commId);
  }
  return comms.size;
}

/** 경고 아이콘을 보일지 */
export function isDuplicateWarn(count: number): boolean {
  return count >= DUP_WARN_THRESHOLD;
}

/** 아이콘 설명 첫 줄 */
export function dupIconLabel(count: number): string {
  return `위촉직 ${count}개 위원회 중복 위촉`;
}

/**
 * 신규 위촉 저장 전 경고 — 이번 위촉으로 위촉직이 4개 이상이 되면 (당연직 위촉은 경고 없음)
 * @param currentCount 지금 위촉직 건수 (이번 위원회는 아직 재임 중이 아님)
 */
export function newAppointDupWarning(currentCount: number, appointType: DupAppoint["type"]): string | null {
  if (appointType !== "APPOINTED") return null;
  const next = currentCount + 1;
  if (!isDuplicateWarn(next)) return null;
  return `이 위촉으로 위촉직이 ${next}개가 됩니다(조례상 3개까지가 원칙).`;
}
