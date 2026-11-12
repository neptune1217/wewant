"use client";

/**
 * 공통 확인 대화상자 (비활성화·다시 활성화·비밀번호 초기화 등).
 * 확인을 누르면 서버 동작을 실행하고, 실패하면 대화상자 안에 이유를 보여 준다.
 */
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { FormActionResult } from "./form-dialog";

export function ConfirmDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<FormActionResult<T>>;
  onSuccess?: (result: { message: string; data?: T }) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleOpenChange = (next: boolean) => {
    if (!next) setError(null);
    onOpenChange(next);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>취소</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await onConfirm();
                if (result.ok) {
                  handleOpenChange(false);
                  toast.success(result.message);
                  onSuccess?.(result);
                } else {
                  setError(result.message);
                }
              })
            }
          >
            {pending ? "처리 중…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
