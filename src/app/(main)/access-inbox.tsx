"use client";

/** 홈 — 처리할 열람 요청(승인·거절)과 내 열람 요청 상태 */
import Link from "next/link";
import { useState } from "react";
import { AccessStatusBadge } from "@/components/access-status-badge";
import { FieldError, FormDialog } from "@/components/form/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_VIEW_DAYS, MAX_VIEW_DAYS, MIN_VIEW_DAYS, type AccessStatusKind } from "@/lib/rules/access-rules";
import { decideAccess } from "./committees/[commId]/access-actions";

export type InboxRow = {
  reqId: string;
  commId: string;
  commName: string;
  requester: string;
  reason: string;
  reqAt: string;
};

export type MyReqRow = {
  reqId: string;
  commId: string;
  commName: string;
  reqAt: string;
  kind: AccessStatusKind;
  viewUntil: string | null;
};

type Deciding = { row: InboxRow; decision: "APPROVE" | "REJECT" } | null;

export function AccessInbox({ inbox, mine }: { inbox: InboxRow[]; mine: MyReqRow[] }) {
  const [deciding, setDeciding] = useState<Deciding>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="font-semibold">처리할 열람 요청 {inbox.length > 0 && `(${inbox.length}건)`}</h2>
        {inbox.length === 0 ? (
          <p className="text-sm text-muted-foreground">처리할 요청이 없습니다.</p>
        ) : (
          <ul className="divide-y">
            {inbox.map((r) => (
              <li key={r.reqId} className="flex flex-col gap-2 py-3 text-sm">
                <div>
                  <Link href={`/committees/${r.commId}`} className="font-medium underline-offset-4 hover:underline">
                    {r.commName}
                  </Link>
                  <span className="text-muted-foreground"> · {r.requester} · {r.reqAt}</span>
                </div>
                <p className="break-words text-muted-foreground">사유: {r.reason}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setDeciding({ row: r, decision: "APPROVE" })}>
                    승인
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDeciding({ row: r, decision: "REJECT" })}>
                    거절
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="font-semibold">내 열람 요청</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">보낸 요청이 없습니다. 다른 담당자의 위원회 상세 화면에서 요청할 수 있습니다.</p>
        ) : (
          <ul className="divide-y">
            {mine.map((r) => (
              <li key={r.reqId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <Link href={`/committees/${r.commId}`} className="underline-offset-4 hover:underline">
                    {r.commName}
                  </Link>
                  <span className="text-muted-foreground"> · {r.reqAt} 요청</span>
                </span>
                <AccessStatusBadge kind={r.kind} viewUntil={r.viewUntil} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {deciding && (
        <FormDialog
          open
          onOpenChange={(o) => !o && setDeciding(null)}
          title={`열람 ${deciding.decision === "APPROVE" ? "승인" : "거절"} — ${deciding.row.commName}`}
          description={`요청자: ${deciding.row.requester} / 사유: ${deciding.row.reason}`}
          action={decideAccess}
          submitLabel={deciding.decision === "APPROVE" ? "승인" : "거절"}
        >
          <input type="hidden" name="req_id" value={deciding.row.reqId} />
          <input type="hidden" name="decision" value={deciding.decision} />
          {deciding.decision === "APPROVE" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="view_days">열람 기간 (일)</Label>
              <Input
                id="view_days"
                name="view_days"
                type="number"
                min={MIN_VIEW_DAYS}
                max={MAX_VIEW_DAYS}
                defaultValue={DEFAULT_VIEW_DAYS}
                required
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                오늘부터 {MIN_VIEW_DAYS}~{MAX_VIEW_DAYS}일. 기간 동안 읽기 전용으로 열람하며, 끝나면 다시 요청해야 합니다.
              </p>
              <FieldError name="view_days" />
            </div>
          ) : (
            <p className="text-sm">이 열람 요청을 거절합니다. 요청자는 필요하면 다시 요청할 수 있습니다.</p>
          )}
        </FormDialog>
      )}
    </div>
  );
}
