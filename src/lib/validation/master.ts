/**
 * 기준정보 입력 규칙 (Zod). 화면의 폼과 서버 동작이 같은 규칙을 쓴다.
 */
import { z } from "zod";

/** 선택 상자의 "없음" 값 (form-field.tsx의 NONE과 같은 값) */
export const NONE_VALUE = "__none__";

/** 빈 문자열·"없음"을 null로 */
const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" || v === NONE_VALUE ? null : v))
  .nullable()
  .default(null);

export const DeptSchema = z.object({
  dept_name: z.string().trim().min(1, "부서명을 입력하세요.").max(50, "부서명은 50자 이하입니다."),
  dept_type: z.enum(["GUKSO", "BUSEO"], { message: "부서유형을 고르세요." }),
  parentdept_id: optionalId,
});
export type DeptInput = z.infer<typeof DeptSchema>;

export const UserSchema = z.object({
  login_id: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_.]{3,30}$/, "아이디는 영문 소문자·숫자·밑줄·점으로 3~30자입니다."),
  user_name: z.string().trim().min(1, "이름을 입력하세요.").max(30, "이름은 30자 이하입니다."),
  dept_id: z.string().trim().min(1, "부서를 고르세요."),
  phone: z.string().trim().regex(/^\d{4}$/, "내선번호는 숫자 4자리입니다."),
  auth_id: z.enum(["r01", "r02"], { message: "권한을 고르세요." }),
});
export type UserInput = z.infer<typeof UserSchema>;

export const PositionSchema = z.object({
  appos_name: z
    .string()
    .trim()
    .min(1, "직위명을 입력하세요.")
    .max(30, "직위명은 30자 이하입니다."),
});
export type PositionInput = z.infer<typeof PositionSchema>;

/** FormData → 일반 객체 (문자열 값만) */
export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") out[k] = v;
  return out;
}
