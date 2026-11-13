"use server";

/**
 * 위원회(TB_Comm) 등록·수정·비활성화·승인
 * - 편집은 담당자 본인과 총괄만 (서버에서 checkCommUpdate / canEditComm으로 판정)
 * - 부서 계정이 등록하면 승인 대기, 총괄이 승인
 * - 담당자 변경은 총괄만
 */
import { revalidatePath } from "next/cache";
import { AuditAction } from "@/generated/prisma/enums";
import { adminAction, fail, fromZodError, ok, userAction, type ActionResult } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { assertPermission, canEditComm } from "@/lib/permissions";
import { approvedOnCreate, checkCommCreate, checkCommUpdate } from "@/lib/rules/comm-rules";
import { CommSchema, type CommInput } from "@/lib/validation/comm";
import { formToObject } from "@/lib/validation/master";

const TABLE = "TB_Comm";

function refresh(commId?: string) {
  revalidatePath("/committees");
  if (commId) revalidatePath(`/committees/${commId}`);
}

/** 소관부서·담당자가 활성인지 확인 (기존 값은 비활성이어도 그대로 둘 수 있다) */
async function referenceErrors(
  input: CommInput,
  current?: { dept_id: string; mng_user_id: string },
): Promise<Record<string, string> | null> {
  const [dept, mng] = await Promise.all([
    prisma.tB_Dept.findUnique({ where: { dept_id: input.dept_id } }),
    prisma.tB_User.findUnique({ where: { id: input.mng_user_id } }),
  ]);
  const errors: Record<string, string> = {};
  if (!dept) errors.dept_id = "소관부서를 찾을 수 없습니다.";
  else if (!dept.dept_activ && input.dept_id !== current?.dept_id) errors.dept_id = "비활성 부서는 고를 수 없습니다.";
  if (!mng) errors.mng_user_id = "담당자를 찾을 수 없습니다.";
  else if (!mng.user_activ && input.mng_user_id !== current?.mng_user_id) {
    errors.mng_user_id = "비활성 사용자는 담당자로 지정할 수 없습니다.";
  }
  return Object.keys(errors).length ? errors : null;
}

/** 위원회 등록. 부서 계정은 본인만 담당자로, 승인 대기로 등록된다. */
export async function createComm(_prev: unknown, formData: FormData): Promise<ActionResult<{ commId: string }>> {
  return userAction(async (actor) => {
    const parsed = CommSchema.safeParse(formToObject(formData));
    if (!parsed.success) return fromZodError(parsed.error);
    const input = parsed.data;

    const denied = checkCommCreate(actor, { mngUserId: input.mng_user_id });
    if (denied) return fail(denied);
    const refErrors = await referenceErrors(input);
    if (refErrors) return fail("입력값을 확인하세요.", refErrors);

    const approved = approvedOnCreate(actor);
    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.tB_Comm.create({
        data: {
          ...input,
          comm_approved: approved,
          approved_by: approved ? actor.userId : null,
          approved_at: approved ? new Date() : null,
        },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.CREATE,
        table: TABLE,
        targetId: c.comm_id,
        after: c,
      });
      return c;
    });
    refresh();
    return ok(
      approved ? "위원회를 등록했습니다." : "위원회를 등록했습니다. 총괄담당자가 승인하면 통계 등에 포함됩니다.",
      { commId: created.comm_id },
    );
  });
}

/** 위원회 수정. 담당자 본인과 총괄만, 담당자 변경은 총괄만. */
export async function updateComm(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return userAction(async (actor) => {
    const id = String(formData.get("id") ?? "");
    const before = await prisma.tB_Comm.findUnique({ where: { comm_id: id } });
    if (!before) return fail("위원회를 찾을 수 없습니다.");

    const parsed = CommSchema.safeParse(formToObject(formData));
    if (!parsed.success) return fromZodError(parsed.error);
    const input = parsed.data;

    const denied = checkCommUpdate(actor, { mngUserId: before.mng_user_id }, { mngUserId: input.mng_user_id });
    if (denied) return fail(denied);
    const refErrors = await referenceErrors(input, before);
    if (refErrors) return fail("입력값을 확인하세요.", refErrors);

    await prisma.$transaction(async (tx) => {
      const after = await tx.tB_Comm.update({ where: { comm_id: id }, data: input });
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.UPDATE,
        table: TABLE,
        targetId: id,
        before,
        after,
        ...(before.mng_user_id !== after.mng_user_id ? { note: "담당자 변경" } : {}),
      });
    });
    refresh(id);
    return ok("위원회 정보를 수정했습니다.");
  });
}

/** 비활성화(폐지, 삭제 대신) 또는 다시 활성화. 재임 중 위원이 있어도 막지 않는다(집계에서 빠짐). */
export async function setCommActive(id: string, active: boolean): Promise<ActionResult> {
  return userAction(async (actor) => {
    const before = await prisma.tB_Comm.findUnique({ where: { comm_id: id } });
    if (!before) return fail("위원회를 찾을 수 없습니다.");
    assertPermission(canEditComm(actor, { mngUserId: before.mng_user_id }), "이 위원회를 수정할 권한이 없습니다.");
    if (before.comm_activ === active) return ok("이미 반영되어 있습니다.");

    await prisma.$transaction(async (tx) => {
      const after = await tx.tB_Comm.update({ where: { comm_id: id }, data: { comm_activ: active } });
      await writeAudit(tx, {
        userId: actor.userId,
        action: active ? AuditAction.UPDATE : AuditAction.DELETE,
        table: TABLE,
        targetId: id,
        before,
        after,
        note: active ? "다시 활성화" : "비활성화",
      });
    });
    refresh(id);
    return ok(active ? "다시 활성화했습니다." : "비활성화했습니다.");
  });
}

/** 승인 대기 위원회 승인 — 총괄만 */
export async function approveComm(id: string): Promise<ActionResult> {
  return adminAction(async (actor) => {
    const before = await prisma.tB_Comm.findUnique({ where: { comm_id: id } });
    if (!before) return fail("위원회를 찾을 수 없습니다.");
    if (before.comm_approved) return ok("이미 승인된 위원회입니다.");

    await prisma.$transaction(async (tx) => {
      const after = await tx.tB_Comm.update({
        where: { comm_id: id },
        data: { comm_approved: true, approved_by: actor.userId, approved_at: new Date() },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.UPDATE,
        table: TABLE,
        targetId: id,
        before,
        after,
        note: "승인",
      });
    });
    refresh(id);
    return ok("위원회를 승인했습니다. 이제 통계 등에 포함됩니다.");
  });
}
