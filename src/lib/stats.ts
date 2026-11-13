/**
 * 통계 데이터 (서버 전용). 계산 규칙은 `rules/stats-rules.ts`.
 * 개인 이름 등은 화면으로 보내지 않고 집계 숫자만 돌려준다 (부서 계정: 집계 수치만).
 */
import "server-only";
import { prisma } from "@/lib/db";
import { todayKST } from "@/lib/permissions";
import { COUNTED_COMM_WHERE } from "@/lib/rules/comm-rules";
import { aggregateStats, scopeDeptIds, type StatsDept, type StatsResult } from "@/lib/rules/stats-rules";

export type ScopeOption = { value: string; label: string; group: "국소" | "부서" };

/** 범위 선택지용 부서 목록 (활성 부서만) */
export async function loadStatsDepts(): Promise<{ depts: StatsDept[]; options: ScopeOption[] }> {
  const rows = await prisma.tB_Dept.findMany({
    where: { dept_activ: true },
    select: { dept_id: true, dept_name: true, dept_type: true, parentdept_id: true, parent: { select: { dept_name: true } } },
    orderBy: { dept_id: "asc" },
  });
  const depts = rows.map<StatsDept>((r) => ({ deptId: r.dept_id, parentId: r.parentdept_id, type: r.dept_type }));
  const options = rows
    .map<ScopeOption>((r) => ({
      value: r.dept_id,
      label: r.dept_type === "GUKSO" ? r.dept_name : r.parent ? `${r.parent.dept_name} > ${r.dept_name}` : r.dept_name,
      group: r.dept_type === "GUKSO" ? "국소" : "부서",
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
  return { depts, options };
}

/** 범위(null = 전체)의 통계 */
export async function loadStats(depts: StatsDept[], deptId: string | null): Promise<StatsResult> {
  const scope = scopeDeptIds(depts, deptId);
  const comms = await prisma.tB_Comm.findMany({
    where: { ...COUNTED_COMM_WHERE, ...(scope ? { dept_id: { in: [...scope] } } : {}) },
    select: {
      comm_id: true,
      appoints: {
        where: { appoint_activ: true },
        select: {
          appoint_type: true,
          pos: { select: { person: { select: { person_id: true, person_gender: true, is_public: true, birth_date: true } } } },
        },
      },
    },
  });
  return aggregateStats(
    comms.map((c) => c.comm_id),
    comms.flatMap((c) =>
      c.appoints.map((a) => ({
        commId: c.comm_id,
        personId: a.pos.person.person_id,
        gender: a.pos.person.person_gender,
        isPublic: a.pos.person.is_public,
        type: a.appoint_type,
        birthDate: a.pos.person.birth_date,
      })),
    ),
    todayKST(),
  );
}
