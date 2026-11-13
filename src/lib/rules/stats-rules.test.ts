import { describe, expect, it } from "vitest";
import {
  AGE_BANDS,
  ageBand,
  aggregateStats,
  ageOn,
  parseStatsDept,
  scopeDeptIds,
  type StatsDept,
  type StatsMember,
} from "./stats-rules";
import { parseDate } from "./term";

const d = parseDate;

describe("만 나이", () => {
  it("생일 전날은 아직, 생일 당일부터 한 살 더", () => {
    expect(ageOn(d("1970-11-14"), d("2026-11-13"))).toBe(55);
    expect(ageOn(d("1970-11-13"), d("2026-11-13"))).toBe(56);
  });
  it("연초·연말", () => {
    expect(ageOn(d("1990-01-01"), d("2026-12-31"))).toBe(36);
    expect(ageOn(d("1990-12-31"), d("2026-01-01"))).toBe(35);
  });
  it("2월 29일생: 평년에는 2월 28일까지 아직, 3월 1일부터 한 살 더", () => {
    expect(ageOn(d("2000-02-29"), d("2026-02-28"))).toBe(25);
    expect(ageOn(d("2000-02-29"), d("2026-03-01"))).toBe(26);
    expect(ageOn(d("2000-02-29"), d("2028-02-29"))).toBe(28);
  });
});

describe("연령대", () => {
  it("경계값", () => {
    expect(ageBand(29)).toBe("U30");
    expect(ageBand(30)).toBe("A30");
    expect(ageBand(39)).toBe("A30");
    expect(ageBand(40)).toBe("A40");
    expect(ageBand(59)).toBe("A50");
    expect(ageBand(69)).toBe("A60");
    expect(ageBand(70)).toBe("O70");
    expect(ageBand(95)).toBe("O70");
  });
  it("6개 구간 순서", () => {
    expect(AGE_BANDS.map((b) => b.label)).toEqual(["30세 미만", "30대", "40대", "50대", "60대", "70세 이상"]);
  });
});

const depts: StatsDept[] = [
  { deptId: "g1", parentId: null, type: "GUKSO" },
  { deptId: "b1", parentId: "g1", type: "BUSEO" },
  { deptId: "b2", parentId: "g1", type: "BUSEO" },
  { deptId: "g2", parentId: null, type: "GUKSO" },
  { deptId: "b3", parentId: "g2", type: "BUSEO" },
  { deptId: "s1", parentId: null, type: "BUSEO" }, // 사업소
];

describe("범위", () => {
  it("전체는 null (거르지 않음)", () => {
    expect(scopeDeptIds(depts, null)).toBeNull();
  });
  it("국소: 자신 + 하위 부서", () => {
    expect([...scopeDeptIds(depts, "g1")!].sort()).toEqual(["b1", "b2", "g1"]);
  });
  it("부서: 그 부서만", () => {
    expect([...scopeDeptIds(depts, "b3")!]).toEqual(["b3"]);
    expect([...scopeDeptIds(depts, "s1")!]).toEqual(["s1"]);
  });
  it("주소 값 해석: 있는 부서코드만, 아니면 전체", () => {
    expect(parseStatsDept({ dept: "g2" }, depts)).toBe("g2");
    expect(parseStatsDept({ dept: "zz" }, depts)).toBeNull();
    expect(parseStatsDept({}, depts)).toBeNull();
    expect(parseStatsDept({ dept: ["b1", "b2"] }, depts)).toBe("b1");
  });
});

describe("집계", () => {
  const today = d("2026-11-13");
  const m = (p: Partial<StatsMember> & Pick<StatsMember, "personId">): StatsMember => ({
    commId: "c1",
    gender: "MALE",
    isPublic: false,
    type: "APPOINTED",
    birthDate: d("1970-01-01"),
    ...p,
  });
  const members = [
    m({ personId: "p1", commId: "c1", isPublic: true, type: "EX_OFFICIO", birthDate: d("1960-05-05") }), // 66
    m({ personId: "p1", commId: "c2", isPublic: true, birthDate: d("1960-05-05") }), // 같은 사람, 다른 위원회
    m({ personId: "p2", gender: "FEMALE", birthDate: d("1999-01-01") }), // 27
    m({ personId: "p3", gender: "FEMALE", birthDate: d("1956-11-13") }), // 70 (오늘 생일)
  ];
  const s = aggregateStats(["c1", "c2", "c3"], members, today);
  const counts = (arr: { key: string; count: number }[]) => Object.fromEntries(arr.map((x) => [x.key, x.count]));

  it("위원회 수 (위원 없는 위원회도 센다)", () => {
    expect(s.commCount).toBe(3);
  });
  it("위원 수는 위촉 건, 실인원은 중복 제외", () => {
    expect(s.memberCount).toBe(4);
    expect(s.personCount).toBe(3);
  });
  it("성별·구분·위촉유형 (위촉 건 기준)", () => {
    expect(counts(s.gender)).toEqual({ MALE: 2, FEMALE: 2 });
    expect(counts(s.publicType)).toEqual({ PUBLIC: 2, PRIVATE: 2 });
    expect(counts(s.appointType)).toEqual({ EX_OFFICIO: 1, APPOINTED: 3 });
  });
  it("연령대: 빈 구간도 0으로 모두 나온다", () => {
    expect(counts(s.ageBands)).toEqual({ U30: 1, A30: 0, A40: 0, A50: 0, A60: 2, O70: 1 });
  });
  it("분포 합계 = 위원 수", () => {
    for (const arr of [s.gender, s.publicType, s.appointType, s.ageBands]) {
      expect(arr.reduce((a, x) => a + x.count, 0)).toBe(s.memberCount);
    }
  });
  it("위원이 없으면 모두 0", () => {
    const e = aggregateStats([], [], today);
    expect([e.commCount, e.memberCount, e.personCount]).toEqual([0, 0, 0]);
    expect(e.ageBands.every((b) => b.count === 0)).toBe(true);
  });
});
