import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getDupSummaries } from "@/lib/duplicates";
import {
  APPOINT_KIND_LABEL,
  APPOINT_TYPE_LABEL,
  END_REASON_LABEL,
  GENDER_LABEL,
  INST_TYPE_LABEL,
  OP_TYPE_LABEL,
} from "@/lib/enum-labels";
import { canEditPerson, canRequestAccess, getCommAccess, isAdmin, todayKST, type CurrentUser } from "@/lib/permissions";
import { reappointCount, type AppointLite } from "@/lib/rules/appoint-rules";
import { commStatus } from "@/lib/rules/comm-rules";
import { dDay, formatDate } from "@/lib/rules/term";
import { Roster, type RosterRow } from "./roster";
import { loadCommFormOptions } from "../comm-options";
import { CommStatusBadge } from "../comm-status-badge";
import { AccessRequestPanel } from "./access-request-panel";
import { CommDetailActions } from "./comm-detail-actions";

export const metadata: Metadata = { title: "위원회 상세 | 춘천시 위원회·위원 통합관리" };

export default async function CommitteeDetailPage({ params }: PageProps<"/committees/[commId]">) {
  const { commId } = await params;
  const access = await getCommAccess(commId);
  if (!access) notFound();
  const { user, comm, canView, canEdit, myAccess } = access;
  const myViewUntil = myAccess.viewUntil ? formatDate(myAccess.viewUntil) : null;

  const back = (
    <Link href="/committees" className={buttonVariants({ variant: "ghost", size: "sm" })}>
      ← 위원회 목록
    </Link>
  );

  // 열람 권한이 없으면 위원회 이름과 안내만 보여 준다 (상세 값은 화면으로 보내지 않는다)
  if (!canView) {
    return (
      <section className="flex flex-col items-start gap-3">
        {back}
        <h1 className="text-xl font-semibold">{comm.comm_name}</h1>
        <p className="text-muted-foreground">
          이 위원회의 상세 정보와 위원 명부는 담당자({comm.mng_user.user_name})와 총괄담당자만 볼 수 있습니다.
        </p>
        <AccessRequestPanel
          commId={comm.comm_id}
          commName={comm.comm_name}
          kind={myAccess.kind}
          viewUntil={myViewUntil}
          canRequest={canRequestAccess(user, { mngUserId: comm.mng_user_id })}
        />
      </section>
    );
  }

  const status = commStatus({ active: comm.comm_activ, approved: comm.comm_approved });
  const dept = comm.dept.parent ? `${comm.dept.parent.dept_name} > ${comm.dept.dept_name}` : comm.dept.dept_name;
  const info: [string, string][] = [
    ["위원회 코드", comm.comm_id],
    ["소관부서", dept],
    ["담당자", `${comm.mng_user.user_name} (${comm.mng_user.dept.dept_name}, 내선 ${comm.mng_user.phone})`],
    ["설치유형", INST_TYPE_LABEL[comm.inst_type]],
    ["근거법령", comm.legal_1 ?? "-"],
    ["근거조례·규칙", comm.legal_2 ?? "-"],
    ["운영형태", OP_TYPE_LABEL[comm.op_type]],
    ["현원 / 정원", `${comm._count.appoints}명 / ${comm.member_cap}명`],
    ["임기", `${comm.term_yr}년`],
    ["연임 가능횟수", comm.reappoint_num === 0 ? "연임 불가" : `${comm.reappoint_num}회`],
    [
      "승인",
      comm.comm_approved
        ? comm.approved_at
          ? `${comm.approved_at.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}${comm.approver ? ` (${comm.approver.user_name})` : ""}`
          : "승인됨"
        : "승인 대기 — 총괄담당자가 승인하면 통계 등에 포함됩니다",
    ],
  ];

  const formOptions = canEdit ? await loadCommFormOptions(user) : null;

  return (
    <section className="flex flex-col gap-4">
      <div>{back}</div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">{comm.comm_name}</h1>
          <CommStatusBadge status={status} />
        </div>
        {formOptions && (
          <CommDetailActions
            isAdmin={isAdmin(user)}
            status={status}
            formOptions={formOptions}
            current={{
              id: comm.comm_id,
              comm_name: comm.comm_name,
              dept_id: comm.dept_id,
              mng_user_id: comm.mng_user_id,
              inst_type: comm.inst_type,
              legal_1: comm.legal_1,
              legal_2: comm.legal_2,
              op_type: comm.op_type,
              member_cap: comm.member_cap,
              term_yr: comm.term_yr,
              reappoint_num: comm.reappoint_num,
            }}
            currentLabels={{ dept: comm.dept.dept_name, manager: comm.mng_user.user_name }}
            name={comm.comm_name}
            memberCount={comm._count.appoints}
          />
        )}
      </div>

      {!canEdit && (
        <p className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100">
          읽기 전용 열람 중입니다{myViewUntil ? ` — ${myViewUntil}까지` : ""}. 수정·위촉은 담당자({comm.mng_user.user_name})와
          총괄담당자만 할 수 있습니다.
        </p>
      )}

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border p-4 text-sm sm:grid-cols-[9rem_1fr]">
        {info.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="mb-2 sm:mb-0">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">위원 명부</h2>
        {!comm.comm_activ && (
          <p className="text-sm text-muted-foreground">비활성 위원회입니다. 명부 조회는 되지만 신규 위촉은 할 수 없습니다.</p>
        )}
        <Roster
          rows={await loadRosterRows(comm.comm_id, user, canEdit)}
          canEdit={canEdit}
          options={
            canEdit
              ? {
                  commId: comm.comm_id,
                  commActive: comm.comm_activ,
                  termYr: comm.term_yr,
                  reappointNum: comm.reappoint_num,
                  memberCap: comm.member_cap,
                  today: formatDate(todayKST()),
                  apposOptions: (
                    await prisma.tB_Ap_Position.findMany({ where: { appos_activ: true }, orderBy: { appos_id: "asc" } })
                  ).map((a) => ({ value: a.appos_id, label: a.appos_name })),
                }
              : null
          }
        />
      </div>
    </section>
  );
}

/** 위원 명부 행 만들기. 인물 수정·소속직위 변경용 값은 편집 권한이 있을 때만 싣는다. */
async function loadRosterRows(commId: string, user: CurrentUser, canEdit: boolean): Promise<RosterRow[]> {
  const today = todayKST();
  const appoints = await prisma.tB_Appoint.findMany({
    where: { comm_id: commId },
    include: {
      appos: true,
      pos: {
        include: {
          person: { include: { positions: { where: { pos_activ: true }, orderBy: { pos_id: "asc" } } } },
        },
      },
    },
    orderBy: [{ appoint_activ: "desc" }, { appos_id: "asc" }, { appoint_start: "asc" }],
  });

  const lites: AppointLite[] = appoints.map((a) => ({
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

  // 인물 수정 권한: 그 인물의 위촉 건(모든 위원회)이 모두 본인 담당이어야 한다
  const personIds = [...new Set(lites.map((l) => l.personId))];
  // 중복위촉 경고 아이콘 (위촉직 4개 이상) — 위원회명만 담는다
  const dup = await getDupSummaries(personIds);
  const allOfPersons = canEdit
    ? await prisma.tB_Appoint.findMany({
        where: { pos: { person_id: { in: personIds } } },
        select: { pos: { select: { person_id: true } }, comm: { select: { mng_user_id: true } } },
      })
    : [];
  const commsByPerson = new Map<string, { mngUserId: string }[]>();
  for (const a of allOfPersons) {
    const list = commsByPerson.get(a.pos.person_id) ?? [];
    list.push({ mngUserId: a.comm.mng_user_id });
    commsByPerson.set(a.pos.person_id, list);
  }

  return appoints.map((a) => {
    const person = a.pos.person;
    const editable = canEdit && canEditPerson(user, commsByPerson.get(person.person_id) ?? []);
    return {
      appointId: a.appoint_id,
      personId: person.person_id,
      name: person.person_name,
      genderLabel: GENDER_LABEL[person.person_gender],
      birthYear: String(person.birth_date.getUTCFullYear()),
      isPublic: person.is_public,
      posId: a.pos_id,
      posLabel: `${a.pos.org_name} ${a.pos.pos_name}`,
      apposId: a.appos_id,
      apposName: a.appos.appos_name,
      type: a.appoint_type,
      typeLabel: APPOINT_TYPE_LABEL[a.appoint_type],
      kindLabel: APPOINT_KIND_LABEL[a.appoint_kind],
      start: formatDate(a.appoint_start),
      expireDue: a.expire_due ? formatDate(a.expire_due) : null,
      end: a.appoint_end ? formatDate(a.appoint_end) : null,
      endReasonLabel: a.end_reason ? END_REASON_LABEL[a.end_reason] : null,
      active: a.appoint_activ,
      activeValue: a.appoint_activ ? "Y" : "N",
      dday: a.appoint_activ && a.expire_due ? dDay(a.expire_due, today) : null,
      reappointCount: reappointCount(lites, commId, person.person_id, a.appoint_id),
      dup: dup.get(person.person_id),
      person: canEdit
        ? {
            personId: person.person_id,
            name: person.person_name,
            genderLabel: GENDER_LABEL[person.person_gender],
            birthDate: formatDate(person.birth_date),
            isPublic: person.is_public,
            positions: person.positions.map((p) => ({ posId: p.pos_id, label: `${p.org_name} ${p.pos_name}` })),
            dup: dup.get(person.person_id)!,
          }
        : undefined,
      personEdit: editable
        ? {
            person_name: person.person_name,
            person_gender: person.person_gender,
            birth_date: formatDate(person.birth_date),
            is_public: person.is_public,
          }
        : undefined,
    };
  });
}
