/**
 * 통계 규칙 (순수 함수, DB와 무관)
 *
 * - 범위: 전체 / 국소(자신 + 하위 부서) / 부서. 위원회는 소관부서 기준으로 범위에 든다
 * - 세는 대상: 집계 대상 위원회(활성+승인)와 그 위원회의 재임 중 위원(위촉 건)
 * - 위원 수는 위촉 건 기준(한 사람이 두 위원회면 2), 실인원은 person_id 중복 제외
 * - 연령대는 오늘(한국 날짜) 기준 만 나이
 */

export type StatsDept = { deptId: string; parentId: string | null; type: "GUKSO" | "BUSEO" };

export type StatsMember = {
  commId: string;
  personId: string;
  gender: "MALE" | "FEMALE";
  isPublic: boolean;
  type: "EX_OFFICIO" | "APPOINTED";
  birthDate: Date;
};

export const AGE_BANDS = [
  { key: "U30", label: "30세 미만" },
  { key: "A30", label: "30대" },
  { key: "A40", label: "40대" },
  { key: "A50", label: "50대" },
  { key: "A60", label: "60대" },
  { key: "O70", label: "70세 이상" },
] as const;
export type AgeBandKey = (typeof AGE_BANDS)[number]["key"];

/** 만 나이. 2월 29일생은 평년에 3월 1일부터 한 살 더 (날짜 비교로 자연히 그렇게 된다) */
export function ageOn(birth: Date, today: Date): number {
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age--;
  return age;
}

export function ageBand(age: number): AgeBandKey {
  if (age < 30) return "U30";
  if (age < 40) return "A30";
  if (age < 50) return "A40";
  if (age < 60) return "A50";
  if (age < 70) return "A60";
  return "O70";
}

/** 주소의 dept 값 → 있는 부서코드면 그 값, 아니면 null(전체) */
export function parseStatsDept(params: Record<string, string | string[] | undefined>, depts: StatsDept[]): string | null {
  const raw = params.dept;
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return v && depts.some((x) => x.deptId === v) ? v : null;
}

/** 범위에 드는 부서코드 (null = 전체). 국소는 자신과 바로 아래 부서 */
export function scopeDeptIds(depts: StatsDept[], deptId: string | null): Set<string> | null {
  if (!deptId) return null;
  const self = depts.find((x) => x.deptId === deptId);
  if (!self) return new Set();
  if (self.type === "BUSEO") return new Set([deptId]);
  return new Set([deptId, ...depts.filter((x) => x.parentId === deptId).map((x) => x.deptId)]);
}

export type Bucket = { key: string; label: string; count: number };

export type StatsResult = {
  commCount: number;
  memberCount: number;
  personCount: number;
  gender: Bucket[];
  publicType: Bucket[];
  appointType: Bucket[];
  ageBands: Bucket[];
};

/**
 * @param commIds 범위 안 집계 대상 위원회 (위원이 없어도 센다)
 * @param members 그 위원회들의 재임 중 위원(위촉 건)
 */
export function aggregateStats(commIds: string[], members: StatsMember[], today: Date): StatsResult {
  const count = (pred: (m: StatsMember) => boolean) => members.filter(pred).length;
  const ages = members.map((m) => ageBand(ageOn(m.birthDate, today)));
  return {
    commCount: commIds.length,
    memberCount: members.length,
    personCount: new Set(members.map((m) => m.personId)).size,
    gender: [
      { key: "MALE", label: "남", count: count((m) => m.gender === "MALE") },
      { key: "FEMALE", label: "여", count: count((m) => m.gender === "FEMALE") },
    ],
    publicType: [
      { key: "PUBLIC", label: "공무원", count: count((m) => m.isPublic) },
      { key: "PRIVATE", label: "민간", count: count((m) => !m.isPublic) },
    ],
    appointType: [
      { key: "EX_OFFICIO", label: "당연직", count: count((m) => m.type === "EX_OFFICIO") },
      { key: "APPOINTED", label: "위촉직", count: count((m) => m.type === "APPOINTED") },
    ],
    ageBands: AGE_BANDS.map((b) => ({ key: b.key, label: b.label, count: ages.filter((a) => a === b.key).length })),
  };
}
