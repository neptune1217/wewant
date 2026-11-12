"use client";

import { useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import type { DataColumn } from "@/components/data-table/data-table-features";
import { ConfirmDialog } from "@/components/form/confirm-dialog";
import { FormDialog } from "@/components/form/form-dialog";
import { FormField, NONE, SelectField } from "@/components/form/form-field";
import { ACTIVE_FILTER_OPTIONS, StatusBadge } from "@/components/form/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createDept, setDeptActive, updateDept } from "./actions";

export type DeptRow = {
  id: string;
  name: string;
  type: "GUKSO" | "BUSEO";
  typeLabel: string;
  parentId: string | null;
  parentName: string;
  active: boolean;
  activeValue: "Y" | "N";
  /** 활성 하위 부서 수 */
  childCount: number;
  /** 소속 활성 사용자 수 */
  userCount: number;
  /** 소관 활성 위원회 수 */
  commCount: number;
};

type Option = { value: string; label: string };

const TYPE_OPTIONS = [
  { value: "GUKSO", label: "국소" },
  { value: "BUSEO", label: "부서" },
];

export function DeptsTable({ rows, guksoOptions }: { rows: DeptRow[]; guksoOptions: Option[] }) {
  const [editing, setEditing] = useState<DeptRow | "new" | null>(null);
  const [toggling, setToggling] = useState<DeptRow | null>(null);

  const columns: DataColumn<DeptRow>[] = [
    { accessorKey: "id", header: "코드" },
    {
      accessorKey: "name",
      header: "부서명",
      cell: ({ row }) => (
        <span className={row.original.type === "BUSEO" && row.original.parentId ? "pl-4" : "font-medium"}>
          {row.original.name}
        </span>
      ),
    },
    { accessorKey: "type", header: "유형", filterFn: "equalsString", cell: ({ row }) => row.original.typeLabel },
    { accessorKey: "parentName", header: "상위 국소" },
    {
      id: "counts",
      header: "연결된 활성 항목",
      enableSorting: false,
      cell: ({ row }) => {
        const r = row.original;
        const parts = [
          r.childCount ? `하위 ${r.childCount}` : null,
          r.userCount ? `사용자 ${r.userCount}` : null,
          r.commCount ? `위원회 ${r.commCount}` : null,
        ].filter(Boolean);
        return <span className="text-muted-foreground">{parts.join(" · ") || "-"}</span>;
      },
    },
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
        searchPlaceholder="부서명·국소명 검색"
        filters={[
          { columnId: "type", label: "유형", options: TYPE_OPTIONS },
          { columnId: "activeValue", label: "상태", options: ACTIVE_FILTER_OPTIONS, defaultValue: "Y" },
        ]}
        toolbar={<Button onClick={() => setEditing("new")}>부서 등록</Button>}
      />

      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={current ? "부서 수정" : "부서 등록"}
        action={current ? updateDept : createDept}
      >
        <DeptFormFields current={current} guksoOptions={guksoOptions} />
      </FormDialog>

      {toggling && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setToggling(null)}
          title={toggling.active ? "부서 비활성화" : "부서 다시 활성화"}
          description={
            toggling.active ? (
              <p>
                <b>{toggling.name}</b>을(를) 비활성화합니다. 활성 하위 부서·사용자·위원회가 남아 있으면 비활성화할 수
                없습니다.
              </p>
            ) : (
              <p>
                <b>{toggling.name}</b>을(를) 다시 활성화합니다.
              </p>
            )
          }
          confirmLabel={toggling.active ? "비활성화" : "활성화"}
          destructive={toggling.active}
          onConfirm={() => setDeptActive(toggling.id, !toggling.active)}
        />
      )}
    </>
  );
}

/** 부서 입력칸. 국소를 고르면 상위 부서 선택을 막는다 */
function DeptFormFields({ current, guksoOptions }: { current: DeptRow | null; guksoOptions: Option[] }) {
  const [type, setType] = useState<string>(current?.type ?? "BUSEO");
  const [parent, setParent] = useState<string>(current?.parentId ?? NONE);
  const parentOptions = [
    { value: NONE, label: "없음 (사업소)" },
    ...guksoOptions.filter((o) => o.value !== current?.id),
  ];

  return (
    <>
      {current && <input type="hidden" name="id" value={current.id} />}
      <FormField name="dept_name" label="부서명">
        <Input id="dept_name" name="dept_name" defaultValue={current?.name} required autoFocus />
      </FormField>
      <FormField name="dept_type" label="부서유형">
        <SelectField
          name="dept_type"
          value={type}
          onValueChange={(v) => {
            setType(v);
            if (v === "GUKSO") setParent(NONE);
          }}
          options={TYPE_OPTIONS}
        />
      </FormField>
      <FormField
        name="parentdept_id"
        label="상위 국소"
        hint={type === "GUKSO" ? "국소는 상위 부서가 없습니다." : "상위 국소가 없으면 사업소로 분류합니다."}
      >
        {type === "GUKSO" ? (
          <>
            <input type="hidden" name="parentdept_id" value={NONE} />
            <Input disabled value="없음" />
          </>
        ) : (
          <SelectField name="parentdept_id" value={parent} onValueChange={setParent} options={parentOptions} />
        )}
      </FormField>
    </>
  );
}
