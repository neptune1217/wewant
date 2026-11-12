"use server";

/** 위원회 내 직위명(TB_Ap_Position) 관리 — 총괄 전용 */
import { revalidatePath } from "next/cache";
import { AuditAction } from "@/generated/prisma/enums";
import { adminAction, fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { formToObject, PositionSchema } from "@/lib/validation/master";

const PATH = "/admin/positions";
const TABLE = "TB_Ap_Position";

export async function createPosition(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return adminAction(async (actor) => {
    const parsed = PositionSchema.safeParse(formToObject(formData));
    if (!parsed.success) return fromZodError(parsed.error);

    const dup = await prisma.tB_Ap_Position.findUnique({ where: { appos_name: parsed.data.appos_name } });
    if (dup) return fail("이미 등록된 직위명입니다.", { appos_name: "이미 등록된 직위명입니다." });

    await prisma.$transaction(async (tx) => {
      const created = await tx.tB_Ap_Position.create({ data: parsed.data });
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.CREATE,
        table: TABLE,
        targetId: created.appos_id,
        after: created,
      });
    });
    revalidatePath(PATH);
    return ok("직위명을 등록했습니다.");
  });
}

export async function updatePosition(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return adminAction(async (actor) => {
    const id = String(formData.get("id") ?? "");
    const parsed = PositionSchema.safeParse(formToObject(formData));
    if (!parsed.success) return fromZodError(parsed.error);

    const before = await prisma.tB_Ap_Position.findUnique({ where: { appos_id: id } });
    if (!before) return fail("직위명을 찾을 수 없습니다.");
    const dup = await prisma.tB_Ap_Position.findFirst({
      where: { appos_name: parsed.data.appos_name, NOT: { appos_id: id } },
    });
    if (dup) return fail("이미 등록된 직위명입니다.", { appos_name: "이미 등록된 직위명입니다." });

    await prisma.$transaction(async (tx) => {
      const after = await tx.tB_Ap_Position.update({ where: { appos_id: id }, data: parsed.data });
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.UPDATE,
        table: TABLE,
        targetId: id,
        before,
        after,
      });
    });
    revalidatePath(PATH);
    return ok("직위명을 수정했습니다.");
  });
}

/** 비활성화(삭제 대신) 또는 다시 활성화. 기존 위촉 건의 표시는 그대로 유지된다. */
export async function setPositionActive(id: string, active: boolean): Promise<ActionResult> {
  return adminAction(async (actor) => {
    const before = await prisma.tB_Ap_Position.findUnique({ where: { appos_id: id } });
    if (!before) return fail("직위명을 찾을 수 없습니다.");
    if (before.appos_activ === active) return ok("이미 반영되어 있습니다.");

    await prisma.$transaction(async (tx) => {
      const after = await tx.tB_Ap_Position.update({
        where: { appos_id: id },
        data: { appos_activ: active },
      });
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
    revalidatePath(PATH);
    return ok(active ? "다시 활성화했습니다." : "비활성화했습니다.");
  });
}
