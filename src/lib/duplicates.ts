/**
 * 중복위촉 조회 (서버 전용). 계산 규칙은 `rules/duplicate-rules.ts`.
 * 다른 위원회 정보는 위원회명·소관부서·담당자·위원회 내 직위·위촉유형·임기까지만 꺼낸다.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { APPOINT_TYPE_LABEL } from "@/lib/enum-labels";
import {
  appointedCommCount,
  dupIconLabel,
  isCountedDupAppoint,
  isDuplicateWarn,
  type DupAppoint,
} from "@/lib/rules/duplicate-rules";
import { formatDate } from "@/lib/rules/term";

/** 재임 중인 위촉 건 한 줄 (최소 정보) */
export type DupAppointRow = {
  commId: string;
  commName: string;
  deptName: string;
  mngUserName: string;
  apposName: string;
  type: DupAppoint["type"];
  typeLabel: string;
  start: string;
  expireDue: string | null;
  /** 위촉직 건수에 들어가는지 (아니면 사유) */
  counted: boolean;
  excludeReason: string | null;
};

/** 경고 아이콘에 넘길 요약 */
export type DupSummary = {
  count: number;
  warn: boolean;
  label: string;
  /** 건수에 들어간 위원회명 */
  commNames: string[];
};

/** 여러 인물의 재임 중 위촉 건 (모든 위원회) */
export async function getActiveAppointRows(personIds: string[]): Promise<Map<string, DupAppointRow[]>> {
  const out = new Map<string, DupAppointRow[]>();
  if (!personIds.length) return out;
  const rows = await prisma.tB_Appoint.findMany({
    where: { appoint_activ: true, pos: { person_id: { in: personIds } } },
    select: {
      appoint_type: true,
      appoint_start: true,
      expire_due: true,
      pos: { select: { person_id: true } },
      appos: { select: { appos_name: true } },
      comm: {
        select: {
          comm_id: true,
          comm_name: true,
          comm_activ: true,
          comm_approved: true,
          dept: { select: { dept_name: true } },
          mng_user: { select: { user_name: true } },
        },
      },
    },
    orderBy: [{ comm: { comm_name: "asc" } }, { appoint_start: "asc" }],
  });
  for (const r of rows) {
    const lite = toLite(r.pos.person_id, r.comm.comm_id, r.appoint_type, r.comm.comm_activ, r.comm.comm_approved);
    const counted = isCountedDupAppoint(lite);
    const list = out.get(r.pos.person_id) ?? [];
    list.push({
      commId: r.comm.comm_id,
      commName: r.comm.comm_name,
      deptName: r.comm.dept.dept_name,
      mngUserName: r.comm.mng_user.user_name,
      apposName: r.appos.appos_name,
      type: r.appoint_type,
      typeLabel: APPOINT_TYPE_LABEL[r.appoint_type],
      start: formatDate(r.appoint_start),
      expireDue: r.expire_due ? formatDate(r.expire_due) : null,
      counted,
      excludeReason: counted
        ? null
        : r.appoint_type !== "APPOINTED"
          ? "당연직"
          : !r.comm.comm_activ
            ? "비활성 위원회"
            : "승인 대기 위원회",
    });
    out.set(r.pos.person_id, list);
  }
  return out;
}

/** 재임 중 건 목록 → 아이콘 요약 */
export function summarize(rows: DupAppointRow[]): DupSummary {
  const countedNames = [...new Set(rows.filter((r) => r.counted).map((r) => r.commName))];
  const count = countedNames.length;
  return { count, warn: isDuplicateWarn(count), label: dupIconLabel(count), commNames: countedNames };
}

/** 여러 인물의 중복위촉 요약 (명부·검색 결과용) */
export async function getDupSummaries(personIds: string[]): Promise<Map<string, DupSummary>> {
  const rows = await getActiveAppointRows(personIds);
  const out = new Map<string, DupSummary>();
  for (const id of personIds) out.set(id, summarize(rows.get(id) ?? []));
  return out;
}

/** 한 인물의 지금 위촉직 건수 (신규 위촉 경고용) */
export async function currentAppointedCount(personId: string): Promise<number> {
  const rows = await prisma.tB_Appoint.findMany({
    where: { appoint_activ: true, pos: { person_id: personId } },
    select: { appoint_type: true, comm: { select: { comm_id: true, comm_activ: true, comm_approved: true } } },
  });
  return appointedCommCount(
    rows.map((r) => toLite(personId, r.comm.comm_id, r.appoint_type, r.comm.comm_activ, r.comm.comm_approved)),
    personId,
  );
}

function toLite(
  personId: string,
  commId: string,
  type: DupAppoint["type"],
  commActive: boolean,
  commApproved: boolean,
): DupAppoint {
  return { personId, commId, type, active: true, commActive, commApproved };
}
