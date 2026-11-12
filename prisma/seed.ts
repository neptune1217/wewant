/**
 * 예시 엑셀(가상 데이터)을 읽어 DB에 넣는 시드 스크립트.
 * 실행: npx prisma db seed   (여러 번 실행해도 같은 결과 — 고유코드 기준으로 덮어쓴다)
 *
 * 엑셀 → DB 변환 규칙 (docs/데이터모델.md 기준)
 * - y/n → true/false, 빈 칸 → null
 * - TB_Pos.person_id의 오타 u00001 → p00001
 * - TB_User.login_id는 엑셀에 없어 user_id와 같은 값으로 넣는다 (최초 로그인 시 비밀번호 변경 강제)
 * - TB_User.email은 Better Auth 필수값이라 내부용 주소(u00001@wewant.local)를 넣는다
 * - 로그인 계정(TB_Account)은 .env의 SEED_DEFAULT_PASSWORD 해시로 만든다. 이미 있으면 건드리지 않는다
 * - TB_Appoint
 *   - appoint_kind: 엑셀에 없어 모두 "신규"
 *   - expire_due: 당연직은 null, 위촉직은 "위촉일 + 위원회 임기년수 − 1일"로 다시 계산 (엑셀 종료일은 쓰지 않음)
 *   - appoint_end: 엑셀 종료일이 오늘 이전이면 실제 해촉일로 저장, 미래면(=만료 예정일) null
 *   - end_reason: 해촉일이 있으면 정보가 없으므로 "기타"
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { hashPassword } from "better-auth/crypto";
import ExcelJS from "exceljs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { AppointKind, AppointType, EndReason } from "../src/generated/prisma/enums";
import {
  APPOINT_TYPE_LABEL,
  DEPT_TYPE_LABEL,
  GENDER_LABEL,
  INST_TYPE_LABEL,
  OP_TYPE_LABEL,
  fromLabel,
} from "../src/lib/enum-labels";
import { calcExpireDue, formatDate, parseDate } from "../src/lib/rules/term";

const EXCEL_PATH = path.join(__dirname, "..", "테이블 및 필드명(예시데이터 포함).xlsx");

type Row = Record<string, ExcelJS.CellValue>;

// ───────────── 엑셀 읽기 도우미 ─────────────

/** 시트를 "첫 행 = 필드명" 기준의 객체 배열로 읽는다. 완전히 빈 행은 건너뛴다. */
function readSheet(wb: ExcelJS.Workbook, name: string): Row[] {
  const ws = wb.getWorksheet(name);
  if (!ws) throw new Error(`엑셀에 ${name} 시트가 없습니다`);
  const header = (ws.getRow(1).values as ExcelJS.CellValue[]).map((v) => String(v ?? "").trim());
  const rows: Row[] = [];
  ws.eachRow((row, rowNo) => {
    if (rowNo === 1) return;
    const obj: Row = {};
    header.forEach((key, col) => {
      if (key) obj[key] = row.getCell(col).value;
    });
    if (Object.values(obj).some((v) => v !== null && v !== undefined && v !== "")) rows.push(obj);
  });
  return rows;
}

function text(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined) return null;
  const s = (typeof v === "object" && "richText" in v ? v.richText.map((r) => r.text).join("") : String(v)).trim();
  return s === "" ? null : s;
}

function req(v: ExcelJS.CellValue, field: string): string {
  const s = text(v);
  if (s === null) throw new Error(`${field} 값이 비어 있습니다`);
  return s;
}

function yn(v: ExcelJS.CellValue, field: string): boolean {
  const s = req(v, field).toLowerCase();
  if (s === "y") return true;
  if (s === "n") return false;
  throw new Error(`${field}: y/n이 아닌 값 "${s}"`);
}

function int(v: ExcelJS.CellValue, field: string): number {
  const n = Number(req(v, field));
  if (!Number.isInteger(n)) throw new Error(`${field}: 정수가 아닌 값 "${String(v)}"`);
  return n;
}

/** 엑셀 날짜(Date 또는 일련번호) → 시간 없는 날짜(UTC 자정). 빈 칸이면 null. */
function date(v: ExcelJS.CellValue, field: string): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return parseDate(formatDate(v));
  if (typeof v === "number") return new Date(Date.UTC(1899, 11, 30) + v * 86_400_000);
  const s = text(v);
  if (s === null) return null;
  try {
    return parseDate(s);
  } catch {
    throw new Error(`${field}: 날짜가 아닌 값 "${s}"`);
  }
}

/** 오늘 날짜(한국 시간 기준)를 UTC 자정 Date로 */
function todayKST(): Date {
  return parseDate(new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10));
}

// ───────────── 시드 ─────────────

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);
  const today = todayKST();

  // 시드 계정의 첫 비밀번호 (가상 계정용 테스트 값, .env에만 둔다). 첫 로그인 때 변경을 강제한다.
  const seedPassword = process.env.SEED_DEFAULT_PASSWORD;
  if (!seedPassword || seedPassword.length < 8) {
    throw new Error(".env에 SEED_DEFAULT_PASSWORD(8자 이상)를 설정하세요");
  }
  const passwordHash = await hashPassword(seedPassword);
  let createdAccounts = 0;

  const depts = readSheet(wb, "TB_Dept").map((r) => ({
    dept_id: req(r.dept_id, "dept_id"),
    parentdept_id: text(r.parentdept_id),
    dept_name: req(r.dept_name, "dept_name"),
    dept_type: fromLabel(DEPT_TYPE_LABEL, req(r.dept_type, "dept_type"), "dept_type"),
    dept_activ: yn(r.dept_activ, "dept_activ"),
  }));
  // 상위 부서(국소)가 먼저 들어가야 하므로 parentdept_id가 없는 행을 앞으로
  depts.sort((a, b) => Number(a.parentdept_id !== null) - Number(b.parentdept_id !== null));

  const auths = readSheet(wb, "TB_Auth").map((r) => ({
    auth_id: req(r.auth_id, "auth_id"),
    auth_name: req(r.auth_name, "auth_name"),
  }));

  const users = readSheet(wb, "TB_User").map((r) => {
    const user_id = req(r.user_id, "user_id");
    return {
      id: user_id, // DB 컬럼명은 user_id (schema.prisma 참고)
      login_id: user_id,
      email: `${user_id}@wewant.local`, // Better Auth 필수값. 화면에 쓰지 않는 내부용 주소
      user_name: req(r.user_name, "user_name"),
      dept_id: req(r.dept_id, "dept_id"),
      phone: req(r.phone, "phone").padStart(4, "0"),
      auth_id: req(r.auth_id, "auth_id"),
      user_activ: yn(r.user_activ, "user_activ"),
      must_change_pw: true,
    };
  });

  const comms = readSheet(wb, "TB_Comm").map((r) => ({
    comm_id: req(r.comm_id, "comm_id"),
    comm_name: req(r.comm_name, "comm_name"),
    dept_id: req(r.dept_id, "dept_id"),
    mng_user_id: req(r.mng_user_id, "mng_user_id"),
    inst_type: fromLabel(INST_TYPE_LABEL, req(r.inst_type, "inst_type"), "inst_type"),
    legal_1: text(r.legal_1),
    legal_2: text(r.legal_2),
    op_type: fromLabel(OP_TYPE_LABEL, req(r.op_type, "op_type"), "op_type"),
    member_cap: int(r.member_cap, "member_cap"),
    term_yr: int(r.term_yr, "term_yr"),
    reappoint_num: int(r.reappoint_num, "reappoint_num"),
    comm_activ: yn(r.comm_activ, "comm_activ"),
  }));
  const termYrOf = new Map(comms.map((c) => [c.comm_id, c.term_yr]));

  const apPositions = readSheet(wb, "TB_Ap_Position").map((r) => ({
    appos_id: req(r.appos_id, "appos_id"),
    appos_name: req(r.appos_name, "appos_name"),
  }));

  const persons = readSheet(wb, "TB_Person").map((r) => ({
    person_id: req(r.person_id, "person_id"),
    person_name: req(r.person_name, "person_name"),
    person_gender: fromLabel(GENDER_LABEL, req(r.person_gender, "person_gender"), "person_gender"),
    birth_date: date(r.birth_date, "birth_date")!,
    is_public: yn(r.is_public, "is_public"),
    person_activ: yn(r.person_activ, "person_activ"),
  }));

  const positions = readSheet(wb, "TB_Pos").map((r) => ({
    pos_id: req(r.pos_id, "pos_id"),
    // 예시 엑셀의 오타 수정: u00001 → p00001
    person_id: req(r.person_id, "person_id").replace(/^u(\d{5})$/, "p$1"),
    org_name: req(r.org_name, "org_name"),
    pos_name: req(r.pos_name, "pos_name"),
    pos_activ: yn(r.pos_activ, "pos_activ"),
  }));

  const appoints = readSheet(wb, "TB_Appoint").map((r) => {
    const appoint_id = req(r.appoint_id, "appoint_id");
    const comm_id = req(r.comm_id, "comm_id");
    const appoint_type = fromLabel(APPOINT_TYPE_LABEL, req(r.appoint_type, "appoint_type"), "appoint_type");
    const appoint_start = date(r.appoint_start, "appoint_start")!;
    const excelEnd = date(r.appoint_end, "appoint_end");
    const termYr = termYrOf.get(comm_id);
    if (termYr === undefined) throw new Error(`${appoint_id}: 없는 위원회 ${comm_id}`);

    const appoint_end = excelEnd && excelEnd <= today ? excelEnd : null;
    return {
      appoint_id,
      comm_id,
      pos_id: req(r.pos_id, "pos_id"),
      appos_id: req(r.appos_id, "appos_id"),
      appoint_type,
      appoint_kind: AppointKind.NEW,
      appoint_start,
      expire_due: appoint_type === AppointType.EX_OFFICIO ? null : calcExpireDue(appoint_start, termYr),
      appoint_end,
      end_reason: appoint_end ? EndReason.ETC : null,
      appoint_activ: yn(r.appoint_activ, "appoint_activ"),
    };
  });

  await prisma.$transaction(async (tx) => {
    for (const d of depts) await tx.tB_Dept.upsert({ where: { dept_id: d.dept_id }, create: d, update: d });
    for (const a of auths) await tx.tB_Auth.upsert({ where: { auth_id: a.auth_id }, create: a, update: a });
    for (const u of users) {
      // 다시 실행할 때 must_change_pw를 되돌리지 않는다 (이미 비밀번호를 바꾼 사용자 보호)
      // (Prisma는 undefined인 필드를 바꾸지 않는다)
      await tx.tB_User.upsert({ where: { id: u.id }, create: u, update: { ...u, must_change_pw: undefined } });
      // 로그인 계정(비밀번호 해시)은 없을 때만 만든다. 이미 바꾼 비밀번호를 덮어쓰지 않는다.
      const hasCredential = await tx.tB_Account.findFirst({
        where: { user_id: u.id, provider_id: "credential" },
      });
      if (!hasCredential) {
        await tx.tB_Account.create({
          data: {
            id: randomUUID(),
            account_id: u.id,
            provider_id: "credential",
            user_id: u.id,
            password: passwordHash,
          },
        });
        createdAccounts++;
      }
    }
    for (const c of comms) await tx.tB_Comm.upsert({ where: { comm_id: c.comm_id }, create: c, update: c });
    for (const s of apPositions)
      await tx.tB_Ap_Position.upsert({ where: { appos_id: s.appos_id }, create: s, update: s });
    for (const p of persons) await tx.tB_Person.upsert({ where: { person_id: p.person_id }, create: p, update: p });
    for (const p of positions) await tx.tB_Pos.upsert({ where: { pos_id: p.pos_id }, create: p, update: p });
    for (const t of appoints)
      await tx.tB_Appoint.upsert({ where: { appoint_id: t.appoint_id }, create: t, update: t });

    // 엑셀 코드를 직접 넣었으므로 자동 채번 시퀀스를 "가장 큰 번호 다음"으로 맞춘다.
    const seqs: [string, string, string][] = [
      ["tb_dept_seq", "TB_Dept", "dept_id"],
      ["tb_user_seq", "TB_User", "user_id"],
      ["tb_comm_seq", "TB_Comm", "comm_id"],
      ["tb_ap_position_seq", "TB_Ap_Position", "appos_id"],
      ["tb_person_seq", "TB_Person", "person_id"],
      ["tb_pos_seq", "TB_Pos", "pos_id"],
      ["tb_appoint_seq", "TB_Appoint", "appoint_id"],
      ["tb_accessreq_seq", "TB_AccessReq", "req_id"],
    ];
    for (const [seq, table, col] of seqs) {
      // 고정된 이름만 쓰므로 안전하다 (사용자 입력 없음)
      await tx.$executeRawUnsafe(
        `SELECT setval('"${seq}"', COALESCE((SELECT MAX(substring("${col}" from 2)::int) FROM "${table}"), 0) + 1, false)`,
      );
    }
  });

  console.log("시드 완료:");
  console.table({
    TB_Dept: depts.length,
    TB_Auth: auths.length,
    TB_User: users.length,
    TB_Comm: comms.length,
    TB_Ap_Position: apPositions.length,
    TB_Person: persons.length,
    TB_Pos: positions.length,
    TB_Appoint: appoints.length,
  });
  console.log(`새로 만든 로그인 계정: ${createdAccounts}개 (이미 있던 계정의 비밀번호는 그대로 둠)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("시드 실패:", e);
  process.exit(1);
});
