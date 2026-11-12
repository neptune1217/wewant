"use server";

/** 부서(TB_Dept, 국소–부서 계층) 관리 — 총괄 전용 */
import { revalidatePath } from "next/cache";
import { AuditAction } from "@/generated/prisma/enums";
import { adminAction, fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { checkDeptHierarchy, deptDeactivationBlockers } from "@/lib/rules/master-rules";
import { DeptSchema, formToObject, type DeptInput } from "@/lib/validation/master";

const PATH = "/admin/depts";
const TABLE = "TB_Dept";

/** 상위 부서 정보를 읽어 계층 규칙을 검사한다 */
async function hierarchyError(input: DeptInput, selfId?: string): Promise<string | null> {
  const parent = input.parentdept_id
    ? await prisma.tB_Dept.findUnique({ where: { dept_id: input.parentdept_id } })
    : null;
  if (input.parentdept_id && !parent) return "상위 부서를 찾을 수 없습니다.";
  const activeChildCount = selfId
    ? await prisma.tB_Dept.count({ where: { parentdept_id: selfId, dept_activ: true } })
    : 0;
  return checkDeptHierarchy({
    selfId,
    deptType: input.dept_type,
    parent: parent
      ? { deptId: parent.dept_id, deptType: parent.dept_type, active: parent.dept_activ }
      : null,
    activeChildCount,
  });
}

export async function createDept(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return adminAction(async (actor) => {
    const parsed = DeptSchema.safeParse(formToObject(formData));
    if (!parsed.success) return fromZodError(parsed.error);
    const error = await hierarchyError(parsed.data);
    if (error) return fail(error, { parentdept_id: error });

    await prisma.$transaction(async (tx) => {
      const created = await tx.tB_Dept.create({ data: parsed.data });
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.CREATE,
        table: TABLE,
        targetId: created.dept_id,
        after: created,
      });
    });
    revalidatePath(PATH);
    return ok("부서를 등록했습니다.");
  });
}

export async function updateDept(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return adminAction(async (actor) => {
    const id = String(formData.get("id") ?? "");
    const parsed = DeptSchema.safeParse(formToObject(formData));
    if (!parsed.success) return fromZodError(parsed.error);

    const before = await prisma.tB_Dept.findUnique({ where: { dept_id: id } });
    if (!before) return fail("부서를 찾을 수 없습니다.");
    const error = await hierarchyError(parsed.data, id);
    if (error) return fail(error, { parentdept_id: error });

    await prisma.$transaction(async (tx) => {
      const after = await tx.tB_Dept.update({ where: { dept_id: id }, data: parsed.data });
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
    return ok("부서를 수정했습니다.");
  });
}

/** 비활성화(삭제 대신) 또는 다시 활성화 */
export async function setDeptActive(id: string, active: boolean): Promise<ActionResult> {
  return adminAction(async (actor) => {
    const before = await prisma.tB_Dept.findUnique({
      where: { dept_id: id },
      include: { parent: true },
    });
    if (!before) return fail("부서를 찾을 수 없습니다.");
    if (before.dept_activ === active) return ok("이미 반영되어 있습니다.");

    if (!active) {
      const [activeChildren, activeUsers, activeComms] = await Promise.all([
        prisma.tB_Dept.count({ where: { parentdept_id: id, dept_activ: true } }),
        prisma.tB_User.count({ where: { dept_id: id, user_activ: true } }),
        prisma.tB_Comm.count({ where: { dept_id: id, comm_activ: true } }),
      ]);
      const reasons = deptDeactivationBlockers({ activeChildren, activeUsers, activeComms });
      if (reasons.length > 0) {
        return fail(`비활성화할 수 없습니다. 먼저 정리할 항목: ${reasons.join(", ")}`);
      }
    } else if (before.parent && !before.parent.dept_activ) {
      return fail(`상위 국소(${before.parent.dept_name})가 비활성입니다. 상위 국소를 먼저 활성화하거나 바꾸세요.`);
    }

    await prisma.$transaction(async (tx) => {
      const after = await tx.tB_Dept.update({ where: { dept_id: id }, data: { dept_activ: active } });
      const { parent: _parent, ...beforeRow } = before;
      await writeAudit(tx, {
        userId: actor.userId,
        action: active ? AuditAction.UPDATE : AuditAction.DELETE,
        table: TABLE,
        targetId: id,
        before: beforeRow,
        after,
        note: active ? "다시 활성화" : "비활성화",
      });
    });
    revalidatePath(PATH);
    return ok(active ? "다시 활성화했습니다." : "비활성화했습니다.");
  });
}
