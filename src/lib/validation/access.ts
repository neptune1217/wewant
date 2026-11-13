/**
 * 열람 요청·처리 입력 규칙 (Zod). 화면과 서버가 같은 규칙을 쓴다.
 */
import { z } from "zod";
import { MAX_VIEW_DAYS, MIN_VIEW_DAYS } from "@/lib/rules/access-rules";

export const AccessRequestSchema = z.object({
  comm_id: z.string().trim().min(1, "위원회를 찾을 수 없습니다."),
  req_reason: z.string().trim().min(1, "요청 사유를 입력하세요.").max(200, "요청 사유는 200자 이하입니다."),
});

export const AccessDecideSchema = z
  .object({
    req_id: z.string().trim().min(1, "요청 건을 찾을 수 없습니다."),
    decision: z.enum(["APPROVE", "REJECT"], { message: "승인 또는 거절을 고르세요." }),
    view_days: z.string().trim().optional(),
  })
  .transform((v, ctx) => {
    if (v.decision === "REJECT") return { req_id: v.req_id, decision: v.decision, view_days: null };
    const days = Number(v.view_days);
    if (!v.view_days || !Number.isInteger(days) || days < MIN_VIEW_DAYS || days > MAX_VIEW_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["view_days"],
        message: `열람 기간은 ${MIN_VIEW_DAYS}~${MAX_VIEW_DAYS}일 사이의 정수로 입력하세요.`,
      });
      return z.NEVER;
    }
    return { req_id: v.req_id, decision: v.decision, view_days: days };
  });
