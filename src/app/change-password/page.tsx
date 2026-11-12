import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/logout-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/permissions";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "비밀번호 변경 | 춘천시 위원회·위원 통합관리" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPendingPasswordChange: true });

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">비밀번호 변경</CardTitle>
          <CardDescription>
            {user.mustChangePw
              ? `${user.name}님, 처음 로그인하셨습니다. 계속하려면 비밀번호를 바꿔 주세요.`
              : "새 비밀번호를 입력하세요. 바꾸면 다른 기기의 로그인은 끊어집니다."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ChangePasswordForm />
          <div className="flex justify-between text-sm">
            {!user.mustChangePw ? (
              <Link href="/me" className="text-muted-foreground underline-offset-4 hover:underline">
                취소
              </Link>
            ) : (
              <span />
            )}
            <form action={logoutAction}>
              <Button type="submit" variant="link" size="sm" className="h-auto p-0 text-muted-foreground">
                로그아웃
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
