"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCurrentUser } from "@/lib/permissions";

/** 로그아웃: 로그인한 경우에만 세션을 지우고 로그인 화면으로 이동 */
export async function logoutAction() {
  if (await getCurrentUser()) {
    await auth.api.signOut({ headers: await headers() });
  }
  redirect("/login");
}
