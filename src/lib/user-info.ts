/**
 * 사용자 정보 화면용 데이터 (서버 전용) — /me 와 /users/[userId] 가 함께 쓴다.
 * 권한 확인(canViewUser)은 화면이 먼저 하고 나서 부른다.
 * 이력은 일시·동작·대상·대상 코드만 꺼낸다(바뀐 값은 개인 정보가 있을 수 있어 보여 주지 않음).
 */
import "server-only";
import { prisma } from "@/lib/db";
import { AUDIT_ACTION_LABEL } from "@/lib/enum-labels";
import { commStatus, COMM_STATUS_LABEL } from "@/lib/rules/comm-rules";

const TABLE_LABEL: Record<string, string> = {
  TB_Comm: "위원회",
  TB_Appoint: "위촉",
  TB_Person: "인물",
  TB_Pos: "소속직위",
  TB_User: "사용자",
  TB_Dept: "부서",
  TB_Ap_Position: "위원회 직위명",
  TB_AccessReq: "열람 요청",
};

const kst = (d: Date) => d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

export type UserProfile = {
  userId: string;
  loginId: string;
  name: string;
  deptName: string;
  authName: string;
  phone: string;
  active: boolean;
  mustChangePw: boolean;
  lastLoginAt: string | null;
};

export async function loadUserProfile(userId: string): Promise<UserProfile | null> {
  const u = await prisma.tB_User.findUnique({
    where: { id: userId },
    include: { dept: { include: { parent: true } }, auth: true },
  });
  if (!u) return null;
  return {
    userId: u.id,
    loginId: u.login_id,
    name: u.user_name,
    deptName: u.dept.parent ? `${u.dept.parent.dept_name} > ${u.dept.dept_name}` : u.dept.dept_name,
    authName: u.auth.auth_name,
    phone: u.phone,
    active: u.user_activ,
    mustChangePw: u.must_change_pw,
    lastLoginAt: u.last_login_at ? kst(u.last_login_at) : null,
  };
}

export type ManagedComm = { commId: string; commName: string; statusLabel: string; memberCount: number; memberCap: number };

/** 그 사용자가 담당자(mng_user_id)인 위원회 — 비활성 위원회도 포함 */
export async function loadManagedComms(userId: string): Promise<ManagedComm[]> {
  const comms = await prisma.tB_Comm.findMany({
    where: { mng_user_id: userId },
    select: {
      comm_id: true,
      comm_name: true,
      comm_activ: true,
      comm_approved: true,
      member_cap: true,
      _count: { select: { appoints: { where: { appoint_activ: true } } } },
    },
    orderBy: [{ comm_activ: "desc" }, { comm_name: "asc" }],
  });
  return comms.map((c) => ({
    commId: c.comm_id,
    commName: c.comm_name,
    statusLabel: COMM_STATUS_LABEL[commStatus({ active: c.comm_activ, approved: c.comm_approved })],
    memberCount: c._count.appoints,
    memberCap: c.member_cap,
  }));
}

export type ActivityRow = { logId: number; at: string; action: string; target: string; targetId: string };

/** 그 사용자가 한 일(최근 순) */
export async function loadRecentActivity(userId: string, take = 20): Promise<ActivityRow[]> {
  const logs = await prisma.tB_AuditLog.findMany({
    where: { user_id: userId },
    select: { log_id: true, logged_at: true, action: true, target_table: true, target_id: true },
    orderBy: { log_id: "desc" },
    take,
  });
  return logs.map((l) => ({
    logId: l.log_id,
    at: kst(l.logged_at),
    action: AUDIT_ACTION_LABEL[l.action],
    target: TABLE_LABEL[l.target_table] ?? l.target_table,
    targetId: l.target_id,
  }));
}
