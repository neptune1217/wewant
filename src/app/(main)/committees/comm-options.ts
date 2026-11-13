/** 위원회 등록·수정 대화상자의 선택지를 서버에서 만든다 */
import "server-only";
import { prisma } from "@/lib/db";
import { isAdmin, type CurrentUser } from "@/lib/permissions";
import type { CommFormOptions } from "./comm-form";

export const deptLabel = (d: { dept_name: string; parent: { dept_name: string } | null }) =>
  d.parent ? `${d.parent.dept_name} > ${d.dept_name}` : d.dept_name;

export async function loadCommFormOptions(user: CurrentUser): Promise<CommFormOptions> {
  const admin = isAdmin(user);
  const [depts, managers] = await Promise.all([
    prisma.tB_Dept.findMany({ where: { dept_activ: true }, include: { parent: true } }),
    // 담당자 후보는 총괄에게만 필요하다 (부서 계정은 본인 고정)
    admin
      ? prisma.tB_User.findMany({
          where: { user_activ: true },
          include: { dept: true },
          orderBy: { user_name: "asc" },
        })
      : Promise.resolve([]),
  ]);
  return {
    isAdmin: admin,
    me: { id: user.userId, name: user.name },
    defaultDeptId: user.deptId,
    deptOptions: depts
      .map((d) => ({ value: d.dept_id, label: deptLabel(d) }))
      .sort((a, b) => a.label.localeCompare(b.label, "ko")),
    managerOptions: managers.map((u) => ({
      value: u.id,
      label: `${u.user_name} (${u.dept.dept_name})`,
    })),
  };
}
