"use server";

/**
 * 위촉(TB_Appoint) 업무 흐름 — 신규 위촉, 해촉, 연임, 위원회 내 직위 변경, 소속직위 변경
 * - 권한: 그 위원회의 담당자 본인과 총괄만 (canEditComm)
 * - 정원 초과·연임 가능횟수 초과는 경고만 하고, 확인하면 저장한다
 * - 소속직위 변경은 TB_Pos 행을 고치지 않고 위촉 건의 pos_id만 바꾼다 (데이터모델 "직위 변경 규칙")
 */
import { revalidatePath } from "next/cache";
import { AppointKind, AppointType, AuditAction, EndReason } from "@/generated/prisma/enums";
import { fail, fromZodError, needsConfirm, ok, userAction, type ActionResult } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { assertPermission, canEditComm } from "@/lib/permissions";
import {
  capacityWarning,
  checkDismissDate,
  reappointCount,
  reappointWarning,
  shouldDeactivatePos,
  type AppointLite,
} from "@/lib/rules/appoint-rules";
import { nextTermDates, positionChangeDates, resolveExpireDue } from "@/lib/rules/term";
import {
  ApposChangeSchema,
  DismissSchema,
  NewAppointSchema,
  PosChangeSchema,
  ReappointSchema,
} from "@/lib/validation/appoint";
import { formToObject } from "@/lib/validation/master";

const TABLE = "TB_Appoint";
const NO_PERMISSION = "이 위원회의 위원을 관리할 권한이 없습니다.";

const refresh = (commId: string) => {
  revalidatePath(`/committees/${commId}`);
  revalidatePath("/committees");
};

/** 위촉 건과 위원회·소속직위를 함께 읽는다 */
const loadAppoint = (appointId: string) =>
  prisma.tB_Appoint.findUnique({
    where: { appoint_id: appointId },
    include: { comm: true, pos: true },
  });

/** 같은 위원회·같은 인물의 위촉 건들 (연임횟수 계산용) */
async function personAppointsInComm(commId: string, personId: string): Promise<AppointLite[]> {
  const rows = await prisma.tB_Appoint.findMany({
    where: { comm_id: commId, pos: { person_id: personId } },
    include: { pos: { select: { person_id: true } } },
  });
  return rows.map((a) => ({
    appointId: a.appoint_id,
    commId: a.comm_id,
    personId: a.pos.person_id,
    apposId: a.appos_id,
    type: a.appoint_type,
    kind: a.appoint_kind,
    start: a.appoint_start,
    end: a.appoint_end,
    active: a.appoint_activ,
  }));
}

/** 신규 위촉 (신규 또는 보궐) */
export async function createAppoint(_prev: unknown, formData: FormData): Promise<ActionResult<{ appointId: string }>> {
  return userAction(async (actor) => {
    const parsed = NewAppointSchema.safeParse(formToObject(formData));
    if (!parsed.success) return fromZodError(parsed.error);
    const input = parsed.data;

    const comm = await prisma.tB_Comm.findUnique({ where: { comm_id: input.comm_id } });
    if (!comm) return fail("위원회를 찾을 수 없습니다.");
    assertPermission(canEditComm(actor, { mngUserId: comm.mng_user_id }), NO_PERMISSION);
    if (!comm.comm_activ) return fail("비활성 위원회에는 위촉할 수 없습니다.");

    const [pos, appos] = await Promise.all([
      prisma.tB_Pos.findUnique({ where: { pos_id: input.pos_id }, include: { person: true } }),
      prisma.tB_Ap_Position.findUnique({ where: { appos_id: input.appos_id } }),
    ]);
    if (!pos || !pos.pos_activ || !pos.person.person_activ) {
      return fail("사용할 수 없는 소속직위입니다.", { pos_id: "다시 고르세요." });
    }
    if (!appos || !appos.appos_activ) {
      return fail("사용할 수 없는 위원회 내 직위입니다.", { appos_id: "다시 고르세요." });
    }

    const already = await prisma.tB_Appoint.findFirst({
      where: { comm_id: comm.comm_id, appoint_activ: true, pos: { person_id: pos.person_id } },
    });
    if (already) return fail(`${pos.person.person_name} 님은 이미 이 위원회에 재임 중입니다.`);

    const expire = resolveExpireDue({
      appointType: input.appoint_type,
      start: input.appoint_start,
      termYr: comm.term_yr,
      manual: input.expire_due,
    });
    if ("error" in expire) return fail(expire.error, { expire_due: expire.error });

    const currentCount = await prisma.tB_Appoint.count({ where: { comm_id: comm.comm_id, appoint_activ: true } });
    const warnings = [capacityWarning(currentCount, comm.member_cap)].filter((w): w is string => !!w);
    if (warnings.length && !input.confirm_warnings) return needsConfirm(warnings);

    const created = await prisma.$transaction(async (tx) => {
      const a = await tx.tB_Appoint.create({
        data: {
          comm_id: comm.comm_id,
          pos_id: pos.pos_id,
          appos_id: appos.appos_id,
          appoint_type: input.appoint_type,
          appoint_kind: input.appoint_kind,
          appoint_start: input.appoint_start,
          expire_due: expire.expireDue,
          appoint_activ: true,
        },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.CREATE,
        table: TABLE,
        targetId: a.appoint_id,
        after: { ...a, person_id: pos.person_id, warnings },
      });
      return a;
    });
    refresh(comm.comm_id);
    return ok(`${pos.person.person_name} 님을 위촉했습니다.`, { appointId: created.appoint_id });
  });
}

/** 해촉 — 실제 해촉일과 사유를 기록하고 재임 중을 끈다 (행은 지우지 않는다) */
export async function dismissAppoint(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return userAction(async (actor) => {
    const parsed = DismissSchema.safeParse(formToObject(formData));
    if (!parsed.success) return fromZodError(parsed.error);
    const input = parsed.data;

    const before = await loadAppoint(input.appoint_id);
    if (!before) return fail("위촉 건을 찾을 수 없습니다.");
    assertPermission(canEditComm(actor, { mngUserId: before.comm.mng_user_id }), NO_PERMISSION);
    if (!before.appoint_activ) return fail("이미 해촉된 위촉 건입니다.");
    const dateError = checkDismissDate(before.appoint_start, input.appoint_end);
    if (dateError) return fail(dateError, { appoint_end: dateError });

    await prisma.$transaction(async (tx) => {
      const after = await tx.tB_Appoint.update({
        where: { appoint_id: before.appoint_id },
        data: { appoint_end: input.appoint_end, end_reason: input.end_reason, appoint_activ: false },
      });
      const { comm: _c, pos: _p, ...beforeRow } = before;
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.UPDATE,
        table: TABLE,
        targetId: before.appoint_id,
        before: beforeRow,
        after,
        note: "해촉",
      });
    });
    refresh(before.comm_id);
    return ok("해촉 처리했습니다.");
  });
}

/** 연임 — 현재 건을 만료 예정일에 임기만료로 끝내고, 다음 날부터 새 임기 건을 만든다 */
export async function reappoint(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return userAction(async (actor) => {
    const parsed = ReappointSchema.safeParse(formToObject(formData));
    if (!parsed.success) return fromZodError(parsed.error);

    const before = await loadAppoint(parsed.data.appoint_id);
    if (!before) return fail("위촉 건을 찾을 수 없습니다.");
    assertPermission(canEditComm(actor, { mngUserId: before.comm.mng_user_id }), NO_PERMISSION);
    if (!before.appoint_activ) return fail("해촉된 위촉 건은 연임할 수 없습니다.");
    if (!before.comm.comm_activ) return fail("비활성 위원회에서는 연임할 수 없습니다.");
    if (before.appoint_type !== AppointType.APPOINTED) return fail("당연직은 연임 대상이 아닙니다.");

    const next = nextTermDates(before.expire_due, before.comm.term_yr);
    if ("error" in next) return fail(next.error);

    const countSoFar = reappointCount(
      await personAppointsInComm(before.comm_id, before.pos.person_id),
      before.comm_id,
      before.pos.person_id,
    );
    const warnings = [reappointWarning(countSoFar, before.comm.reappoint_num)].filter((w): w is string => !!w);
    if (warnings.length && !parsed.data.confirm_warnings) return needsConfirm(warnings);

    await prisma.$transaction(async (tx) => {
      const ended = await tx.tB_Appoint.update({
        where: { appoint_id: before.appoint_id },
        data: { appoint_end: before.expire_due, end_reason: EndReason.EXPIRED, appoint_activ: false },
      });
      const created = await tx.tB_Appoint.create({
        data: {
          comm_id: before.comm_id,
          pos_id: before.pos_id,
          appos_id: before.appos_id,
          appoint_type: AppointType.APPOINTED,
          appoint_kind: AppointKind.REAPPOINT,
          appoint_start: next.start,
          expire_due: next.expireDue,
          appoint_activ: true,
        },
      });
      const { comm: _c, pos: _p, ...beforeRow } = before;
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.UPDATE,
        table: TABLE,
        targetId: before.appoint_id,
        before: beforeRow,
        after: ended,
        note: `연임으로 임기만료 처리 (다음 건 ${created.appoint_id})`,
      });
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.CREATE,
        table: TABLE,
        targetId: created.appoint_id,
        after: { ...created, previous: before.appoint_id, reappoint_no: countSoFar + 1, warnings },
      });
    });
    refresh(before.comm_id);
    return ok(`연임 처리했습니다 (연임 ${countSoFar + 1}회).`);
  });
}

/** 위원회 내 직위 변경 (위원 → 위원장 등) — 이전 건은 변경일 전날 종료, 새 건은 남은 임기를 승계 */
export async function changeApposition(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return userAction(async (actor) => {
    const parsed = ApposChangeSchema.safeParse(formToObject(formData));
    if (!parsed.success) return fromZodError(parsed.error);
    const input = parsed.data;

    const before = await loadAppoint(input.appoint_id);
    if (!before) return fail("위촉 건을 찾을 수 없습니다.");
    assertPermission(canEditComm(actor, { mngUserId: before.comm.mng_user_id }), NO_PERMISSION);
    if (!before.appoint_activ) return fail("해촉된 위촉 건은 바꿀 수 없습니다.");
    if (input.appos_id === before.appos_id) return fail("지금과 같은 직위입니다.", { appos_id: "다른 직위를 고르세요." });
    const appos = await prisma.tB_Ap_Position.findUnique({ where: { appos_id: input.appos_id } });
    if (!appos || !appos.appos_activ) return fail("사용할 수 없는 직위입니다.", { appos_id: "다시 고르세요." });

    const dates = positionChangeDates({
      start: before.appoint_start,
      expireDue: before.expire_due,
      changeDate: input.change_date,
    });
    if ("error" in dates) return fail(dates.error, { change_date: dates.error });

    await prisma.$transaction(async (tx) => {
      const ended = await tx.tB_Appoint.update({
        where: { appoint_id: before.appoint_id },
        data: { appoint_end: dates.prevEnd, end_reason: EndReason.POS_CHANGE, appoint_activ: false },
      });
      const created = await tx.tB_Appoint.create({
        data: {
          comm_id: before.comm_id,
          pos_id: before.pos_id,
          appos_id: appos.appos_id,
          appoint_type: before.appoint_type,
          appoint_kind: AppointKind.POS_CHANGE,
          appoint_start: dates.newStart,
          expire_due: dates.newExpireDue,
          appoint_activ: true,
        },
      });
      const { comm: _c, pos: _p, ...beforeRow } = before;
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.UPDATE,
        table: TABLE,
        targetId: before.appoint_id,
        before: beforeRow,
        after: ended,
        note: `위원회 내 직위 변경으로 종료 (다음 건 ${created.appoint_id})`,
      });
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.CREATE,
        table: TABLE,
        targetId: created.appoint_id,
        after: { ...created, previous: before.appoint_id },
      });
    });
    refresh(before.comm_id);
    return ok(`위원회 내 직위를 ${appos.appos_name}(으)로 바꿨습니다.`);
  });
}

/**
 * 소속직위 변경 — TB_Pos 행은 고치지 않고 이 위촉 건의 pos_id만 교체한다.
 * 다른 위원회 위촉 건은 영향을 받지 않는다. 옛 행을 아무도 가리키지 않으면 비활성화한다.
 */
export async function changeAffiliation(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return userAction(async (actor) => {
    const parsed = PosChangeSchema.safeParse(formToObject(formData));
    if (!parsed.success) return fromZodError(parsed.error);
    const input = parsed.data;

    const before = await loadAppoint(input.appoint_id);
    if (!before) return fail("위촉 건을 찾을 수 없습니다.");
    assertPermission(canEditComm(actor, { mngUserId: before.comm.mng_user_id }), NO_PERMISSION);
    if (!before.appoint_activ) return fail("해촉된 위촉 건은 바꿀 수 없습니다.");
    if (input.pos_id === before.pos_id) return fail("지금과 같은 소속직위입니다.", { pos_id: "다른 소속직위를 고르세요." });

    const newPos = await prisma.tB_Pos.findUnique({ where: { pos_id: input.pos_id } });
    if (!newPos || newPos.person_id !== before.pos.person_id) {
      return fail("이 인물의 소속직위가 아닙니다.", { pos_id: "다시 고르세요." });
    }
    if (!newPos.pos_activ) return fail("비활성 소속직위입니다.", { pos_id: "다시 고르세요." });

    let deactivatedOld = false;
    await prisma.$transaction(async (tx) => {
      const after = await tx.tB_Appoint.update({
        where: { appoint_id: before.appoint_id },
        data: { pos_id: newPos.pos_id },
      });
      const { comm: _c, pos: _p, ...beforeRow } = before;
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.UPDATE,
        table: TABLE,
        targetId: before.appoint_id,
        before: beforeRow,
        after,
        note: `소속직위 변경: ${before.pos.org_name} ${before.pos.pos_name} → ${newPos.org_name} ${newPos.pos_name}`,
      });

      // 옛 소속직위 행을 가리키는 위촉 건(과거 이력 포함)이 남았는지
      const remaining = await tx.tB_Appoint.count({ where: { pos_id: before.pos_id } });
      if (shouldDeactivatePos(remaining) && before.pos.pos_activ) {
        const posAfter = await tx.tB_Pos.update({ where: { pos_id: before.pos_id }, data: { pos_activ: false } });
        await writeAudit(tx, {
          userId: actor.userId,
          action: AuditAction.DELETE,
          table: "TB_Pos",
          targetId: before.pos_id,
          before: before.pos,
          after: posAfter,
          note: "참조하는 위촉 건이 없어 비활성화",
        });
        deactivatedOld = true;
      }
    });
    refresh(before.comm_id);
    return ok(
      deactivatedOld
        ? "소속직위를 바꿨습니다. 더 이상 쓰이지 않는 이전 소속직위는 비활성화했습니다."
        : "소속직위를 바꿨습니다. 다른 위원회의 표시는 그대로입니다.",
    );
  });
}
