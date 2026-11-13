import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { INST_TYPE_LABEL, OP_TYPE_LABEL } from "@/lib/enum-labels";
import { getCommAccess, isAdmin } from "@/lib/permissions";
import { commStatus } from "@/lib/rules/comm-rules";
import { loadCommFormOptions } from "../comm-options";
import { CommStatusBadge } from "../comm-status-badge";
import { CommDetailActions } from "./comm-detail-actions";

export const metadata: Metadata = { title: "위원회 상세 | 춘천시 위원회·위원 통합관리" };

export default async function CommitteeDetailPage({ params }: PageProps<"/committees/[commId]">) {
  const { commId } = await params;
  const access = await getCommAccess(commId);
  if (!access) notFound();
  const { user, comm, canView, canEdit } = access;

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
        <p className="text-sm text-muted-foreground">열람 요청 기능은 7단계에서 추가됩니다.</p>
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

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border p-4 text-sm sm:grid-cols-[9rem_1fr]">
        {info.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="mb-2 sm:mb-0">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        <h2 className="mb-1 font-medium text-foreground">위원 명부</h2>
        위원 명부(재임/해촉, 소속직위, 위촉유형, 임기, 연임횟수)와 신규 위촉·해촉·연임은 5단계에서 추가됩니다.
      </div>
    </section>
  );
}
