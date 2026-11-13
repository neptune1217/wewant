"use server";

/**
 * 인물(TB_Person)·소속직위(TB_Pos) — 검색, 등록, 수정, 소속직위 추가
 * - 인물은 전 위원회가 공유하는 한 사람당 한 행. 같은 성명·생년월일이 있으면 먼저 기존 인물 사용을 권한다
 * - 등록·소속직위 추가: 활성 사용자 누구나 / 수정: 총괄, 또는 그 인물의 위촉 건이 모두 본인 담당일 때
 */
import { revalidatePath } from "next/cache";
import { AuditAction } from "@/generated/prisma/enums";
import { fail, fromZodError, ok, userAction, type ActionResult } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getDupSummaries, type DupSummary } from "@/lib/duplicates";
import { GENDER_LABEL } from "@/lib/enum-labels";
import { assertPermission, canAddPosition, canCreatePerson, canEditPerson, requireUser } from "@/lib/permissions";
import { formatDate } from "@/lib/rules/term";
import { PersonSchema, PositionAddSchema } from "@/lib/validation/appoint";
import { formToObject } from "@/lib/validation/master";

/** 검색 결과 — 위촉에 필요한 최소 정보만 */
export type PersonHit = {
  personId: string;
  name: string;
  genderLabel: string;
  birthDate: string;
  isPublic: boolean;
  positions: { posId: string; label: string }[];
  /** 중복위촉 요약 (위촉직 4개 이상이면 경고 아이콘) */
  dup: DupSummary;
};

async function toHits(where: { person_name?: { contains: string }; person_id?: { in: string[] } }) {
  const persons = await prisma.tB_Person.findMany({
    where: { ...where, person_activ: true },
    include: { positions: { where: { pos_activ: true }, orderBy: { pos_id: "asc" } } },
    orderBy: [{ person_name: "asc" }, { birth_date: "asc" }],
    take: 20,
  });
  const dup = await getDupSummaries(persons.map((p) => p.person_id));
  return persons.map<PersonHit>((p) => ({
    personId: p.person_id,
    name: p.person_name,
    genderLabel: GENDER_LABEL[p.person_gender],
    birthDate: formatDate(p.birth_date),
    isPublic: p.is_public,
    positions: p.positions.map((s) => ({ posId: s.pos_id, label: `${s.org_name} ${s.pos_name}` })),
    dup: dup.get(p.person_id)!,
  }));
}

/** 성명으로 인물 검색 (활성 인물만, 최대 20명) */
export async function searchPersons(name: string): Promise<PersonHit[]> {
  const user = await requireUser();
  if (!canCreatePerson(user)) return [];
  const q = name.trim();
  if (q.length < 1) return [];
  return toHits({ person_name: { contains: q } });
}

/** 인물 한 명 다시 읽기 (소속직위 추가 후 목록 갱신용) */
export async function getPerson(personId: string): Promise<PersonHit | null> {
  const user = await requireUser();
  if (!canCreatePerson(user)) return null;
  return (await toHits({ person_id: { in: [personId] } }))[0] ?? null;
}

/** 같은 성명·생년월일의 활성 인물 (등록 전에 "기존 인물을 사용하시겠습니까?"를 묻기 위해) */
export async function findSamePersons(name: string, birthDate: string): Promise<PersonHit[]> {
  const user = await requireUser();
  if (!canCreatePerson(user)) return [];
  const parsed = PersonSchema.pick({ person_name: true, birth_date: true }).safeParse({
    person_name: name,
    birth_date: birthDate,
  });
  if (!parsed.success) return [];
  const same = await prisma.tB_Person.findMany({
    where: { person_name: parsed.data.person_name, birth_date: parsed.data.birth_date, person_activ: true },
    select: { person_id: true },
  });
  return same.length ? toHits({ person_id: { in: same.map((s) => s.person_id) } }) : [];
}

/** 인물 등록. 같은 성명·생년월일이 있으면 확인(confirm_duplicate=Y)해야 새로 등록한다. */
export async function createPerson(_prev: unknown, formData: FormData): Promise<ActionResult<{ person: PersonHit }>> {
  return userAction(async (actor) => {
    assertPermission(canCreatePerson(actor));
    const parsed = PersonSchema.safeParse(formToObject(formData));
    if (!parsed.success) return fromZodError(parsed.error);
    const { confirm_duplicate, ...input } = parsed.data;

    if (!confirm_duplicate) {
      const sameCount = await prisma.tB_Person.count({
        where: { person_name: input.person_name, birth_date: input.birth_date, person_activ: true },
      });
      if (sameCount > 0) {
        return {
          ok: false,
          message: "같은 성명·생년월일의 인물이 이미 있습니다. 기존 인물을 사용하시겠습니까?",
          warnings: ["동명이인이 확실할 때만 새로 등록하세요."],
        };
      }
    }

    const person = await prisma.$transaction(async (tx) => {
      const p = await tx.tB_Person.create({ data: input });
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.CREATE,
        table: "TB_Person",
        targetId: p.person_id,
        after: p,
      });
      return p;
    });
    const [hit] = await toHits({ person_id: { in: [person.person_id] } });
    return ok(`${person.person_name} 님을 등록했습니다.`, { person: hit });
  });
}

/** 인물 정보 수정 — 총괄, 또는 그 인물의 위촉 건이 모두 본인 담당 위원회에 있을 때 */
export async function updatePerson(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return userAction(async (actor) => {
    const personId = String(formData.get("person_id") ?? "");
    const before = await prisma.tB_Person.findUnique({
      where: { person_id: personId },
      include: { positions: { include: { appoints: { include: { comm: { select: { mng_user_id: true } } } } } } },
    });
    if (!before) return fail("인물을 찾을 수 없습니다.");
    const comms = before.positions.flatMap((p) => p.appoints.map((a) => ({ mngUserId: a.comm.mng_user_id })));
    assertPermission(
      canEditPerson(actor, comms),
      "다른 담당자의 위원회에도 위촉된 인물이라 수정할 수 없습니다. 총괄담당자에게 요청하세요.",
    );

    const parsed = PersonSchema.safeParse(formToObject(formData));
    if (!parsed.success) return fromZodError(parsed.error);
    const { confirm_duplicate: _c, ...input } = parsed.data;

    await prisma.$transaction(async (tx) => {
      const after = await tx.tB_Person.update({ where: { person_id: personId }, data: input });
      const { positions: _p, ...beforeRow } = before;
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.UPDATE,
        table: "TB_Person",
        targetId: personId,
        before: beforeRow,
        after,
      });
    });
    revalidatePath("/committees", "layout");
    return ok("인물 정보를 수정했습니다.");
  });
}

/**
 * 소속직위 새 행 추가. 같은 (인물, 기관, 직위) 행이 있으면 그 행을 쓴다(비활성이면 다시 활성화).
 * 기존 행의 글자는 고치지 않는다.
 */
export async function addPosition(_prev: unknown, formData: FormData): Promise<ActionResult<{ posId: string }>> {
  return userAction(async (actor) => {
    assertPermission(canAddPosition(actor));
    const parsed = PositionAddSchema.safeParse(formToObject(formData));
    if (!parsed.success) return fromZodError(parsed.error);
    const input = parsed.data;

    const person = await prisma.tB_Person.findUnique({ where: { person_id: input.person_id } });
    if (!person || !person.person_activ) return fail("인물을 찾을 수 없습니다.");

    const existing = await prisma.tB_Pos.findUnique({
      where: {
        person_id_org_name_pos_name: { person_id: input.person_id, org_name: input.org_name, pos_name: input.pos_name },
      },
    });
    if (existing?.pos_activ) return ok("이미 등록된 소속직위입니다. 그 항목을 사용합니다.", { posId: existing.pos_id });

    const posId = await prisma.$transaction(async (tx) => {
      if (existing) {
        const after = await tx.tB_Pos.update({ where: { pos_id: existing.pos_id }, data: { pos_activ: true } });
        await writeAudit(tx, {
          userId: actor.userId,
          action: AuditAction.UPDATE,
          table: "TB_Pos",
          targetId: existing.pos_id,
          before: existing,
          after,
          note: "다시 활성화",
        });
        return existing.pos_id;
      }
      const created = await tx.tB_Pos.create({ data: input });
      await writeAudit(tx, {
        userId: actor.userId,
        action: AuditAction.CREATE,
        table: "TB_Pos",
        targetId: created.pos_id,
        after: created,
      });
      return created.pos_id;
    });
    return ok("소속직위를 추가했습니다.", { posId });
  });
}
