/**
 * 위원회 입력 규칙 (Zod). 화면의 폼과 서버 동작이 같은 규칙을 쓴다.
 */
import { z } from "zod";
import { legalBasisError } from "@/lib/rules/comm-rules";

/** 빈 칸은 null로 저장 */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}은(는) ${max}자 이하입니다.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);

const intField = (label: string, min: number, max: number) =>
  z.coerce
    .number({ message: `${label}을(를) 숫자로 입력하세요.` })
    .int(`${label}은(는) 정수입니다.`)
    .min(min, `${label}은(는) ${min} 이상입니다.`)
    .max(max, `${label}은(는) ${max} 이하입니다.`);

export const CommSchema = z
  .object({
    comm_name: z.string().trim().min(1, "위원회명을 입력하세요.").max(100, "위원회명은 100자 이하입니다."),
    dept_id: z.string().trim().min(1, "소관부서를 고르세요."),
    mng_user_id: z.string().trim().min(1, "담당자를 고르세요."),
    inst_type: z.enum(["LAW", "ORDINANCE", "ETC"], { message: "설치유형을 고르세요." }),
    legal_1: optionalText(200, "근거법령명"),
    legal_2: optionalText(200, "근거조례규칙명"),
    op_type: z.enum(["STANDING", "NON_STANDING"], { message: "운영형태를 고르세요." }),
    member_cap: intField("정원", 1, 500),
    term_yr: intField("임기년수", 1, 10),
    reappoint_num: intField("연임 가능횟수", 0, 20),
  })
  .superRefine((v, ctx) => {
    const err = legalBasisError(v.inst_type, v.legal_1, v.legal_2);
    if (err) ctx.addIssue({ code: "custom", path: [err.field], message: err.message });
  });

export type CommInput = z.infer<typeof CommSchema>;
