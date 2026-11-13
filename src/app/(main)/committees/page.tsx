import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { INST_TYPE_LABEL, OP_TYPE_LABEL } from "@/lib/enum-labels";
import { canEditComm, canViewCommDetail, isAdmin, requireUser, todayKST } from "@/lib/permissions";
import { accessStatus } from "@/lib/rules/access-rules";
import { commStatus } from "@/lib/rules/comm-rules";
import { formatDate } from "@/lib/rules/term";
import type { CommEditPayload } from "./comm-form";
import { deptLabel, loadCommFormOptions } from "./comm-options";
import { CommitteesTable, type CommRow } from "./committees-table";

export const metadata: Metadata = { title: "위원회·위원 | 춘천시 위원회·위원 통합관리" };

/**
 * 위원회 목록 — 모든 사용자에게 기본 정보만 보여 준다.
 * 근거·임기 등 상세 값은 편집 권한이 있는 위원회만 화면으로 보낸다(수정 대화상자용).
 */
export default async function CommitteesPage() {
  const user = await requireUser();
  const today = todayKST();

  const [comms, myGrants, formOptions] = await Promise.all([
    prisma.tB_Comm.findMany({
      orderBy: { comm_id: "asc" },
      include: {
        dept: { include: { parent: true } },
        mng_user: true,
        _count: { select: { appoints: { where: { appoint_activ: true } } } },
      },
    }),
    prisma.tB_AccessReq.findMany({
      where: { req_user_id: user.userId },
      select: { req_id: true, comm_id: true, req_user_id: true, req_status: true, req_at: true, view_until: true },
    }),
    loadCommFormOptions(user),
  ]);

  const rows: CommRow[] = comms.map((c) => {
    const ref = { mngUserId: c.mng_user_id };
    const grants = myGrants
      .filter((g) => g.comm_id === c.comm_id)
      .map((g) => ({ reqUserId: g.req_user_id, status: g.req_status, viewUntil: g.view_until }));
    const canEdit = canEditComm(user, ref);
    const mine = myGrants.filter((g) => g.comm_id === c.comm_id);
    const access = canEdit
      ? null
      : accessStatus(
          mine.map((g) => ({ reqId: g.req_id, status: g.req_status, reqAt: g.req_at, viewUntil: g.view_until })),
          today,
        );
    const status = commStatus({ active: c.comm_activ, approved: c.comm_approved });
    const edit: CommEditPayload | undefined = canEdit
      ? {
          id: c.comm_id,
          comm_name: c.comm_name,
          dept_id: c.dept_id,
          mng_user_id: c.mng_user_id,
          inst_type: c.inst_type,
          legal_1: c.legal_1,
          legal_2: c.legal_2,
          op_type: c.op_type,
          member_cap: c.member_cap,
          term_yr: c.term_yr,
          reappoint_num: c.reappoint_num,
        }
      : undefined;
    return {
      id: c.comm_id,
      name: c.comm_name,
      deptId: c.dept_id,
      deptLabel: deptLabel(c.dept),
      mngName: c.mng_user.user_name,
      mine: c.mng_user_id === user.userId ? "Y" : "N",
      instType: c.inst_type,
      instTypeLabel: INST_TYPE_LABEL[c.inst_type],
      opType: c.op_type,
      opTypeLabel: OP_TYPE_LABEL[c.op_type],
      capacity: `${c._count.appoints} / ${c.member_cap}`,
      status,
      active: c.comm_activ,
      canView: canViewCommDetail(user, ref, grants, today),
      accessKind: access?.kind ?? "NONE",
      accessUntil: access?.viewUntil ? formatDate(access.viewUntil) : null,
      canEdit,
      edit,
      currentLabels: canEdit ? { dept: c.dept.dept_name, manager: c.mng_user.user_name } : undefined,
    };
  });

  const deptFilterOptions = [...new Map(rows.map((r) => [r.deptId, r.deptLabel])).entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
  const pendingCount = rows.filter((r) => r.status === "PENDING").length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">위원회·위원</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin(user)
              ? "모든 위원회를 관리할 수 있습니다."
              : "본인이 담당자인 위원회만 수정할 수 있습니다. 다른 위원회는 기본 정보만 보입니다."}
          </p>
        </div>
        <Link href="/committees/duplicates" className={buttonVariants({ variant: "outline" })}>
          중복위촉 조회
        </Link>
      </div>
      {isAdmin(user) && pendingCount > 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          승인 대기 중인 위원회가 {pendingCount}건 있습니다. 상태 필터에서 &quot;승인 대기&quot;를 고르면 모아 볼 수 있습니다.
        </p>
      )}
      <CommitteesTable
        rows={rows}
        isAdmin={isAdmin(user)}
        deptFilterOptions={deptFilterOptions}
        formOptions={formOptions}
      />
    </section>
  );
}
