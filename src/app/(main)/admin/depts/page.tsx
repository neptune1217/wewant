import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { DEPT_TYPE_LABEL } from "@/lib/enum-labels";
import { requireAdminPage } from "@/lib/permissions";
import { DeptsTable, type DeptRow } from "./depts-table";

export const metadata: Metadata = { title: "부서 관리 | 춘천시 위원회·위원 통합관리" };

/** 국소 아래에 소속 부서가 이어지도록 정렬 (상위 없는 부서 = 사업소는 맨 뒤) */
function hierarchyKey(d: { dept_id: string; dept_type: string; parentdept_id: string | null }) {
  if (d.dept_type === "GUKSO") return `1-${d.dept_id}-0`;
  if (d.parentdept_id) return `1-${d.parentdept_id}-1-${d.dept_id}`;
  return `2-${d.dept_id}`;
}

export default async function DeptsPage() {
  await requireAdminPage();

  const depts = await prisma.tB_Dept.findMany({
    include: {
      parent: true,
      _count: {
        select: {
          children: { where: { dept_activ: true } },
          users: { where: { user_activ: true } },
          comms: { where: { comm_activ: true } },
        },
      },
    },
  });
  depts.sort((a, b) => hierarchyKey(a).localeCompare(hierarchyKey(b)));

  const rows: DeptRow[] = depts.map((d) => ({
    id: d.dept_id,
    name: d.dept_name,
    type: d.dept_type,
    typeLabel: DEPT_TYPE_LABEL[d.dept_type],
    parentId: d.parentdept_id,
    parentName: d.parent?.dept_name ?? (d.dept_type === "BUSEO" ? "(사업소)" : ""),
    active: d.dept_activ,
    activeValue: d.dept_activ ? "Y" : "N",
    childCount: d._count.children,
    userCount: d._count.users,
    commCount: d._count.comms,
  }));

  // 상위 부서로 고를 수 있는 활성 국소
  const guksoOptions = depts
    .filter((d) => d.dept_type === "GUKSO" && d.dept_activ)
    .map((d) => ({ value: d.dept_id, label: d.dept_name }));

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">부서 관리</h1>
        <p className="text-sm text-muted-foreground">
          국소와 소속 부서입니다. 상위 국소가 없는 부서는 사업소로 묶어 통계에 표시합니다.
        </p>
      </div>
      <DeptsTable rows={rows} guksoOptions={guksoOptions} />
    </section>
  );
}
