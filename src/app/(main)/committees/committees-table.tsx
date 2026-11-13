"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import type { DataColumn } from "@/components/data-table/data-table-features";
import { ConfirmDialog } from "@/components/form/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { approveComm, setCommActive } from "./actions";
import { CommFormDialog, type CommEditPayload, type CommFormOptions, type Option } from "./comm-form";
import { CommStatusBadge } from "./comm-status-badge";

export type CommRow = {
  id: string;
  name: string;
  deptId: string;
  deptLabel: string;
  mngName: string;
  /** 내가 담당자인가 (필터용) */
  mine: "Y" | "N";
  instType: string;
  instTypeLabel: string;
  opType: string;
  opTypeLabel: string;
  /** "현원 / 정원" */
  capacity: string;
  status: "ACTIVE" | "PENDING" | "INACTIVE";
  active: boolean;
  canView: boolean;
  canEdit: boolean;
  edit?: CommEditPayload;
  currentLabels?: { dept?: string; manager?: string };
};

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "운영 중" },
  { value: "PENDING", label: "승인 대기" },
  { value: "INACTIVE", label: "비활성" },
];

export function CommitteesTable({
  rows,
  isAdmin,
  deptFilterOptions,
  formOptions,
}: {
  rows: CommRow[];
  isAdmin: boolean;
  deptFilterOptions: Option[];
  formOptions: CommFormOptions;
}) {
  const [editing, setEditing] = useState<CommRow | "new" | null>(null);
  const [toggling, setToggling] = useState<CommRow | null>(null);
  const [approving, setApproving] = useState<CommRow | null>(null);

  const columns: DataColumn<CommRow>[] = [
    {
      accessorKey: "name",
      header: "위원회명",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span className="inline-flex items-center gap-1.5">
            {r.canView ? (
              <Link href={`/committees/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                {r.name}
              </Link>
            ) : (
              r.name
            )}
            {r.mine === "Y" && <Badge variant="outline">내 담당</Badge>}
          </span>
        );
      },
    },
    { accessorKey: "deptId", header: "소관부서", filterFn: "equalsString", cell: ({ row }) => row.original.deptLabel },
    { accessorKey: "mngName", header: "담당자" },
    { accessorKey: "instType", header: "설치유형", filterFn: "equalsString", cell: ({ row }) => row.original.instTypeLabel },
    { accessorKey: "opType", header: "운영형태", filterFn: "equalsString", cell: ({ row }) => row.original.opTypeLabel },
    { accessorKey: "capacity", header: "현원/정원", enableSorting: false },
    { accessorKey: "mine", header: "담당", filterFn: "equalsString", enableSorting: false, enableGlobalFilter: false },
    {
      accessorKey: "status",
      header: "상태",
      filterFn: "equalsString",
      cell: ({ row }) => <CommStatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex justify-end gap-1">
            {isAdmin && r.status === "PENDING" && (
              <Button size="sm" variant="outline" onClick={() => setApproving(r)}>
                승인
              </Button>
            )}
            {r.canEdit && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                  수정
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setToggling(r)}>
                  {r.active ? "비활성화" : "활성화"}
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  const current = editing === "new" ? null : editing;

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="위원회명·부서·담당자 검색"
        hiddenColumns={["mine"]}
        filters={[
          { columnId: "deptId", label: "소관부서", options: deptFilterOptions },
          {
            columnId: "instType",
            label: "설치유형",
            options: [
              { value: "LAW", label: "법령" },
              { value: "ORDINANCE", label: "조례" },
              { value: "ETC", label: "기타" },
            ],
          },
          {
            columnId: "opType",
            label: "운영형태",
            options: [
              { value: "STANDING", label: "상설" },
              { value: "NON_STANDING", label: "비상설" },
            ],
          },
          {
            columnId: "mine",
            label: "담당",
            options: [
              { value: "Y", label: "내 담당" },
              { value: "N", label: "다른 담당" },
            ],
            // 부서 계정은 본인 담당 위원회부터 보이게
            defaultValue: isAdmin ? undefined : "Y",
          },
          { columnId: "status", label: "상태", options: STATUS_OPTIONS },
        ]}
        toolbar={<Button onClick={() => setEditing("new")}>위원회 등록</Button>}
      />

      <CommFormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        current={current?.edit ?? null}
        currentLabels={current?.currentLabels}
        options={formOptions}
      />

      {toggling && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setToggling(null)}
          title={toggling.active ? "위원회 비활성화" : "위원회 다시 활성화"}
          description={
            toggling.active ? (
              <>
                <p>
                  <b>{toggling.name}</b>을(를) 비활성화(폐지)합니다. 통계와 중복위촉 집계에서 빠집니다.
                </p>
                <p className="mt-2">현원/정원: {toggling.capacity}. 재임 중인 위원의 위촉 기록은 그대로 남습니다.</p>
              </>
            ) : (
              <p>
                <b>{toggling.name}</b>을(를) 다시 활성화합니다.
              </p>
            )
          }
          confirmLabel={toggling.active ? "비활성화" : "활성화"}
          destructive={toggling.active}
          onConfirm={() => setCommActive(toggling.id, !toggling.active)}
        />
      )}

      {approving && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setApproving(null)}
          title="위원회 승인"
          description={
            <p>
              <b>{approving.name}</b>({approving.deptLabel}, 담당 {approving.mngName})을(를) 승인합니다. 승인하면 통계 등
              집계에 포함됩니다.
            </p>
          }
          confirmLabel="승인"
          onConfirm={() => approveComm(approving.id)}
        />
      )}
    </>
  );
}
