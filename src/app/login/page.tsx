import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/permissions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "로그인 | 춘천시 위원회·위원 통합관리" };

export default async function LoginPage() {
  // 이미 로그인한 사용자는 홈으로 (비밀번호 변경이 필요하면 홈에서 변경 화면으로 이동)
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">위원회·위원 통합관리</CardTitle>
          <CardDescription>춘천시청 담당자 계정으로 로그인하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
          <p className="mt-6 text-xs text-muted-foreground">
            계정 발급·비밀번호 초기화는 총괄담당자에게 요청하세요. (프로토타입 · 가상 데이터)
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
