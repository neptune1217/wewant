"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuditAction } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/permissions";

export type ChangePasswordState = { error: string | null };

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "현재 비밀번호를 입력하세요."),
    newPassword: z
      .string()
      .min(8, "새 비밀번호는 8자 이상이어야 합니다.")
      .max(128, "새 비밀번호는 128자 이하여야 합니다."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "새 비밀번호 확인이 일치하지 않습니다.",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "새 비밀번호는 현재 비밀번호와 달라야 합니다.",
  });

/** 본인 비밀번호 변경. 성공하면 다른 기기의 로그인은 모두 끊는다. */
export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUser({ allowPendingPasswordChange: true });

  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." };

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch (e) {
    if (e instanceof APIError) {
      return {
        error:
          e.body?.code === "INVALID_PASSWORD"
            ? "현재 비밀번호가 올바르지 않습니다."
            : "비밀번호를 바꾸지 못했습니다. 다시 시도하세요.",
      };
    }
    throw e;
  }

  await prisma.$transaction([
    prisma.tB_User.update({ where: { id: user.userId }, data: { must_change_pw: false } }),
    prisma.tB_AuditLog.create({
      data: {
        user_id: user.userId,
        action: AuditAction.UPDATE,
        target_table: "TB_User",
        target_id: user.userId,
        detail: { changed: "password", first_login: user.mustChangePw },
      },
    }),
  ]);

  redirect("/");
}
