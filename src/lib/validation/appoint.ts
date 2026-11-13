/**
 * 인물·소속직위·위촉 입력 규칙 (Zod). 화면과 서버가 같은 규칙을 쓴다.
 * 날짜는 "YYYY-MM-DD" 문자열로 받아 시간 없는 날짜(UTC 자정 Date)로 바꾼다.
 */
import { z } from "zod";
import { parseDate } from "@/lib/rules/term";

const dateField = (label: string) =>
  z
    .string({ message: `${label}을(를) 입력하세요.` })
    .trim()
    .min(1, `${label}을(를) 입력하세요.`)
    .transform((v, ctx) => {
      try {
        return parseDate(v);
      } catch {
        ctx.addIssue({ code: "custom", message: `${label}이(가) 올바른 날짜가 아닙니다.` });
        return z.NEVER;
      }
    });

/** 빈 칸이면 null인 날짜 */
const optionalDate = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      try {
        return parseDate(v);
      } catch {
        ctx.addIssue({ code: "custom", message: `${label}이(가) 올바른 날짜가 아닙니다.` });
        return z.NEVER;
      }
    });

const id = (label: string) => z.string().trim().min(1, `${label}을(를) 고르세요.`);

/** 경고 확인 표시 (정원 초과 등) */
const confirmFlag = z
  .string()
  .optional()
  .transform((v) => v === "Y");

export const PersonSchema = z.object({
  person_name: z.string().trim().min(1, "성명을 입력하세요.").max(30, "성명은 30자 이하입니다."),
  person_gender: z.enum(["MALE", "FEMALE"], { message: "성별을 고르세요." }),
  birth_date: dateField("생년월일"),
  is_public: z.enum(["Y", "N"], { message: "공무원 여부를 고르세요." }).transform((v) => v === "Y"),
  confirm_duplicate: confirmFlag,
});

export const PositionAddSchema = z.object({
  person_id: id("인물"),
  org_name: z.string().trim().min(1, "소속기관명을 입력하세요.").max(100, "소속기관명은 100자 이하입니다."),
  pos_name: z.string().trim().min(1, "직위명을 입력하세요.").max(100, "직위명은 100자 이하입니다."),
});

export const NewAppointSchema = z.object({
  comm_id: id("위원회"),
  pos_id: id("소속직위"),
  appos_id: id("위원회 내 직위"),
  appoint_type: z.enum(["EX_OFFICIO", "APPOINTED"], { message: "위촉유형을 고르세요." }),
  appoint_kind: z.enum(["NEW", "BY_ELECT"], { message: "위촉 구분을 고르세요." }),
  appoint_start: dateField("위촉일"),
  expire_due: optionalDate("만료 예정일"),
  confirm_warnings: confirmFlag,
});

export const DismissSchema = z.object({
  appoint_id: id("위촉 건"),
  appoint_end: dateField("해촉일"),
  end_reason: z.enum(["EXPIRED", "RESIGNED", "DISMISSED", "ETC"], { message: "사유를 고르세요." }),
});

export const ReappointSchema = z.object({
  appoint_id: id("위촉 건"),
  confirm_warnings: confirmFlag,
});

export const ApposChangeSchema = z.object({
  appoint_id: id("위촉 건"),
  appos_id: id("새 위원회 내 직위"),
  change_date: dateField("변경일"),
});

export const PosChangeSchema = z.object({
  appoint_id: id("위촉 건"),
  pos_id: id("새 소속직위"),
});
