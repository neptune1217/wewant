"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import type { DataColumn } from "@/components/data-table/data-table-features";
import { ConfirmDialog } from "@/components/form/confirm-dialog";
import { FormDialog } from "@/components/form/form-dialog";
import { FormField, SelectField } from "@/components/form/form-field";
import { ACTIVE_FILTER_OPTIONS, StatusBadge } from "@/components/form/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createUser,
  resetUserPassword,
  setUserActive,
  updateUser,
  type TempPasswordResult,
} from "./actions";

export type UserRow = {
  id: string;
  loginId: string;
  name: string;
  deptId: string;
  deptLabel: string;
  phone: string;
  authId: string;
  authName: string;
  active: boolean;
  activeValue: "Y" | "N";
  mustChangePw: boolean;
  lastLoginAt: string;
  isMe: boolean;
};

type Option = { value: string; label: string };

export function UsersTable({
  rows,
  deptOptions,
  authOptions,
}: {
  rows: UserRow[];
  deptOptions: Option[];
  authOptions: Option[];
}) {
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);
  const [toggling, setToggling] = useState<UserRow | null>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [issued, setIssued] = useState<TempPasswordResult | null>(null);

  const columns: DataColumn<UserRow>[] = [
    { accessorKey: "loginId", header: "아이디" },
    {
      accessorKey: "name",
      header: "이름",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5">
          {row.original.name}
          {row.original.isMe && <Badge variant="outline">나</Badge>}
        </span>
      ),
    },
    { accessorKey: "deptLabel", header: "부서" },
    { accessorKey: "phone", header: "내선" },
    { accessorKey: "authId", header: "권한", filterFn: "equalsString", cell: ({ row }) => row.original.authName },
    {
      accessorKey: "lastLoginAt",
      header: "마지막 로그인",
      cell: ({ row }) =>
        row.original.mustChangePw ? (
          <span className="text-muted-foreground">첫 로그인 전</span>
        ) : (
          row.original.lastLoginAt || "-"
        ),
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
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
              수정
            </Button>
            {!r.isMe && r.active && (
              <Button size="sm" variant="ghost" onClick={() => setResetting(r)}>
                비밀번호 초기화
              </Button>
            )}
            {!r.isMe && (
              <Button size="sm" variant="ghost" onClick={() => setToggling(r)}>
                {r.active ? "비활성화" : "활성화"}
              </Button>
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
        searchPlaceholder="아이디·이름·부서 검색"
        filters={[
          { columnId: "authId", label: "권한", options: authOptions },
          { columnId: "activeValue", label: "상태", options: ACTIVE_FILTER_OPTIONS, defaultValue: "Y" },
        ]}
        toolbar={<Button onClick={() => setEditing("new")}>사용자 등록</Button>}
      />

      <FormDialog<TempPasswordResult | undefined>
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={current ? "사용자 수정" : "사용자 등록"}
        description={current ? undefined : "등록하면 임시 비밀번호가 한 번만 표시됩니다."}
        action={current ? updateUser : createUser}
        onSuccess={(r) => r.data && setIssued(r.data)}
      >
        {current && <input type="hidden" name="id" value={current.id} />}
        <FormField
          name="login_id"
          label="아이디"
          hint={current ? "아이디는 바꿀 수 없습니다." : "영문 소문자·숫자·밑줄·점, 3~30자"}
        >
          <Input
            id="login_id"
            name="login_id"
            defaultValue={current?.loginId}
            disabled={!!current}
            required
            autoFocus={!current}
            autoComplete="off"
          />
        </FormField>
        <FormField name="user_name" label="이름">
          <Input id="user_name" name="user_name" defaultValue={current?.name} required />
        </FormField>
        <FormField name="dept_id" label="부서">
          <SelectField
            name="dept_id"
            defaultValue={current?.deptId}
            options={
              current && !deptOptions.some((o) => o.value === current.deptId)
                ? [{ value: current.deptId, label: `${current.deptLabel} (비활성)` }, ...deptOptions]
                : deptOptions
            }
            placeholder="부서 선택"
          />
        </FormField>
        <FormField name="phone" label="내선번호 (4자리)">
          <Input id="phone" name="phone" defaultValue={current?.phone} inputMode="numeric" maxLength={4} required />
        </FormField>
        <FormField
          name="auth_id"
          label="권한"
          hint={current?.isMe ? "본인의 총괄 권한은 내릴 수 없습니다." : undefined}
        >
          <SelectField name="auth_id" defaultValue={current?.authId ?? "r02"} options={authOptions} />
        </FormField>
      </FormDialog>

      {toggling && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setToggling(null)}
          title={toggling.active ? "사용자 비활성화" : "사용자 다시 활성화"}
          description={
            toggling.active ? (
              <p>
                <b>{toggling.name}</b>({toggling.loginId}) 계정을 비활성화합니다. 바로 로그인할 수 없게 되고, 로그인
                중이면 끊어집니다.
              </p>
            ) : (
              <p>
                <b>{toggling.name}</b>({toggling.loginId}) 계정을 다시 활성화합니다.
              </p>
            )
          }
          confirmLabel={toggling.active ? "비활성화" : "활성화"}
          destructive={toggling.active}
          onConfirm={() => setUserActive(toggling.id, !toggling.active)}
        />
      )}

      {resetting && (
        <ConfirmDialog<TempPasswordResult>
          open
          onOpenChange={(o) => !o && setResetting(null)}
          title="비밀번호 초기화"
          description={
            <p>
              <b>{resetting.name}</b>({resetting.loginId})의 비밀번호를 새 임시 비밀번호로 바꿉니다. 기존 로그인은 모두
              끊기고, 다음 로그인 때 비밀번호를 바꾸게 됩니다.
            </p>
          }
          confirmLabel="초기화"
          destructive
          onConfirm={() => resetUserPassword(resetting.id)}
          onSuccess={(r) => r.data && setIssued(r.data)}
        />
      )}

      <TempPasswordDialog result={issued} onClose={() => setIssued(null)} />
    </>
  );
}

/** 임시 비밀번호를 한 번만 보여 주는 창 */
function TempPasswordDialog({ result, onClose }: { result: TempPasswordResult | null; onClose: () => void }) {
  return (
    <Dialog open={!!result} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>임시 비밀번호</DialogTitle>
          <DialogDescription>
            이 창을 닫으면 다시 볼 수 없습니다. 담당자에게 전달하세요. 첫 로그인 때 비밀번호를 바꾸게 됩니다.
          </DialogDescription>
        </DialogHeader>
        {result && (
          <dl className="grid grid-cols-[6rem_1fr] gap-y-2 rounded-md border p-4 text-sm">
            <dt className="text-muted-foreground">이름</dt>
            <dd>{result.userName}</dd>
            <dt className="text-muted-foreground">아이디</dt>
            <dd className="font-mono">{result.loginId}</dd>
            <dt className="text-muted-foreground">임시 비밀번호</dt>
            <dd className="font-mono text-base font-semibold tracking-wider">{result.tempPassword}</dd>
          </dl>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={async () => {
              if (!result) return;
              try {
                await navigator.clipboard.writeText(result.tempPassword);
                toast.success("임시 비밀번호를 복사했습니다.");
              } catch {
                toast.error("복사하지 못했습니다. 직접 옮겨 적으세요.");
              }
            }}
          >
            복사
          </Button>
          <Button onClick={onClose}>확인했습니다</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
