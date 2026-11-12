import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/permissions";
import { UsersTable, type UserRow } from "./users-table";

export const metadata: Metadata = { title: "사용자 관리 | 춘천시 위원회·위원 통합관리" };

export default async function UsersPage() {
  const me = await requireAdminPage();

  const [users, depts, auths] = await Promise.all([
    prisma.tB_User.findMany({
      orderBy: { id: "asc" },
      include: { dept: { include: { parent: true } }, auth: true },
    }),
    prisma.tB_Dept.findMany({ where: { dept_activ: true }, include: { parent: true } }),
    prisma.tB_Auth.findMany({ orderBy: { auth_id: "asc" } }),
  ]);

  const deptLabel = (d: { dept_name: string; parent: { dept_name: string } | null }) =>
    d.parent ? `${d.parent.dept_name} > ${d.dept_name}` : d.dept_name;

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    loginId: u.login_id,
    name: u.user_name,
    deptId: u.dept_id,
    deptLabel: deptLabel(u.dept),
    phone: u.phone,
    authId: u.auth_id,
    authName: u.auth.auth_name,
    active: u.user_activ,
    activeValue: u.user_activ ? "Y" : "N",
    mustChangePw: u.must_change_pw,
    lastLoginAt: u.last_login_at
      ? u.last_login_at.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
      : "",
    isMe: u.id === me.userId,
  }));

  const deptOptions = depts
    .map((d) => ({ value: d.dept_id, label: deptLabel(d) }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
  const authOptions = auths.map((a) => ({ value: a.auth_id, label: a.auth_name }));

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">사용자 관리</h1>
        <p className="text-sm text-muted-foreground">
          계정을 발급하면 임시 비밀번호가 한 번만 표시됩니다. 담당자에게 전달하면 첫 로그인 때 바꾸게 됩니다.
        </p>
      </div>
      <UsersTable rows={rows} deptOptions={deptOptions} authOptions={authOptions} />
    </section>
  );
}
