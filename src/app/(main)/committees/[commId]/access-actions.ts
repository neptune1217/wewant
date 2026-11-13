"use server";

/**
 * 열람 요청(TB_AccessReq) — 요청, 승인·거절
 * - 요청: 담당자·총괄이 아닌 활성 사용자 (canRequestAccess). 대기 중·열람 중이면 다시 요청할 수 없다
 * - 승인·거절: 위원회의 현재 담당자와 총괄 (canDecideAccess). 승인 시 열람 기간(일)을 정한다
 * - 열람 중에도 편집은 할 수 없다 (편집 판정은 canEditComm만 본다)
 */
import { revalidatePath } from "next/cache";
import { AuditAction, ReqStatus } from "@/generated/prisma/enums";
import { fail, fromZodError, ok, userAction, type ActionResult } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { assertPermission, canDecideAccess, canRequestAccess, todayKST } from "@/lib/permissions";
import { requestBlockReason, viewUntilDate } from "@/lib/rules/access-rules";
import { formatDate } from "@/lib/rules/term";
import { AccessDecideSchema, AccessRequestSchema } from "@/lib/validation/access";
import { formToObject } from "@/lib/validation/master";

const TABLE = "TB_AccessReq";

function refresh(commId: string) {
  revalidatePath("/");
  revalidatePath("/committees");
  revalidatePath(`/committees/${commId}`);
}

/** 열람 요청 */
export async function requestAccess(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return userAction(async (actor) => {
    const parsed = AccessRequestSchema.safeParse(formToObject(formData));
    if (!parsed.success) return fromZodError(parsed.error);
    const input = parsed.data;

    const comm = await prisma.tB_Comm.findUnique({ where: { comm_id: input.comm_id } });
    if (!comm) return fail("위원회를 찾을 수 없습니다.");
    assertPermission(
      canRequestAccess(actor, { mngUserId: comm.mng_user_id }),
      "담당자·총괄은 열람 요청 없이 볼 수 있습니다.",
    );

    const mine = await prisma.tB_AccessReq.findMany({
      where: { comm_id: comm.comm_id, req_user_id: actor.userId },
      select: { req_id: true, req_status: true, req_at: true, view_until: true },
    });
    const blocked = requestBlockReason(
      mine.map((r) => ({ reqId: r.req_id, status: r.req_status, reqAt: r.req_at, viewUntil: r.view_until })),
      todayKST(),
    );
    if (blocked) return fail(blocked);

    await prisma.$transaction(async (tx) => {
      const created = await tx.tB_AccessReq.create({
        data: { comm_id: comm.comm_id, req_user_id: actor.userId, req_reason: input.req_reason },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.CREATE,
        table: TABLE,
        targetId: created.req_id,
        after: created,
      });
    });
    refresh(comm.comm_id);
    return ok("열람을 요청했습니다. 담당자가 승인하면 열람할 수 있습니다.");
  });
}

/** 열람 요청 승인·거절 */
export async function decideAccess(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return userAction(async (actor) => {
    const parsed = AccessDecideSchema.safeParse(formToObject(formData));
    if (!parsed.success) return fromZodError(parsed.error);
    const input = parsed.data;

    const before = await prisma.tB_AccessReq.findUnique({
      where: { req_id: input.req_id },
      include: { comm: { select: { comm_id: true, mng_user_id: true } } },
    });
    if (!before) return fail("요청 건을 찾을 수 없습니다.");
    assertPermission(
      canDecideAccess(actor, { mngUserId: before.comm.mng_user_id }),
      "이 위원회의 담당자와 총괄만 처리할 수 있습니다.",
    );
    if (before.req_status !== ReqStatus.PENDING) return fail("이미 처리된 요청입니다.");

    const approve = input.decision === "APPROVE";
    const today = todayKST();
    const viewUntil = approve ? viewUntilDate(today, input.view_days!) : null;

    const done = await prisma.$transaction(async (tx) => {
      // 동시에 두 사람이 처리해도 한 번만 반영되도록 대기 상태일 때만 바꾼다
      const res = await tx.tB_AccessReq.updateMany({
        where: { req_id: before.req_id, req_status: ReqStatus.PENDING },
        data: {
          req_status: approve ? ReqStatus.APPROVED : ReqStatus.REJECTED,
          decided_by: actor.userId,
          decided_at: new Date(),
          view_days: approve ? input.view_days : null,
          view_until: viewUntil,
        },
      });
      if (res.count === 0) return false;
      const after = await tx.tB_AccessReq.findUnique({ where: { req_id: before.req_id } });
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.UPDATE,
        table: TABLE,
        targetId: before.req_id,
        before,
        after,
        note: approve ? "열람 승인" : "열람 거절",
      });
      return true;
    });
    if (!done) return fail("이미 처리된 요청입니다.");
    refresh(before.comm.comm_id);
    return ok(
      approve ? `승인했습니다. ${formatDate(viewUntil!)}까지 열람할 수 있습니다.` : "열람 요청을 거절했습니다.",
    );
  });
}
