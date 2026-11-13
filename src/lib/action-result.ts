/**
 * 서버 동작(Server Action)의 공통 결과 형식과 관리자 동작 감싸개.
 */
import "server-only";
import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { PermissionError, requireAdmin, requireUser, type CurrentUser } from "@/lib/permissions";

export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export const ok = <T = undefined>(message: string, data?: T): ActionResult<T> => ({
  ok: true,
  message,
  data,
});

export const fail = (message: string, fieldErrors?: Record<string, string>): ActionResult<never> => ({
  ok: false,
  message,
  fieldErrors,
});

/** Zod 검사 실패 → 입력칸별 오류 문구 */
export function fromZodError(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fail("입력값을 확인하세요.", fieldErrors);
}

/**
 * 관리자(총괄) 전용 서버 동작 감싸개.
 * 1) 맨 먼저 requireAdmin()으로 권한을 확인하고 (CLAUDE.md 규칙 1)
 * 2) 권한 없음·중복값 오류는 화면에 보여 줄 결과로 바꾼다.
 * 로그인 화면 이동(redirect) 등 그 밖의 오류는 그대로 던진다.
 *
 * admin 폴더의 모든 서버 동작은 `return adminAction(...)`으로 시작해야 한다 (구조 검사 테스트가 확인).
 */
export async function adminAction<T>(
  fn: (actor: CurrentUser) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  return runAction(requireAdmin, fn);
}

/**
 * 로그인 사용자용 서버 동작 감싸개 (위원회 등 담당자별 권한이 있는 동작).
 * 로그인만 확인하므로, 본문에서 반드시 대상별 권한 판정(checkCommUpdate, assertPermission 등)을 해야 한다.
 * (구조 검사 테스트가 판정 함수 호출 여부를 확인)
 */
export async function userAction<T>(
  fn: (actor: CurrentUser) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  return runAction(() => requireUser(), fn);
}

async function runAction<T>(
  authorize: () => Promise<CurrentUser>,
  fn: (actor: CurrentUser) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    const actor = await authorize();
    return await fn(actor);
  } catch (e) {
    if (e instanceof PermissionError) return fail(e.message);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("이미 같은 값이 등록되어 있습니다.");
    }
    throw e;
  }
}
