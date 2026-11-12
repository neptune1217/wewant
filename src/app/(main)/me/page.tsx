import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { UserInfoNav } from "@/components/layout/user-info-nav";
import { isAdmin, requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "사용자정보 | 춘천시 위원회·위원 통합관리" };

/** 사용자정보 — 본인 정보 열람과 비밀번호 변경. 총괄에게는 관리 메뉴(사용자·부서·직위명)가 함께 보인다 */
export default async function MePage() {
  const user = await requireUser();

  const rows: [string, string][] = [
    ["아이디", user.loginId],
    ["이름", user.name],
    ["부서", user.deptName],
    ["권한", user.authName],
    ["전화(내선)", user.phone],
    [
      "마지막 로그인",
      user.lastLoginAt
        ? user.lastLoginAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
        : "-",
    ],
  ];

  return (
    <>
    <UserInfoNav isAdmin={isAdmin(user)} />
    <section className="flex max-w-lg flex-col gap-4">
      <h1 className="text-xl font-semibold">사용자정보</h1>
      <dl className="grid grid-cols-[8rem_1fr] gap-y-2 rounded-lg border p-4 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div>
        <Link href="/change-password" className={buttonVariants({ variant: "outline" })}>
          비밀번호 변경
        </Link>
      </div>
    </section>
    </>
  );
}
