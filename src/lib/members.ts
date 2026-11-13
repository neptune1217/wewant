/**
 * 위원 조회 데이터 (서버 전용) — 화면(/members)과 엑셀 내보내기가 함께 쓴다.
 *
 * 열람 권한이 있는 위원회(총괄: 전체, 부서: 본인 담당 + 열람 승인 기간 중)의 위촉 건만 꺼낸다.
 * 권한이 없는 위원회의 위원은 여기서부터 빠지므로 화면에도 엑셀에도 들어가지 않는다.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { getDupSummaries, type DupSummary } from "@/lib/duplicates";
import { APPOINT_KIND_LABEL, APPOINT_TYPE_LABEL, END_REASON_LABEL, GENDER_LABEL } from "@/lib/enum-labels";
import { canViewCommDetail, todayKST, type CurrentUser } from "@/lib/permissions";
import { reappointCount, type AppointLite } from "@/lib/rules/appoint-rules";
import type { MemberFilterRow } from "@/lib/rules/member-filter";
import { formatDate } from "@/lib/rules/term";

export type MemberRow = MemberFilterRow & {
  commName: string;
  deptName: string;
  personId: string;
  genderLabel: string;
  isPublic: boolean;
  posLabel: string;
  apposName: string;
  typeLabel: string;
  kindLabel: string;
  start: string;
  expireDue: string | null;
  end: string | null;
  endReasonLabel: string | null;
  dup: DupSummary;
};

export type Option = { value: string; label: string };

/** 사용자가 열람할 수 있는 위원회 (필터 선택지도 이 범위) */
export async function viewableComms(user: CurrentUser) {
  const today = todayKST();
  const [comms, grants] = await Promise.all([
    prisma.tB_Comm.findMany({
      select: { comm_id: true, comm_name: true, mng_user_id: true, dept_id: true, dept: { select: { dept_name: true } } },
      orderBy: { comm_name: "asc" },
    }),
    prisma.tB_AccessReq.findMany({
      where: { req_user_id: user.userId, req_status: "APPROVED" },
      select: { comm_id: true, req_user_id: true, req_status: true, view_until: true },
    }),
  ]);
  return comms.filter((c) =>
    canViewCommDetail(
      user,
      { mngUserId: c.mng_user_id },
      grants
        .filter((g) => g.comm_id === c.comm_id)
        .map((g) => ({ reqUserId: g.req_user_id, status: g.req_status, viewUntil: g.view_until })),
      today,
    ),
  );
}

/** 열람 가능한 위원회의 모든 위촉 건 (필터 전) + 필터 선택지 */
export async function loadMemberRows(user: CurrentUser): Promise<{
  rows: MemberRow[];
  commOptions: Option[];
  deptOptions: Option[];
}> {
  const comms = await viewableComms(user);
  const commIds = comms.map((c) => c.comm_id);
  const commOptions = comms.map((c) => ({ value: c.comm_id, label: c.comm_name }));
  const deptOptions = [...new Map(comms.map((c) => [c.dept_id, c.dept.dept_name])).entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
  if (!commIds.length) return { rows: [], commOptions, deptOptions };

  const appoints = await prisma.tB_Appoint.findMany({
    where: { comm_id: { in: commIds } },
    include: {
      appos: { select: { appos_name: true } },
      comm: { select: { comm_name: true, dept_id: true, dept: { select: { dept_name: true } } } },
      pos: { include: { person: true } },
    },
    orderBy: [{ comm: { comm_name: "asc" } }, { appoint_activ: "desc" }, { appos_id: "asc" }, { appoint_start: "asc" }],
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
  const dup = await getDupSummaries([...new Set(lites.map((l) => l.personId))]);

  const rows = appoints.map<MemberRow>((a) => {
    const p = a.pos.person;
    return {
      appointId: a.appoint_id,
      commId: a.comm_id,
      commName: a.comm.comm_name,
      deptId: a.comm.dept_id,
      deptName: a.comm.dept.dept_name,
      personId: p.person_id,
      name: p.person_name,
      gender: p.person_gender,
      genderLabel: GENDER_LABEL[p.person_gender],
      birthYear: p.birth_date.getUTCFullYear(),
      isPublic: p.is_public,
      posLabel: `${a.pos.org_name} ${a.pos.pos_name}`,
      apposName: a.appos.appos_name,
      type: a.appoint_type,
      typeLabel: APPOINT_TYPE_LABEL[a.appoint_type],
      kindLabel: APPOINT_KIND_LABEL[a.appoint_kind],
      start: formatDate(a.appoint_start),
      expireDue: a.expire_due ? formatDate(a.expire_due) : null,
      end: a.appoint_end ? formatDate(a.appoint_end) : null,
      endReasonLabel: a.end_reason ? END_REASON_LABEL[a.end_reason] : null,
      active: a.appoint_activ,
      reappointCount: reappointCount(lites, a.comm_id, p.person_id, a.appoint_id),
      dup: dup.get(p.person_id)!,
    };
  });
  return { rows, commOptions, deptOptions };
}
