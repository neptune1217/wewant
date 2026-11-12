/**
 * Better Auth 서버 설정 (아이디 + 비밀번호, DB 세션)
 *
 * - 사용자 테이블은 TB_User를 그대로 쓴다. 로그인 아이디는 login_id.
 * - 공개 회원가입은 없다. 계정은 총괄담당자가 발급한다(시드·3단계 사용자 관리).
 * - 비활성 사용자(user_activ = false)는 세션을 만들 수 없다 → 로그인 거부.
 * - 로그인 성공 시 last_login_at과 TB_AuditLog(로그인)를 기록한다.
 *
 * 앱 화면·서버 동작은 이 파일 대신 src/lib/permissions.ts의 requireUser()를 쓴다.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { AuditAction } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

/** 비활성 계정 로그인 거부 시 보여 줄 문구 (로그인 화면에서도 사용) */
export const INACTIVE_ACCOUNT_MESSAGE = "사용이 중지된 계정입니다. 총괄담당자에게 문의하세요.";

export const auth = betterAuth({
  appName: "춘천시 위원회·위원 통합관리",
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // ── 테이블·필드 연결 (DB 이름은 docs/데이터모델.md 표기 유지) ──
  user: {
    modelName: "TB_User",
    fields: {
      name: "user_name",
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  session: {
    modelName: "TB_Session",
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    expiresIn: 60 * 60 * 8, // 8시간 (근무시간 기준)
    updateAge: 60 * 60, // 사용 중이면 1시간마다 연장
  },
  account: {
    modelName: "TB_Account",
    fields: {
      accountId: "account_id",
      providerId: "provider_id",
      userId: "user_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    modelName: "TB_Verification",
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  advanced: {
    database: {
      // 사용자 코드(u00001)는 DB 시퀀스가 만든다. 세션·계정 등은 무작위 UUID.
      generateId: ({ model }) => (model === "user" ? false : randomUUID()),
    },
  },

  // ── 로그인 방식 ──
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  plugins: [
    username({
      schema: { user: { fields: { username: "login_id" } } },
      displayUsername: false,
    }),
    nextCookies(), // 서버 액션에서 로그인 쿠키를 설정하기 위해 필요. 항상 마지막에 둔다.
  ],

  // 화면 밖에서 직접 호출할 수 있는 주소를 필요한 것만 남긴다.
  // (사용자 정보 변경·가입·이메일 로그인 등은 앱의 서버 동작이 권한 확인 후 처리한다)
  disabledPaths: [
    "/sign-up/email",
    "/sign-in/email",
    "/sign-in/social",
    "/is-username-available",
    "/update-user",
    "/change-email",
    "/delete-user",
    "/delete-user/callback",
    "/request-password-reset",
    "/reset-password",
    "/send-verification-email",
    "/verify-email",
    "/link-social",
    "/unlink-account",
    "/list-accounts",
    "/account-info",
    "/get-access-token",
    "/refresh-token",
    "/update-session",
  ],

  // ── 로그인 전후 처리 ──
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.tB_User.findUnique({
            where: { id: session.userId },
            select: { user_activ: true },
          });
          if (!user?.user_activ) {
            throw new APIError("FORBIDDEN", { message: INACTIVE_ACCOUNT_MESSAGE });
          }
        },
        after: async (session, ctx) => {
          // 비밀번호 변경 때도 세션이 새로 만들어지므로, 실제 로그인 요청일 때만 기록한다
          if (ctx?.path !== "/sign-in/username") return;
          await prisma.$transaction([
            prisma.tB_User.update({
              where: { id: session.userId },
              data: { last_login_at: new Date() },
            }),
            prisma.tB_AuditLog.create({
              data: {
                user_id: session.userId,
                action: AuditAction.LOGIN,
                target_table: "TB_User",
                target_id: session.userId,
                detail: {
                  ip: session.ipAddress ?? null,
                  user_agent: session.userAgent ?? null,
                },
              },
            }),
          ]);
        },
      },
    },
  },
});
