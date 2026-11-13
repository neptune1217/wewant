/**
 * 위촉(TB_Appoint) 규칙 (순수 함수, DB와 무관)
 *
 * 연임횟수는 "최초 임기를 뺀, 연임으로 추가된 임기 수"다.
 * 예) 임기 2년: 2026-01-01~2027-12-31(최초) → 2028-01-01~2029-12-31(연임 1회) → 2030-01-01~2031-12-31(연임 2회)
 * 따라서 appoint_kind = 연임인 위촉직 건만 센다. 직위변경으로 나뉜 건·보궐·당연직은 세지 않는다.
 */
import { checkDateOrder } from "./term";

export type AppointLite = {
  appointId: string;
  commId: string;
  personId: string;
  apposId: string;
  type: "EX_OFFICIO" | "APPOINTED";
  kind: "NEW" | "REAPPOINT" | "BY_ELECT" | "POS_CHANGE";
  start: Date;
  /** 실제 해촉(종료)일. 재임 중이면 null */
  end: Date | null;
  active: boolean;
};

/** 같은 위원회·같은 인물의 연임횟수 */
export function reappointCount(appoints: AppointLite[], commId: string, personId: string): number {
  return appoints.filter(
    (a) => a.commId === commId && a.personId === personId && a.type === "APPOINTED" && a.kind === "REAPPOINT",
  ).length;
}

/**
 * 이번 연임이 연임 가능횟수를 넘는지 (넘어도 저장은 허용, 경고만)
 * @param countSoFar 지금까지의 연임횟수
 * @param reappointNum 위원회의 연임 가능횟수 (0 = 연임 불가)
 */
export function reappointWarning(countSoFar: number, reappointNum: number): string | null {
  if (reappointNum === 0) return "연임할 수 없는 위원회입니다(연임 가능횟수 0회).";
  if (countSoFar >= reappointNum) {
    return `연임 가능횟수(${reappointNum}회)를 넘습니다. 이번이 ${countSoFar + 1}번째 연임입니다.`;
  }
  return null;
}

/** 한 명 더 위촉하면 정원을 넘는지 (넘어도 저장은 허용, 경고만) */
export function capacityWarning(currentCount: number, memberCap: number): string | null {
  if (currentCount + 1 > memberCap) {
    return `정원 ${memberCap}명을 넘습니다. 이번 위촉으로 ${currentCount + 1}명이 됩니다.`;
  }
  return null;
}

/** 같은 위원회에 같은 인물이 이미 재임 중인지 (excludeId: 지금 처리 중인 건은 제외) */
export function hasActiveInComm(
  appoints: AppointLite[],
  commId: string,
  personId: string,
  excludeId?: string,
): boolean {
  return appoints.some(
    (a) => a.commId === commId && a.personId === personId && a.active && a.appointId !== excludeId,
  );
}

/** 해촉일은 위촉일과 같거나 이후 */
export function checkDismissDate(start: Date, endDate: Date): string | null {
  return checkDateOrder(start, endDate) ? null : "해촉일은 위촉일과 같거나 이후여야 합니다.";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 직위별 재임기간(일) — 같은 위원회·같은 인물의 건을 위원회 내 직위별로 합산 (양 끝 날 포함).
 * 재임 중인 건은 오늘까지, 아직 시작 전이면 0일.
 */
export function tenureByPosition(
  appoints: AppointLite[],
  commId: string,
  personId: string,
  today: Date,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of appoints) {
    if (a.commId !== commId || a.personId !== personId) continue;
    const until = a.end ?? today;
    const days = until.getTime() < a.start.getTime() ? 0 : Math.round((until.getTime() - a.start.getTime()) / DAY_MS) + 1;
    out.set(a.apposId, (out.get(a.apposId) ?? 0) + days);
  }
  return out;
}

/** 소속직위 교체 후, 옛 행을 가리키는 위촉 건이 하나도 없으면 비활성화한다 */
export function shouldDeactivatePos(remainingRefCount: number): boolean {
  return remainingRefCount === 0;
}
