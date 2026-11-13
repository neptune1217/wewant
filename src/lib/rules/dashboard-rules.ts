/**
 * 홈 대시보드 규칙 (순수 함수, DB와 무관)
 *
 * - 임기만료 알림: 재임 중 위촉직 중 만료 예정일까지 0~60일 남은 건 + 만료일이 지났는데 해촉되지 않은 건
 *   (D-61은 안 보이고 D-60부터 보인다)
 * - 강조: 지남 / 7일 이하 / 30일 이하 / 60일 이하
 * - 구성 비율: 재임 중 위원(위촉 건) 기준 남·여, 공무원·민간
 */
import { dDay } from "./term";

export const ALERT_WINDOW_DAYS = 60;

export type ExpiryLevel = "OVERDUE" | "D7" | "D30" | "D60";

export type ExpiryCandidate = {
  appointId: string;
  type: "EX_OFFICIO" | "APPOINTED";
  active: boolean;
  expireDue: Date | null;
};

/** 남은 날수 → 강조 단계 (창 밖이면 null) */
export function expiryLevel(days: number): ExpiryLevel | null {
  if (days < 0) return "OVERDUE";
  if (days <= 7) return "D7";
  if (days <= 30) return "D30";
  if (days <= ALERT_WINDOW_DAYS) return "D60";
  return null;
}

/** 알림 대상만 골라 남은 날수·단계를 붙이고, 만료가 가까운 순(지난 건 먼저)으로 */
export function expiryAlerts<T extends ExpiryCandidate>(
  rows: T[],
  today: Date,
): (T & { dday: number; level: ExpiryLevel })[] {
  const out: (T & { dday: number; level: ExpiryLevel })[] = [];
  for (const r of rows) {
    if (!r.active || r.type !== "APPOINTED" || !r.expireDue) continue;
    const days = dDay(r.expireDue, today);
    const level = expiryLevel(days);
    if (level) out.push({ ...r, dday: days, level });
  }
  return out.sort((a, b) => a.dday - b.dday || a.appointId.localeCompare(b.appointId));
}

/** 백분율 (반올림 정수, 분모 0이면 0) */
export function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

export type Ratios = {
  total: number;
  male: number;
  female: number;
  public: number;
  private: number;
  malePct: number;
  femalePct: number;
  publicPct: number;
  privatePct: number;
};

/** 재임 중 위원(위촉 건) 목록 → 성별·공무원 구성 */
export function memberRatios(members: { gender: "MALE" | "FEMALE"; isPublic: boolean }[]): Ratios {
  const total = members.length;
  const male = members.filter((m) => m.gender === "MALE").length;
  const pub = members.filter((m) => m.isPublic).length;
  return {
    total,
    male,
    female: total - male,
    public: pub,
    private: total - pub,
    // 짝(남·여, 공무원·민간)은 합이 항상 100%가 되도록 한쪽을 100에서 뺀다
    malePct: percent(male, total),
    femalePct: total === 0 ? 0 : 100 - percent(male, total),
    publicPct: percent(pub, total),
    privatePct: total === 0 ? 0 : 100 - percent(pub, total),
  };
}
