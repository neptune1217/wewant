/**
 * 변경 이력(TB_AuditLog) 기록 — 생성·수정·삭제(비활성화)·내보내기 (CLAUDE.md 규칙 9)
 * 반드시 데이터 변경과 같은 트랜잭션 안에서 부른다.
 */
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { AuditAction } from "@/generated/prisma/enums";

type Tx = Prisma.TransactionClient;
type Row = Record<string, unknown>;

/** 이력에 남기지 않을 자동 관리 필드 */
const IGNORED = new Set(["created_at", "updated_at"]);

/** Date 등을 JSON에 넣을 수 있는 값으로 바꾸고 자동 관리 필드를 뺀다 */
function clean(row: Row | null | undefined): Row | null {
  if (!row) return null;
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (IGNORED.has(k)) continue;
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

/** 바뀐 필드만 { 필드: [전, 후] } 형태로 */
function diff(before: Row | null, after: Row | null): Record<string, [unknown, unknown]> {
  const changes: Record<string, [unknown, unknown]> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    const b = before?.[k] ?? null;
    const a = after?.[k] ?? null;
    if (JSON.stringify(b) !== JSON.stringify(a)) changes[k] = [b, a];
  }
  return changes;
}

export async function writeAudit(
  tx: Tx,
  entry: {
    userId: string;
    action: AuditAction;
    table: string;
    targetId: string;
    before?: Row | null;
    after?: Row | null;
    /** 추가 설명 (예: 비밀번호 초기화) */
    note?: string;
    /** 내보내기 조건·행 수 등 그대로 남길 내용 (내보내기 전용) */
    detail?: Row;
  },
) {
  const before = clean(entry.before);
  const after = clean(entry.after);
  const detail =
    entry.action === AuditAction.EXPORT
      ? { ...entry.detail, ...(entry.note ? { note: entry.note } : {}) }
      : entry.action === AuditAction.CREATE
        ? { after }
        : { changes: diff(before, after), ...(entry.note ? { note: entry.note } : {}) };

  await tx.tB_AuditLog.create({
    data: {
      user_id: entry.userId,
      action: entry.action,
      target_table: entry.table,
      target_id: entry.targetId,
      detail: detail as Prisma.InputJsonValue,
    },
  });
}
