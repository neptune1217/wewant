"use client";

/** 위원 명부 — 재임/해촉, 소속직위, 위원회 내 직위, 위촉유형·구분, 위촉일, 만료 예정일, D-day, 연임횟수 */
import { useState } from "react";
import { DupWarningIcon, type DupWarningInfo } from "@/components/dup-warning-icon";
import { DataTable } from "@/components/data-table/data-table";
import type { DataColumn } from "@/components/data-table/data-table-features";
import { FormDialog } from "@/components/form/form-dialog";
import { FormField, SelectField } from "@/components/form/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, nextTermDates, parseDate } from "@/lib/rules/term";
import { cn } from "@/lib/utils";
import { changeAffiliation, changeApposition, dismissAppoint, reappoint } from "./appoint-actions";
import { NewAppointDialog, PositionPicker } from "./new-appoint-dialog";
import { updatePerson, type PersonHit } from "./person-actions";
import { PersonFields, type PersonValues } from "./person-fields";

type Option = { value: string; label: string };

export type RosterOptions = {
  commId: string;
  commActive: boolean;
  termYr: number;
  reappointNum: number;
  memberCap: number;
  /** 오늘 (YYYY-MM-DD, 한국 시간) */
  today: string;
  apposOptions: Option[];
};

export type RosterRow = {
  appointId: string;
  personId: string;
  name: string;
  genderLabel: string;
  birthYear: string;
  isPublic: boolean;
  posId: string;
  posLabel: string;
  apposId: string;
  apposName: string;
  type: "EX_OFFICIO" | "APPOINTED";
  typeLabel: string;
  kindLabel: string;
  start: string;
  expireDue: string | null;
  end: string | null;
  endReasonLabel: string | null;
  active: boolean;
  /** 필터용: Y 재임 중 / N 해촉 */
  activeValue: "Y" | "N";
  dday: number | null;
  reappointCount: number;
  /** 중복위촉 요약 (위촉직 4개 이상이면 경고 아이콘) */
  dup?: DupWarningInfo;
  /** 편집 권한이 있을 때만 채운다 */
  person?: PersonHit;
  personEdit?: PersonValues;
};

function DdayBadge({ dday }: { dday: number | null }) {
  if (dday === null) return <span className="text-muted-foreground">-</span>;
  const label = dday > 0 ? `D-${dday}` : dday === 0 ? "D-day" : `만료 +${-dday}일`;
  return (
    <span
      className={cn(
        "font-mono text-xs",
        dday <= 7 ? "font-semibold text-destructive" : dday <= 30 ? "text-destructive" : dday <= 60 ? "text-amber-600" : "",
      )}
    >
      {label}
    </span>
  );
}

type Dialog =
  | { kind: "new" }
  | { kind: "dismiss" | "reappoint" | "appos" | "pos" | "person"; row: RosterRow }
  | null;

export function Roster({
  rows,
  canEdit,
  options,
}: {
  rows: RosterRow[];
  canEdit: boolean;
  options: RosterOptions | null;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = (o: boolean) => !o && setDialog(null);

  const columns: DataColumn<RosterRow>[] = [
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
        <span>
          {row.original.typeLabel}
          <span className="ml-1 text-xs text-muted-foreground">({row.original.kindLabel})</span>
        </span>
      ),
    },
    { accessorKey: "start", header: "위촉일" },
    {
      accessorKey: "expireDue",
      header: "만료 예정일",
      cell: ({ row }) =>
        row.original.active ? (
          (row.original.expireDue ?? "-")
        ) : (
          <span className="text-muted-foreground">
            {row.original.end} 해촉{row.original.endReasonLabel ? `(${row.original.endReasonLabel})` : ""}
          </span>
        ),
    },
    {
      accessorKey: "dday",
      header: "D-day",
      cell: ({ row }) => (row.original.active ? <DdayBadge dday={row.original.dday} /> : null),
    },
    {
      accessorKey: "reappointCount",
      header: "연임",
      cell: ({ row }) => (row.original.type === "APPOINTED" ? `${row.original.reappointCount}회` : "-"),
    },
    {
      accessorKey: "activeValue",
      header: "상태",
      filterFn: "equalsString",
      cell: ({ row }) =>
        row.original.active ? (
          <Badge variant="secondary">재임</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            해촉
          </Badge>
        ),
    },
    ...(canEdit
      ? [
          {
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }) => {
              const r = row.original;
              return (
                <div className="flex flex-wrap justify-end gap-1">
                  {r.active && (
                    <>
                      {r.type === "APPOINTED" && r.expireDue && (
                        <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "reappoint", row: r })}>
                          연임
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "appos", row: r })}>
                        직위 변경
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "pos", row: r })}>
                        소속직위 변경
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "dismiss", row: r })}>
                        해촉
                      </Button>
                    </>
                  )}
                  {r.personEdit && (
                    <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "person", row: r })}>
                      인물 수정
                    </Button>
                  )}
                </div>
              );
            },
          } satisfies DataColumn<RosterRow>,
        ]
      : []),
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="성명·소속직위 검색"
        filters={[
          {
            columnId: "activeValue",
            label: "상태",
            options: [
              { value: "Y", label: "재임 중" },
              { value: "N", label: "해촉" },
            ],
            defaultValue: "Y",
          },
        ]}
        emptyMessage="위원이 없습니다."
        toolbar={
          canEdit && options?.commActive ? (
            <Button onClick={() => setDialog({ kind: "new" })}>신규 위촉</Button>
          ) : undefined
        }
      />

      {options && (
        <>
          <NewAppointDialog open={dialog?.kind === "new"} onOpenChange={close} options={options} />
          {dialog && dialog.kind === "dismiss" && <DismissDialog row={dialog.row} today={options.today} onOpenChange={close} />}
          {dialog && dialog.kind === "reappoint" && (
            <ReappointDialog row={dialog.row} options={options} onOpenChange={close} />
          )}
          {dialog && dialog.kind === "appos" && (
            <ApposDialog row={dialog.row} options={options} onOpenChange={close} />
          )}
          {dialog && dialog.kind === "pos" && <AffiliationDialog row={dialog.row} onOpenChange={close} />}
          {dialog && dialog.kind === "person" && <PersonEditDialog row={dialog.row} onOpenChange={close} />}
        </>
      )}
    </>
  );
}

function DismissDialog({ row, today, onOpenChange }: { row: RosterRow; today: string; onOpenChange: (o: boolean) => void }) {
  return (
    <FormDialog open onOpenChange={onOpenChange} title={`해촉 — ${row.name}`} action={dismissAppoint} submitLabel="해촉">
      <input type="hidden" name="appoint_id" value={row.appointId} />
      <p className="text-sm text-muted-foreground">
        위촉일 {row.start}
        {row.expireDue ? ` · 만료 예정일 ${row.expireDue}` : ""}. 위촉 기록은 지워지지 않고 &quot;해촉&quot;으로 남습니다.
      </p>
      <FormField name="appoint_end" label="해촉일">
        <Input id="appoint_end" name="appoint_end" type="date" defaultValue={today} required />
      </FormField>
      <FormField name="end_reason" label="사유">
        <SelectField
          name="end_reason"
          defaultValue="RESIGNED"
          options={[
            { value: "EXPIRED", label: "임기만료" },
            { value: "RESIGNED", label: "사임" },
            { value: "DISMISSED", label: "해촉" },
            { value: "ETC", label: "기타" },
          ]}
        />
      </FormField>
    </FormDialog>
  );
}

function ReappointDialog({
  row,
  options,
  onOpenChange,
}: {
  row: RosterRow;
  options: RosterOptions;
  onOpenChange: (o: boolean) => void;
}) {
  const next = row.expireDue ? nextTermDates(parseDate(row.expireDue), options.termYr) : null;
  return (
    <FormDialog open onOpenChange={onOpenChange} title={`연임 — ${row.name}`} action={reappoint} submitLabel="연임">
      <input type="hidden" name="appoint_id" value={row.appointId} />
      <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
        <dt className="text-muted-foreground">현재 임기</dt>
        <dd>
          {row.start} ~ {row.expireDue}
        </dd>
        <dt className="text-muted-foreground">새 임기</dt>
        <dd className="font-medium">
          {next && "start" in next ? `${formatDate(next.start)} ~ ${formatDate(next.expireDue)}` : "-"}
        </dd>
        <dt className="text-muted-foreground">연임횟수</dt>
        <dd>
          지금까지 {row.reappointCount}회 → 이번이 {row.reappointCount + 1}회째 (가능 {options.reappointNum}회)
        </dd>
      </dl>
      <p className="text-sm text-muted-foreground">
        현재 건은 만료 예정일에 &quot;임기만료&quot;로 끝나고, 다음 날부터 새 임기가 시작됩니다.
      </p>
    </FormDialog>
  );
}

function ApposDialog({
  row,
  options,
  onOpenChange,
}: {
  row: RosterRow;
  options: RosterOptions;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={`위원회 내 직위 변경 — ${row.name}`}
      description={`지금: ${row.apposName}`}
      action={changeApposition}
      submitLabel="변경"
    >
      <input type="hidden" name="appoint_id" value={row.appointId} />
      <FormField name="appos_id" label="새 직위">
        <SelectField
          name="appos_id"
          options={options.apposOptions.filter((o) => o.value !== row.apposId)}
          placeholder="직위 선택"
        />
      </FormField>
      <FormField
        name="change_date"
        label="변경일"
        hint={`이전 건은 변경일 전날 끝나고, 새 건은 남은 임기${row.expireDue ? `(${row.expireDue}까지)` : ""}를 이어받습니다.`}
      >
        <Input id="change_date" name="change_date" type="date" defaultValue={options.today} required />
      </FormField>
    </FormDialog>
  );
}

function AffiliationDialog({ row, onOpenChange }: { row: RosterRow; onOpenChange: (o: boolean) => void }) {
  const [person, setPerson] = useState<PersonHit | undefined>(row.person);
  const [posId, setPosId] = useState("");
  if (!person) return null;
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={`소속직위 변경 — ${row.name}`}
      description={`지금: ${row.posLabel}. 이 위원회의 표시만 바뀌고, 다른 위원회의 표시는 그대로입니다.`}
      action={changeAffiliation}
      submitLabel="변경"
    >
      <input type="hidden" name="appoint_id" value={row.appointId} />
      <input type="hidden" name="pos_id" value={posId} />
      <PositionPicker
        person={person}
        value={posId}
        onChange={setPosId}
        onPersonUpdated={setPerson}
        exclude={row.posId}
      />
    </FormDialog>
  );
}

function PersonEditDialog({ row, onOpenChange }: { row: RosterRow; onOpenChange: (o: boolean) => void }) {
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={`인물 수정 — ${row.name}`}
      description="인물 정보는 모든 위원회가 함께 씁니다."
      action={updatePerson}
    >
      <input type="hidden" name="person_id" value={row.personId} />
      <PersonFields current={row.personEdit} />
    </FormDialog>
  );
}
