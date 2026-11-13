/**
 * 홈 대시보드 데이터 (서버 전용). 계산 규칙은 `rules/dashboard-rules.ts`.
 *
 * 보는 범위: 부서 계정은 본인 담당 위원회, 총괄은 전체 위원회 (둘 다 활성 위원회만).
 * - 위원회별 요약: 승인 대기 위원회도 목록에는 보이지만, 합계는 집계 대상(활성+승인)만 센다
 * - 임기만료 알림: 범위 안 위원회의 재임 중 위촉직 (승인 대기 위원회 포함 — 할 일이므로)
 */
import "server-only";
import { prisma } from "@/lib/db";
import { isAdmin, todayKST, type CurrentUser } from "@/lib/permissions";
import { isCountedComm } from "@/lib/rules/comm-rules";
import { expiryAlerts, memberRatios, type ExpiryLevel, type Ratios } from "@/lib/rules/dashboard-rules";
import { formatDate } from "@/lib/rules/term";

export type CommSummary = {
  commId: string;
  commName: string;
  approved: boolean;
  memberCap: number;
  ratios: Ratios;
};

export type ExpiryAlertRow = {
  appointId: string;
  commId: string;
  commName: string;
  name: string;
  apposName: string;
  expireDue: string;
  dday: number;
  level: ExpiryLevel;
};

export type Dashboard = {
  scopeLabel: string;
  comms: CommSummary[];
  /** 집계 대상 위원회만 합친 값 */
  total: { commCount: number; memberCap: number; ratios: Ratios };
  alerts: ExpiryAlertRow[];
};

export async function loadDashboard(user: CurrentUser): Promise<Dashboard> {
  const today = todayKST();
  const comms = await prisma.tB_Comm.findMany({
    where: { comm_activ: true, ...(isAdmin(user) ? {} : { mng_user_id: user.userId }) },
    select: {
      comm_id: true,
      comm_name: true,
      comm_activ: true,
      comm_approved: true,
      member_cap: true,
      appoints: {
        where: { appoint_activ: true },
        select: {
          appoint_id: true,
          appoint_type: true,
          appoint_activ: true,
          expire_due: true,
          appos: { select: { appos_name: true } },
          pos: { select: { person: { select: { person_name: true, person_gender: true, is_public: true } } } },
        },
      },
    },
    orderBy: { comm_name: "asc" },
  });

  const summaries: CommSummary[] = comms.map((c) => ({
    commId: c.comm_id,
    commName: c.comm_name,
    approved: c.comm_approved,
    memberCap: c.member_cap,
    ratios: memberRatios(
      c.appoints.map((a) => ({ gender: a.pos.person.person_gender, isPublic: a.pos.person.is_public })),
    ),
  }));

  const counted = comms.filter((c) => isCountedComm({ active: c.comm_activ, approved: c.comm_approved }));
  const total = {
    commCount: counted.length,
    memberCap: counted.reduce((s, c) => s + c.member_cap, 0),
    ratios: memberRatios(
      counted.flatMap((c) =>
        c.appoints.map((a) => ({ gender: a.pos.person.person_gender, isPublic: a.pos.person.is_public })),
      ),
    ),
  };

  const alerts = expiryAlerts(
    comms.flatMap((c) =>
      c.appoints.map((a) => ({
        appointId: a.appoint_id,
        type: a.appoint_type,
        active: a.appoint_activ,
        expireDue: a.expire_due,
        commId: c.comm_id,
        commName: c.comm_name,
        name: a.pos.person.person_name,
        apposName: a.appos.appos_name,
      })),
    ),
    today,
  ).map<ExpiryAlertRow>((a) => ({
    appointId: a.appointId,
    commId: a.commId,
    commName: a.commName,
    name: a.name,
    apposName: a.apposName,
    expireDue: formatDate(a.expireDue!),
    dday: a.dday,
    level: a.level,
  }));

  return {
    scopeLabel: isAdmin(user) ? "전체 위원회" : "내 담당 위원회",
    comms: summaries,
    total,
    alerts,
  };
}
