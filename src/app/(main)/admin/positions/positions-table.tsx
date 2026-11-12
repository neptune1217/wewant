"use client";

import { useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import type { DataColumn } from "@/components/data-table/data-table-features";
import { ConfirmDialog } from "@/components/form/confirm-dialog";
import { FormDialog } from "@/components/form/form-dialog";
import { FormField } from "@/components/form/form-field";
import { ACTIVE_FILTER_OPTIONS, StatusBadge } from "@/components/form/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPosition, setPositionActive, updatePosition } from "./actions";

export type PositionRow = {
  id: string;
  name: string;
  active: boolean;
  activeValue: "Y" | "N";
  /** 재임 중 위촉 건수 */
  useCount: number;
};

export function PositionsTable({ rows }: { rows: PositionRow[] }) {
  const [editing, setEditing] = useState<PositionRow | "new" | null>(null);
  const [toggling, setToggling] = useState<PositionRow | null>(null);

  const columns: DataColumn<PositionRow>[] = [
    { accessorKey: "id", header: "코드" },
    { accessorKey: "name", header: "직위명" },
    { accessorKey: "useCount", header: "재임 중 사용", cell: ({ row }) => `${row.original.useCount}건` },
    {
      accessorKey: "activeValue",
      header: "상태",
      filterFn: "equalsString",
      cell: ({ row }) => <StatusBadge active={row.original.active} />,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(row.original)}>
            수정
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setToggling(row.original)}>
            {row.original.active ? "비활성화" : "활성화"}
          </Button>
        </div>
      ),
    },
  ];

  const current = editing === "new" ? null : editing;

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="직위명 검색"
        filters={[
          { columnId: "activeValue", label: "상태", options: ACTIVE_FILTER_OPTIONS, defaultValue: "Y" },
        ]}
        toolbar={<Button onClick={() => setEditing("new")}>직위명 등록</Button>}
      />

      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={current ? "직위명 수정" : "직위명 등록"}
        action={current ? updatePosition : createPosition}
      >
        {current && <input type="hidden" name="id" value={current.id} />}
        <FormField name="appos_name" label="직위명">
          <Input id="appos_name" name="appos_name" defaultValue={current?.name} required autoFocus />
        </FormField>
      </FormDialog>

      {toggling && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setToggling(null)}
          title={toggling.active ? "직위명 비활성화" : "직위명 다시 활성화"}
          description={
            toggling.active ? (
              <>
                <p>
                  <b>{toggling.name}</b>을(를) 비활성화하면 새 위촉에서 고를 수 없습니다.
                </p>
                {toggling.useCount > 0 && (
                  <p className="mt-2">재임 중인 위촉 {toggling.useCount}건의 표시는 그대로 유지됩니다.</p>
                )}
              </>
            ) : (
              <p>
                <b>{toggling.name}</b>을(를) 다시 활성화합니다.
              </p>
            )
          }
          confirmLabel={toggling.active ? "비활성화" : "활성화"}
          destructive={toggling.active}
          onConfirm={() => setPositionActive(toggling.id, !toggling.active)}
        />
      )}
    </>
  );
}
