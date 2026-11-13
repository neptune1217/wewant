import { describe, expect, it } from "vitest";
import {
  accessStatus,
  MAX_VIEW_DAYS,
  requestBlockReason,
  viewUntilDate,
  type AccessReqLite,
} from "./access-rules";
import { formatDate, parseDate } from "./term";

const d = parseDate;
const today = d("2026-11-13");

const req = (p: Partial<AccessReqLite>): AccessReqLite => ({
  reqId: "q1",
  status: "PENDING",
  reqAt: d("2026-11-10"),
  viewUntil: null,
  ...p,
});

describe("열람 가능일 = 승인일 + 기간 − 1일", () => {
  it("11-13에 7일 승인 → 11-19까지", () => {
    expect(formatDate(viewUntilDate(d("2026-11-13"), 7))).toBe("2026-11-19");
  });
  it("1일 승인 → 승인 당일까지", () => {
    expect(formatDate(viewUntilDate(d("2026-11-13"), 1))).toBe("2026-11-13");
  });
  it("연말을 넘어간다", () => {
    expect(formatDate(viewUntilDate(d("2026-12-30"), 5))).toBe("2027-01-03");
  });
  it("윤년 2월", () => {
    expect(formatDate(viewUntilDate(d("2028-02-27"), 3))).toBe("2028-02-29");
  });
  it("최대 기간은 90일", () => {
    expect(MAX_VIEW_DAYS).toBe(90);
  });
});

describe("화면에 보일 열람 상태 (가장 최근 요청 기준)", () => {
  it("요청이 없으면 NONE", () => {
    expect(accessStatus([], today).kind).toBe("NONE");
  });
  it("대기 중", () => {
    expect(accessStatus([req({})], today).kind).toBe("PENDING");
  });
  it("승인되고 기간 안이면 열람 중(그날까지)", () => {
    const s = accessStatus([req({ status: "APPROVED", viewUntil: d("2026-11-19") })], today);
    expect(s.kind).toBe("APPROVED");
    expect(s.viewUntil && formatDate(s.viewUntil)).toBe("2026-11-19");
  });
  it("열람 가능일 당일도 열람 중", () => {
    expect(accessStatus([req({ status: "APPROVED", viewUntil: today })], today).kind).toBe("APPROVED");
  });
  it("열람 가능일이 지나면 만료", () => {
    expect(accessStatus([req({ status: "APPROVED", viewUntil: d("2026-11-12") })], today).kind).toBe("EXPIRED");
  });
  it("거절", () => {
    expect(accessStatus([req({ status: "REJECTED" })], today).kind).toBe("REJECTED");
  });
  it("여러 건이면 가장 최근 요청으로 판단 (만료 후 재요청 대기)", () => {
    const old = req({ reqId: "q1", status: "APPROVED", reqAt: d("2026-10-01"), viewUntil: d("2026-10-07") });
    const now = req({ reqId: "q2", status: "PENDING", reqAt: d("2026-11-12") });
    expect(accessStatus([now, old], today).kind).toBe("PENDING");
  });
  it("열람 중인 건이 있으면 그 뒤 거절 건보다 열람 중이 우선", () => {
    const ok = req({ reqId: "q1", status: "APPROVED", reqAt: d("2026-11-10"), viewUntil: d("2026-11-20") });
    const no = req({ reqId: "q2", status: "REJECTED", reqAt: d("2026-11-11") });
    expect(accessStatus([ok, no], today).kind).toBe("APPROVED");
  });
});

describe("다시 요청할 수 있는지", () => {
  it("요청이 없으면 가능", () => {
    expect(requestBlockReason([], today)).toBeNull();
  });
  it("대기 중이면 불가", () => {
    expect(requestBlockReason([req({})], today)).toMatch(/처리 대기/);
  });
  it("열람 기간 안이면 불가", () => {
    expect(requestBlockReason([req({ status: "APPROVED", viewUntil: d("2026-11-19") })], today)).toMatch(/열람 중/);
  });
  it("거절된 뒤에는 다시 요청 가능", () => {
    expect(requestBlockReason([req({ status: "REJECTED" })], today)).toBeNull();
  });
  it("기간이 끝난 뒤에는 다시 요청해야 한다 (가능)", () => {
    expect(requestBlockReason([req({ status: "APPROVED", viewUntil: d("2026-11-12") })], today)).toBeNull();
  });
});
