"use client";

/** 위원회 상세의 수정·비활성화·승인 버튼 (편집 권한이 있을 때만 화면에 나온다. 서버도 다시 확인한다) */
import { useState } from "react";
import { ConfirmDialog } from "@/components/form/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { CommStatus } from "@/lib/rules/comm-rules";
import { approveComm, setCommActive } from "../actions";
import { CommFormDialog, type CommEditPayload, type CommFormOptions } from "../comm-form";

export function CommDetailActions({
  isAdmin,
  status,
  formOptions,
  current,
  currentLabels,
  name,
  memberCount,
}: {
  isAdmin: boolean;
  status: CommStatus;
  formOptions: CommFormOptions;
  current: CommEditPayload;
  currentLabels: { dept?: string; manager?: string };
  name: string;
  memberCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [approving, setApproving] = useState(false);
  const active = status !== "INACTIVE";

  return (
    <div className="flex gap-2">
      {isAdmin && status === "PENDING" && <Button onClick={() => setApproving(true)}>승인</Button>}
      <Button variant="outline" onClick={() => setEditing(true)}>
        수정
      </Button>
      <Button variant="outline" onClick={() => setToggling(true)}>
        {active ? "비활성화" : "활성화"}
      </Button>

      <CommFormDialog
        open={editing}
        onOpenChange={setEditing}
        current={current}
        currentLabels={currentLabels}
        options={formOptions}
      />
      <ConfirmDialog
        open={toggling}
        onOpenChange={setToggling}
        title={active ? "위원회 비활성화" : "위원회 다시 활성화"}
        description={
          active ? (
            <>
              <p>
                <b>{name}</b>을(를) 비활성화(폐지)합니다. 통계와 중복위촉 집계에서 빠집니다.
              </p>
              {memberCount > 0 && (
                <p className="mt-2">재임 중인 위원 {memberCount}명의 위촉 기록은 그대로 남습니다.</p>
              )}
            </>
          ) : (
            <p>
              <b>{name}</b>을(를) 다시 활성화합니다.
            </p>
          )
        }
        confirmLabel={active ? "비활성화" : "활성화"}
        destructive={active}
        onConfirm={() => setCommActive(current.id, !active)}
      />
      <ConfirmDialog
        open={approving}
        onOpenChange={setApproving}
        title="위원회 승인"
        description={
          <p>
            <b>{name}</b>을(를) 승인합니다. 승인하면 통계 등 집계에 포함됩니다.
          </p>
        }
        confirmLabel="승인"
        onConfirm={() => approveComm(current.id)}
      />
    </div>
  );
}
