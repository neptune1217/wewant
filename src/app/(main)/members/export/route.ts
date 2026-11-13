/**
 * 위원 조회 엑셀 내보내기 — GET /members/export?(위원 조회 화면과 같은 조건)
 *
 * - 서버에서 로그인과 열람 권한을 다시 확인한다 (화면을 거치지 않고 주소로 직접 불러도 같다)
 * - 화면과 같은 함수(loadMemberRows → parseMemberFilter → filterMembers)로 거르므로 화면 건수 = 엑셀 행 수
 * - TB_AuditLog에 "내보내기"로 조건과 행 수를 남긴다 (CLAUDE.md 규칙 9)
 */
import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { AuditAction } from "@/generated/prisma/enums";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { loadMemberRows } from "@/lib/members";
import { requireUser, todayKST } from "@/lib/permissions";
import { filterMembers, filterToLabel, filterToQuery, parseMemberFilter } from "@/lib/rules/member-filter";
import { formatDate } from "@/lib/rules/term";

const COLUMNS: { header: string; key: string; width: number }[] = [
  { header: "위원회", key: "commName", width: 24 },
  { header: "소관부서", key: "deptName", width: 14 },
  { header: "성명", key: "name", width: 10 },
  { header: "성별", key: "genderLabel", width: 6 },
  { header: "출생연도", key: "birthYear", width: 9 },
  { header: "공무원 여부", key: "isPublic", width: 10 },
  { header: "소속직위", key: "posLabel", width: 28 },
  { header: "위원회 내 직위", key: "apposName", width: 13 },
  { header: "위촉유형", key: "typeLabel", width: 9 },
  { header: "위촉 구분", key: "kindLabel", width: 9 },
  { header: "위촉일", key: "start", width: 12 },
  { header: "만료 예정일", key: "expireDue", width: 12 },
  { header: "해촉일", key: "end", width: 12 },
  { header: "종료 사유", key: "endReasonLabel", width: 10 },
  { header: "연임횟수", key: "reappointCount", width: 9 },
  { header: "상태", key: "status", width: 7 },
  { header: "위촉직 중복 수", key: "dupCount", width: 12 },
];

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const filter = parseMemberFilter(Object.fromEntries(request.nextUrl.searchParams));
  const { rows, commOptions, deptOptions } = await loadMemberRows(user);
  const result = filterMembers(rows, filter);

  const conditions = filterToLabel(filter, {
    commName: commOptions.find((o) => o.value === filter.commId)?.label,
    deptName: deptOptions.find((o) => o.value === filter.deptId)?.label,
  });
  const exportedAt = new Date();
  const exportedAtText = exportedAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  const wb = new ExcelJS.Workbook();
  wb.creator = "춘천시 위원회·위원 통합관리";
  wb.created = exportedAt;

  const sheet = wb.addWorksheet("위원 조회", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };
  for (const r of result) {
    sheet.addRow({
      ...r,
      isPublic: r.isPublic ? "예" : "아니오",
      expireDue: r.expireDue ?? "",
      end: r.end ?? "",
      endReasonLabel: r.endReasonLabel ?? "",
      status: r.active ? "재임" : "해촉",
      dupCount: r.dup.count,
    });
  }
  if (result.length) sheet.autoFilter = { from: "A1", to: { row: 1, column: COLUMNS.length } };

  const info = wb.addWorksheet("조회 조건");
  info.columns = [
    { header: "항목", key: "k", width: 14 },
    { header: "내용", key: "v", width: 60 },
  ];
  info.getRow(1).font = { bold: true };
  info.addRow({ k: "행 수", v: result.length });
  for (const line of conditions) {
    const [k, ...v] = line.split(": ");
    info.addRow({ k, v: v.join(": ") });
  }
  info.addRow({ k: "내보낸 사람", v: `${user.name} (${user.deptName})` });
  info.addRow({ k: "내보낸 일시", v: exportedAtText });
  info.addRow({ k: "범위", v: "내보낸 사람이 열람 권한을 가진 위원회의 위원만 포함" });

  const buffer = await wb.xlsx.writeBuffer();

  await prisma.$transaction((tx) =>
    writeAudit(tx, {
      userId: user.userId,
      action: AuditAction.EXPORT,
      table: "TB_Appoint",
      targetId: "위원 조회",
      detail: { query: filterToQuery(filter), conditions, rowCount: result.length },
    }),
  );

  const filename = `위원조회_${formatDate(todayKST())}.xlsx`;
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="members.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
      "X-Row-Count": String(result.length),
    },
  });
}
