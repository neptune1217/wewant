"use client";

/**
 * 공통 등록·수정 대화상자.
 * - 서버 동작(action)을 그대로 받아 실행하고, 실패하면 오류 문구와 입력칸별 오류를 보여 준다.
 * - 성공하면 대화상자를 닫고 완료 알림을 띄운다. (목록은 서버 동작의 revalidatePath로 새로고침)
 * - 입력칸 아래 오류는 <FieldError name="..."/>로 표시한다.
 */
import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type FormActionResult<T = unknown> =
  | { ok: true; message: string; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

type FormAction<T> = (prev: FormActionResult<T> | null, formData: FormData) => Promise<FormActionResult<T>>;

const FieldErrorsContext = createContext<Record<string, string>>({});

/** 입력칸 아래 오류 문구 */
export function FieldError({ name }: { name: string }) {
  const message = useContext(FieldErrorsContext)[name];
  if (!message) return null;
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

export function FormDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  action,
  submitLabel = "저장",
  onSuccess,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  action: FormAction<T>;
  submitLabel?: string;
  /** 성공 후 추가 처리 (예: 임시 비밀번호 보여 주기) */
  onSuccess?: (result: { message: string; data?: T }) => void;
  children: ReactNode;
}) {
  // 대화상자를 닫으면 내용(InnerForm)이 화면에서 빠지므로, 다시 열 때 이전 오류 없이 새로 시작한다
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <InnerForm
          action={action}
          submitLabel={submitLabel}
          onDone={(result) => {
            onOpenChange(false);
            toast.success(result.message);
            onSuccess?.(result);
          }}
          onCancel={() => onOpenChange(false)}
        >
          {children}
        </InnerForm>
      </DialogContent>
    </Dialog>
  );
}

function InnerForm<T>({
  action,
  submitLabel,
  onDone,
  onCancel,
  children,
}: {
  action: FormAction<T>;
  submitLabel: string;
  onDone: (result: { message: string; data?: T }) => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const handled = useRef<typeof state>(null);

  useEffect(() => {
    if (state?.ok && handled.current !== state) {
      handled.current = state;
      onDone(state);
    }
  }, [state, onDone]);

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="flex flex-col gap-4"
    >
      {state && !state.ok && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <FieldErrorsContext.Provider value={fieldErrors}>{children}</FieldErrorsContext.Provider>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          취소
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
