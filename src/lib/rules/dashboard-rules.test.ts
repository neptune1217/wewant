import { describe, expect, it } from "vitest";
import {
  ALERT_WINDOW_DAYS,
  expiryAlerts,
  expiryLevel,
  memberRatios,
  percent,
  type ExpiryCandidate,
} from "./dashboard-rules";
import { addDays, parseDate } from "./term";

const today = parseDate("2026-11-13");
const due = (days: number) => addDays(today, days);

const cand = (p: Partial<ExpiryCandidate> & Pick<ExpiryCandidate, "appointId">): ExpiryCandidate => ({
  type: "APPOINTED",
  active: true,
  expireDue: due(10),
  ...p,
});

describe("임기만료 알림 대상 (D-60 이내)", () => {
  const list = [
    cand({ appointId: "d61", expireDue: due(61) }),
    cand({ appointId: "d60", expireDue: due(60) }),
    cand({ appointId: "d31", expireDue: due(31) }),
    cand({ appointId: "d30", expireDue: due(30) }),
    cand({ appointId: "d8", expireDue: due(8) }),
    cand({ appointId: "d7", expireDue: due(7) }),
    cand({ appointId: "d0", expireDue: due(0) }),
    cand({ appointId: "past", expireDue: due(-1) }),
  ];
  const result = expiryAlerts(list, today);
  const byId = Object.fromEntries(result.map((a) => [a.appointId, a]));

  it("창은 60일", () => {
    expect(ALERT_WINDOW_DAYS).toBe(60);
  });
  it("D-61은 안 보이고 D-60부터 보인다", () => {
    expect(byId.d61).toBeUndefined();
    expect(byId.d60?.dday).toBe(60);
  });
  it("만료가 가까운 순 (지난 건이 맨 앞)", () => {
    expect(result.map((a) => a.appointId)).toEqual(["past", "d0", "d7", "d8", "d30", "d31", "d60"]);
  });
  it("강조 단계: 지남 / 7일 이하 / 30일 이하 / 60일 이하", () => {
    expect(byId.past.level).toBe("OVERDUE");
    expect(byId.d0.level).toBe("D7");
    expect(byId.d7.level).toBe("D7");
    expect(byId.d8.level).toBe("D30");
    expect(byId.d30.level).toBe("D30");
    expect(byId.d31.level).toBe("D60");
    expect(byId.d60.level).toBe("D60");
  });
  it("해촉된 건·당연직·만료 예정일 없는 건은 제외", () => {
    const r = expiryAlerts(
      [
        cand({ appointId: "ended", active: false }),
        cand({ appointId: "ex", type: "EX_OFFICIO" }),
        cand({ appointId: "none", expireDue: null }),
      ],
      today,
    );
    expect(r).toEqual([]);
  });
  it("원래 행의 다른 값은 그대로 따라온다", () => {
    const r = expiryAlerts([{ ...cand({ appointId: "x" }), name: "홍길동" }], today);
    expect(r[0].name).toBe("홍길동");
  });
  it("단계 판정 단독", () => {
    expect(expiryLevel(61)).toBeNull();
    expect(expiryLevel(-30)).toBe("OVERDUE");
  });
});

describe("구성 비율", () => {
  it("남·여, 공무원·민간 인원과 비율", () => {
    const r = memberRatios([
      { gender: "MALE", isPublic: true },
      { gender: "MALE", isPublic: false },
      { gender: "FEMALE", isPublic: false },
    ]);
    expect(r).toEqual({ total: 3, male: 2, female: 1, public: 1, private: 2, malePct: 67, femalePct: 33, publicPct: 33, privatePct: 67 });
  });
  it("짝의 합은 항상 100% (1명/8명 → 13% + 87%)", () => {
    const eight = Array.from({ length: 8 }, (_, i) => ({ gender: i === 0 ? ("FEMALE" as const) : ("MALE" as const), isPublic: i === 0 }));
    const r = memberRatios(eight);
    expect(r.malePct + r.femalePct).toBe(100);
    expect(r.publicPct + r.privatePct).toBe(100);
  });
  it("위원이 없으면 모두 0 (0으로 나누지 않음)", () => {
    expect(memberRatios([])).toMatchObject({ total: 0, malePct: 0, femalePct: 0, publicPct: 0, privatePct: 0 });
  });
  it("백분율은 반올림 정수", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(1, 8)).toBe(13);
    expect(percent(0, 0)).toBe(0);
  });
});
