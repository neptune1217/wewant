/**
 * 위원 조회 필터 (순수 함수, DB와 무관)
 *
 * 화면(/members)과 엑셀 내보내기(/members/export)가 같은 주소(URL) 조건을
 * 같은 함수(parseMemberFilter → filterMembers)로 처리한다. 그래서 화면 건수와 엑셀 행 수가 같다.
 * 열람 권한 범위는 이 함수가 아니라 서버 조회(src/lib/members.ts)가 먼저 거른다.
 */

export type MemberStatus = "ACTIVE" | "ENDED" | "ALL";
export type ReappointBucket = "0" | "1" | "2" | "3+";

export type MemberFilter = {
  /** 성명 일부 */
  name?: string;
  /** 출생연도 범위 (양 끝 포함) */
  birthFrom?: number;
  birthTo?: number;
  gender?: "MALE" | "FEMALE";
  type?: "EX_OFFICIO" | "APPOINTED";
  reappoint?: ReappointBucket;
  /** 위해촉 상태. 기본 재임 중 */
  status: MemberStatus;
  commId?: string;
  /** 위원회의 소관부서 */
  deptId?: string;
};

/** 필터에 필요한 최소 필드 */
export type MemberFilterRow = {
  appointId: string;
  commId: string;
  deptId: string;
  name: string;
  gender: "MALE" | "FEMALE";
  birthYear: number;
  type: "EX_OFFICIO" | "APPOINTED";
  active: boolean;
  reappointCount: number;
};

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

function year(v: string): number | undefined {
  if (!/^\d{4}$/.test(v)) return undefined;
  const n = Number(v);
  return n >= 1900 && n <= 2100 ? n : undefined;
}

function oneOf<T extends string>(v: string, allowed: readonly T[]): T | undefined {
  return (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

const ID_RE = /^[a-z]\d{5}$/;

/** 주소의 조건 해석. 잘못된 값은 조건이 없는 것으로 본다 */
export function parseMemberFilter(params: Params): MemberFilter {
  const f: MemberFilter = { status: oneOf(first(params.status), ["ACTIVE", "ENDED", "ALL"] as const) ?? "ACTIVE" };
  const name = first(params.name).slice(0, 30);
  if (name) f.name = name;
  let from = year(first(params.birthFrom));
  let to = year(first(params.birthTo));
  if (from !== undefined && to !== undefined && from > to) [from, to] = [to, from];
  if (from !== undefined) f.birthFrom = from;
  if (to !== undefined) f.birthTo = to;
  const gender = oneOf(first(params.gender), ["MALE", "FEMALE"] as const);
  if (gender) f.gender = gender;
  const type = oneOf(first(params.type), ["EX_OFFICIO", "APPOINTED"] as const);
  if (type) f.type = type;
  const reappoint = oneOf(first(params.reappoint), ["0", "1", "2", "3+"] as const);
  if (reappoint) f.reappoint = reappoint;
  const comm = first(params.comm);
  if (ID_RE.test(comm)) f.commId = comm;
  const dept = first(params.dept);
  if (ID_RE.test(dept)) f.deptId = dept;
  return f;
}

/** 조건 → 주소 문자열 (엑셀 내보내기 링크용). 기본값은 넣지 않는다 */
export function filterToQuery(f: MemberFilter): string {
  const q = new URLSearchParams();
  if (f.name) q.set("name", f.name);
  if (f.birthFrom !== undefined) q.set("birthFrom", String(f.birthFrom));
  if (f.birthTo !== undefined) q.set("birthTo", String(f.birthTo));
  if (f.gender) q.set("gender", f.gender);
  if (f.type) q.set("type", f.type);
  if (f.reappoint) q.set("reappoint", f.reappoint);
  if (f.status !== "ACTIVE") q.set("status", f.status);
  if (f.commId) q.set("comm", f.commId);
  if (f.deptId) q.set("dept", f.deptId);
  return q.toString();
}

function matchReappoint(count: number, bucket: ReappointBucket): boolean {
  return bucket === "3+" ? count >= 3 : count === Number(bucket);
}

/** 조건을 모두 만족하는 행만 (순서 유지) */
export function filterMembers<T extends MemberFilterRow>(rows: T[], f: MemberFilter): T[] {
  return rows.filter(
    (r) =>
      (f.status === "ALL" || (f.status === "ACTIVE" ? r.active : !r.active)) &&
      (!f.name || r.name.includes(f.name)) &&
      (f.birthFrom === undefined || r.birthYear >= f.birthFrom) &&
      (f.birthTo === undefined || r.birthYear <= f.birthTo) &&
      (!f.gender || r.gender === f.gender) &&
      (!f.type || r.type === f.type) &&
      (!f.reappoint || matchReappoint(r.reappointCount, f.reappoint)) &&
      (!f.commId || r.commId === f.commId) &&
      (!f.deptId || r.deptId === f.deptId),
  );
}

export const STATUS_LABEL: Record<MemberStatus, string> = { ACTIVE: "재임 중", ENDED: "해촉", ALL: "전체" };
export const REAPPOINT_LABEL: Record<ReappointBucket, string> = { "0": "0회", "1": "1회", "2": "2회", "3+": "3회 이상" };
const GENDER: Record<"MALE" | "FEMALE", string> = { MALE: "남", FEMALE: "여" };
const TYPE: Record<"EX_OFFICIO" | "APPOINTED", string> = { EX_OFFICIO: "당연직", APPOINTED: "위촉직" };

/** 조건 설명 (이력·엑셀 둘째 시트용). 위원회·부서는 이름을 받아 쓴다 */
export function filterToLabel(f: MemberFilter, names: { commName?: string; deptName?: string }): string[] {
  const lines: string[] = [];
  if (f.commId) lines.push(`위원회: ${names.commName ?? f.commId}`);
  if (f.deptId) lines.push(`부서: ${names.deptName ?? f.deptId}`);
  if (f.name) lines.push(`성명: "${f.name}" 포함`);
  if (f.birthFrom !== undefined || f.birthTo !== undefined) {
    lines.push(
      f.birthFrom !== undefined && f.birthTo !== undefined
        ? `출생연도: ${f.birthFrom}~${f.birthTo}년`
        : f.birthFrom !== undefined
          ? `출생연도: ${f.birthFrom}년 이후`
          : `출생연도: ${f.birthTo}년 이전`,
    );
  }
  if (f.gender) lines.push(`성별: ${GENDER[f.gender]}`);
  if (f.type) lines.push(`위촉유형: ${TYPE[f.type]}`);
  if (f.reappoint) lines.push(`연임횟수: ${REAPPOINT_LABEL[f.reappoint]}`);
  lines.push(`위해촉 상태: ${STATUS_LABEL[f.status]}`);
  return lines;
}
