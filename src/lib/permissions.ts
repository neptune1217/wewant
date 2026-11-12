/**
 * 권한 관문 — 모든 Server Action·Route Handler·화면은 이 파일을 거친다. (CLAUDE.md 규칙 1)
 *
 * - requireUser(): 로그인 세션 확인 → 현재 사용자 반환. 없으면 로그인 화면으로 보낸다.
 * - requireAdmin(): 총괄(r01)만 통과.
 * - assertPermission(): 판정 결과가 false면 PermissionError를 던진다.
 * - 판정 규칙(canEditComm 등)은 rules/permission-rules.ts의 순수 함수를 그대로 다시 내보낸다.
 */
import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin, type Actor } from "@/lib/rules/permission-rules";

export * from "@/lib/rules/permission-rules";

/** 권한이 없을 때 던지는 오류. 화면에는 message를 그대로 보여 줘도 된다. */
export class PermissionError extends Error {
  constructor(message = "이 작업을 할 권한이 없습니다.") {
    super(message);
    this.name = "PermissionError";
  }
}

export type CurrentUser = Actor & {
  loginId: string;
  name: string;
  deptId: string;
  deptName: string;
  authName: string;
  phone: string;
  mustChangePw: boolean;
  lastLoginAt: Date | null;
};

/**
 * 세션에서 현재 사용자를 읽는다 (한 요청 안에서는 한 번만 DB 조회).
 * 세션이 없거나 사용자가 없으면 null. 비활성 사용자는 세션을 모두 지우고 null.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = await prisma.tB_User.findUnique({
    where: { id: session.user.id },
    include: { dept: true, auth: true },
  });
  if (!user) return null;

  if (!user.user_activ) {
    // 로그인 중에 비활성화된 경우: 남은 세션을 모두 끊는다
    await prisma.tB_Session.deleteMany({ where: { user_id: user.id } });
    return null;
  }

  return {
    userId: user.id,
    authId: user.auth_id,
    active: user.user_activ,
    loginId: user.login_id,
    name: user.user_name,
    deptId: user.dept_id,
    deptName: user.dept.dept_name,
    authName: user.auth.auth_name,
    phone: user.phone,
    mustChangePw: user.must_change_pw,
    lastLoginAt: user.last_login_at,
  };
});

/**
 * 로그인한 사용자만 통과. 아니면 로그인 화면으로 이동.
 * 최초 비밀번호를 아직 바꾸지 않았으면 비밀번호 변경 화면으로 이동한다.
 * (비밀번호 변경 화면 자신은 allowPendingPasswordChange: true로 호출)
 */
export async function requireUser(
  options: { allowPendingPasswordChange?: boolean } = {},
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePw && !options.allowPendingPasswordChange) redirect("/change-password");
  return user;
}

/** 총괄(r01)만 통과. 부서 계정이면 PermissionError. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isAdmin(user)) throw new PermissionError("총괄담당자만 할 수 있습니다.");
  return user;
}

/** 권한 판정 결과가 false면 PermissionError를 던진다. */
export function assertPermission(allowed: boolean, message?: string): asserts allowed {
  if (!allowed) throw new PermissionError(message);
}
