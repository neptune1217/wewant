import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/permissions";
import { PositionsTable, type PositionRow } from "./positions-table";

export const metadata: Metadata = { title: "위원회 직위명 | 춘천시 위원회·위원 통합관리" };

export default async function PositionsPage() {
  await requireAdminPage();

  const positions = await prisma.tB_Ap_Position.findMany({
    orderBy: { appos_id: "asc" },
    include: { _count: { select: { appoints: { where: { appoint_activ: true } } } } },
  });
  const rows: PositionRow[] = positions.map((p) => ({
    id: p.appos_id,
    name: p.appos_name,
    active: p.appos_activ,
    activeValue: p.appos_activ ? "Y" : "N",
    useCount: p._count.appoints,
  }));

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">위원회 직위명</h1>
        <p className="text-sm text-muted-foreground">
          위원장·부위원장·위원처럼 위원회 안에서의 직위입니다. 소속기관의 직위(교수, 국장 등)와는 다릅니다.
        </p>
      </div>
      <PositionsTable rows={rows} />
    </section>
  );
}
