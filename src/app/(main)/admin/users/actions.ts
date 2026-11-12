"use server";

/** 사용자(TB_User) 관리 — 총괄 전용. 계정 발급·수정·활성/비활성·비밀번호 초기화 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";
import { AuditAction } from "@/generated/prisma/enums";
import { adminAction, fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { AUTH_ADMIN } from "@/lib/permissions";
import { checkUserChange } from "@/lib/rules/master-rules";
import { generateTempPassword } from "@/lib/temp-password";
import { formToObject, UserSchema } from "@/lib/validation/master";

const PATH = "/admin/users";
const TABLE = "TB_User";

/** 화면에 한 번만 보여 줄 임시 비밀번호 */
export type TempPasswordResult = { loginId: string; userName: string; tempPassword: string };

/** 이력에 남길 사용자 필드 (비밀번호·이메일 제외) */
function auditRow(u: {
  login_id: string;
  user_name: string;
  dept_id: string;
  phone: string;
  auth_id: string;
  user_activ: boolean;
  must_change_pw: boolean;
}) {
  return {
    login_id: u.login_id,
    user_name: u.user_name,
    dept_id: u.dept_id,
    phone: u.phone,
    auth_id: u.auth_id,
    user_activ: u.user_activ,
    must_change_pw: u.must_change_pw,
  };
}

const activeAdminCount = () =>
  prisma.tB_User.count({ where: { auth_id: AUTH_ADMIN, user_activ: true } });

async function activeDeptError(deptId: string, currentDeptId?: string): Promise<string | null> {
  const dept = await prisma.tB_Dept.findUnique({ where: { dept_id: deptId } });
  if (!dept) return "부서를 찾을 수 없습니다.";
  // 이미 소속된 부서는 비활성이어도 그대로 둘 수 있다
  if (!dept.dept_activ && deptId !== currentDeptId) return "비활성 부서는 고를 수 없습니다.";
  return null;
}

/** 계정 발급: 임시 비밀번호를 만들어 한 번만 돌려준다. 첫 로그인 때 변경을 강제한다. */
export async function createUser(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<TempPasswordResult>> {
  return adminAction(async (actor) => {
    const parsed = UserSchema.safeParse(formToObject(formData));
    if (!parsed.success) return fromZodError(parsed.error);
    const input = parsed.data;

    if (await prisma.tB_User.findUnique({ where: { login_id: input.login_id } })) {
      return fail("이미 사용 중인 아이디입니다.", { login_id: "이미 사용 중인 아이디입니다." });
    }
    const deptError = await activeDeptError(input.dept_id);
    if (deptError) return fail(deptError, { dept_id: deptError });

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    await prisma.$transaction(async (tx) => {
      const user = await tx.tB_User.create({
        data: {
          ...input,
          email: `${input.login_id}@wewant.local`, // Better Auth 필수값 (내부용)
          must_change_pw: true,
        },
      });
      await tx.tB_Account.create({
        data: {
          id: randomUUID(),
          account_id: user.id,
          provider_id: "credential",
          user_id: user.id,
          password: passwordHash,
        },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.CREATE,
        table: TABLE,
        targetId: user.id,
        after: auditRow(user),
      });
    });
    revalidatePath(PATH);
    return ok("사용자를 등록했습니다.", {
      loginId: input.login_id,
      userName: input.user_name,
      tempPassword,
    });
  });
}

/** 이름·부서·내선·권한 수정 (아이디는 바꾸지 않는다) */
export async function updateUser(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return adminAction(async (actor) => {
    const id = String(formData.get("id") ?? "");
    const before = await prisma.tB_User.findUnique({ where: { id } });
    if (!before) return fail("사용자를 찾을 수 없습니다.");

    // 아이디는 수정 대상이 아니므로 기존 값으로 검사한다
    const parsed = UserSchema.safeParse({ ...formToObject(formData), login_id: before.login_id });
    if (!parsed.success) return fromZodError(parsed.error);
    const { login_id: _loginId, ...input } = parsed.data;

    const guard = checkUserChange(
      actor,
      { userId: before.id, authId: before.auth_id, active: before.user_activ },
      { newAuthId: input.auth_id, newActive: before.user_activ },
      await activeAdminCount(),
    );
    if (guard) return fail(guard, { auth_id: guard });
    const deptError = await activeDeptError(input.dept_id, before.dept_id);
    if (deptError) return fail(deptError, { dept_id: deptError });

    await prisma.$transaction(async (tx) => {
      const after = await tx.tB_User.update({ where: { id }, data: input });
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.UPDATE,
        table: TABLE,
        targetId: id,
        before: auditRow(before),
        after: auditRow(after),
      });
    });
    revalidatePath(PATH);
    return ok("사용자 정보를 수정했습니다.");
  });
}

/** 비활성화(삭제 대신) 또는 다시 활성화. 비활성화하면 로그인 중인 세션도 끊는다. */
export async function setUserActive(id: string, active: boolean): Promise<ActionResult> {
  return adminAction(async (actor) => {
    const before = await prisma.tB_User.findUnique({ where: { id }, include: { dept: true } });
    if (!before) return fail("사용자를 찾을 수 없습니다.");
    if (before.user_activ === active) return ok("이미 반영되어 있습니다.");

    const guard = checkUserChange(
      actor,
      { userId: before.id, authId: before.auth_id, active: before.user_activ },
      { newAuthId: before.auth_id, newActive: active },
      await activeAdminCount(),
    );
    if (guard) return fail(guard);
    if (active && !before.dept.dept_activ) {
      return fail(`소속 부서(${before.dept.dept_name})가 비활성입니다. 부서를 먼저 바꾸세요.`);
    }

    await prisma.$transaction(async (tx) => {
      const after = await tx.tB_User.update({ where: { id }, data: { user_activ: active } });
      if (!active) await tx.tB_Session.deleteMany({ where: { user_id: id } });
      await writeAudit(tx, {
        userId: actor.userId,
        action: active ? AuditAction.UPDATE : AuditAction.DELETE,
        table: TABLE,
        targetId: id,
        before: auditRow(before),
        after: auditRow(after),
        note: active ? "다시 활성화" : "비활성화 (로그인 세션 종료)",
      });
    });
    revalidatePath(PATH);
    return ok(active ? "다시 활성화했습니다." : "비활성화했습니다.");
  });
}

/** 비밀번호 초기화: 새 임시 비밀번호를 한 번만 돌려주고, 기존 로그인을 모두 끊는다. */
export async function resetUserPassword(id: string): Promise<ActionResult<TempPasswordResult>> {
  return adminAction(async (actor) => {
    const before = await prisma.tB_User.findUnique({ where: { id } });
    if (!before) return fail("사용자를 찾을 수 없습니다.");
    if (before.id === actor.userId) {
      return fail("본인 비밀번호는 사용자정보 탭의 '비밀번호 변경'에서 바꾸세요.");
    }
    if (!before.user_activ) return fail("비활성 사용자입니다. 먼저 다시 활성화하세요.");

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    await prisma.$transaction(async (tx) => {
      const credential = await tx.tB_Account.findFirst({
        where: { user_id: id, provider_id: "credential" },
      });
      if (credential) {
        await tx.tB_Account.update({ where: { id: credential.id }, data: { password: passwordHash } });
      } else {
        await tx.tB_Account.create({
          data: {
            id: randomUUID(),
            account_id: id,
            provider_id: "credential",
            user_id: id,
            password: passwordHash,
          },
        });
      }
      const after = await tx.tB_User.update({ where: { id }, data: { must_change_pw: true } });
      await tx.tB_Session.deleteMany({ where: { user_id: id } });
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.UPDATE,
        table: TABLE,
        targetId: id,
        before: auditRow(before),
        after: auditRow(after),
        note: "비밀번호 초기화 (로그인 세션 종료)",
      });
    });
    revalidatePath(PATH);
    return ok("비밀번호를 초기화했습니다.", {
      loginId: before.login_id,
      userName: before.user_name,
      tempPassword,
    });
  });
}
