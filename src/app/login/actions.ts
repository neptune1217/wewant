"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth, INACTIVE_ACCOUNT_MESSAGE } from "@/lib/auth";

export type LoginState = { error: string | null; loginId: string };

const LoginSchema = z.object({
  loginId: z.string().trim().min(1, "아이디를 입력하세요."),
  password: z.string().min(1, "비밀번호를 입력하세요."),
});

const WRONG_CREDENTIALS = "아이디 또는 비밀번호가 올바르지 않습니다.";

/**
 * 로그인 처리. 로그인 전이므로 권한 확인 대상이 아니다 (permissions.ts 규칙의 유일한 예외).
 * 비활성 계정 차단과 로그인 기록은 src/lib/auth.ts의 세션 생성 훅이 맡는다.
 */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    loginId: formData.get("loginId"),
    password: formData.get("password"),
  });
  const loginId = String(formData.get("loginId") ?? "");
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? WRONG_CREDENTIALS, loginId };
  }

  try {
    await auth.api.signInUsername({
      body: { username: parsed.data.loginId, password: parsed.data.password },
      headers: await headers(),
    });
  } catch (e) {
    if (e instanceof APIError && e.status === "FORBIDDEN" && e.message === INACTIVE_ACCOUNT_MESSAGE) {
      return { error: INACTIVE_ACCOUNT_MESSAGE, loginId };
    }
    if (e instanceof APIError) return { error: WRONG_CREDENTIALS, loginId };
    throw e;
  }

  // 최초 비밀번호 변경이 필요하면 requireUser()가 변경 화면으로 보낸다
  redirect("/");
}
