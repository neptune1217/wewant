"use client";

/** 위원 조회 결과 표 — 거르기는 서버(주소 조건)에서 끝났고, 여기서는 정렬만 한다 */
import Link from "next/link";
import { DataTable } from "@/components/data-table/data-table";
import type { DataColumn } from "@/components/data-table/data-table-features";
import { DupWarningIcon } from "@/components/dup-warning-icon";
import { Badge } from "@/components/ui/badge";
import type { MemberRow } from "@/lib/members";

const columns: DataColumn<MemberRow>[] = [
  {
    accessorKey: "commName",
    header: "위원회",
    cell: ({ row }) => (
      <div>
        <Link href={`/committees/${row.original.commId}`} className="underline-offset-4 hover:underline">
          {row.original.commName}
        </Link>
        <div className="text-xs text-muted-foreground">{row.original.deptName}</div>
      </div>
    ),
  },
  {
    accessorKey: "name",
    header: "성명",
    cell: ({ row }) => (
      <div>
        <div className="flex items-center gap-1 font-medium">
          {row.original.name}
          <DupWarningIcon info={row.original.dup} />
        </div>
        <div className="text-xs text-muted-foreground">
          {row.original.genderLabel} · {row.original.birthYear}년생{row.original.isPublic ? " · 공무원" : ""}
        </div>
      </div>
    ),
  },
  { accessorKey: "posLabel", header: "소속직위" },
  { accessorKey: "apposName", header: "위원회 내 직위" },
  {
    accessorKey: "typeLabel",
    header: "위촉유형",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {row.original.typeLabel} <span className="text-xs text-muted-foreground">({row.original.kindLabel})</span>
      </span>
    ),
  },
  { accessorKey: "start", header: "위촉일", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.start}</span> },
  {
    accessorKey: "expireDue",
    header: "만료 예정일",
    cell: ({ row }) => <span className="whitespace-nowrap">{row.original.expireDue ?? "-"}</span>,
  },
  { accessorKey: "reappointCount", header: "연임", cell: ({ row }) => `${row.original.reappointCount}회` },
  {
    accessorKey: "active",
    header: "상태",
    cell: ({ row }) =>
      row.original.active ? (
        <Badge variant="secondary">재임</Badge>
      ) : (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          해촉 {row.original.end}
          {row.original.endReasonLabel ? ` (${row.original.endReasonLabel})` : ""}
        </span>
      ),
  },
];

export function MembersTable({ rows }: { rows: MemberRow[] }) {
  return <DataTable columns={columns} data={rows} searchable={false} emptyMessage="조건에 맞는 위원이 없습니다." />;
}
