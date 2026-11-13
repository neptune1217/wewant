"use client";

/** 열람 권한이 없을 때: 현재 요청 상태와 "열람 요청" 대화상자 */
import { useState } from "react";
import { AccessStatusBadge } from "@/components/access-status-badge";
import { FieldError, FormDialog } from "@/components/form/form-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AccessStatusKind } from "@/lib/rules/access-rules";
import { requestAccess } from "./access-actions";

const GUIDE: Record<AccessStatusKind, string> = {
  NONE: "열람이 필요하면 사유를 적어 요청하세요. 담당자가 기간을 정해 승인하면 그 기간 동안 읽기 전용으로 볼 수 있습니다.",
  PENDING: "열람 요청이 처리 대기 중입니다. 담당자가 승인하면 볼 수 있습니다.",
  REJECTED: "열람 요청이 거절되었습니다. 필요하면 다시 요청할 수 있습니다.",
  EXPIRED: "열람 기간이 끝났습니다. 다시 보려면 새로 요청하세요.",
  APPROVED: "",
};

export function AccessRequestPanel({
  commId,
  commName,
  kind,
  viewUntil,
  canRequest,
}: {
  commId: string;
  commName: string;
  kind: AccessStatusKind;
  viewUntil: string | null;
  canRequest: boolean;
}) {
  const [open, setOpen] = useState(false);
  const requestable = canRequest && kind !== "PENDING" && kind !== "APPROVED";

  return (
    <div className="flex w-full max-w-xl flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <span className="font-medium">열람 요청</span>
        <AccessStatusBadge kind={kind} viewUntil={viewUntil} />
      </div>
      <p className="text-sm text-muted-foreground">
        {kind === "EXPIRED" && viewUntil ? `열람 기간(${viewUntil}까지)이 끝났습니다. 다시 보려면 새로 요청하세요.` : GUIDE[kind]}
      </p>
      {requestable && (
        <div>
          <Button onClick={() => setOpen(true)}>{kind === "NONE" ? "열람 요청" : "다시 요청"}</Button>
        </div>
      )}
      {open && (
        <FormDialog
          open
          onOpenChange={(o) => !o && setOpen(false)}
          title={`열람 요청 — ${commName}`}
          description="담당자가 열람 기간(일)을 정해 승인합니다. 열람 중에도 수정은 할 수 없습니다."
          action={requestAccess}
          submitLabel="요청"
        >
          <input type="hidden" name="comm_id" value={commId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="req_reason">요청 사유</Label>
            <textarea
              id="req_reason"
              name="req_reason"
              required
              maxLength={200}
              rows={3}
              className="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              placeholder="예: 위원 중복 위촉 여부 확인"
            />
            <FieldError name="req_reason" />
          </div>
        </FormDialog>
      )}
    </div>
  );
}
