"use client";

/** 폼 입력칸 묶음: 이름표 + 입력 + 오류 문구 */
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldError } from "./form-dialog";

export function FormField({
  name,
  label,
  hint,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <FieldError name={name} />
    </div>
  );
}

/** 폼 전송값을 갖는 선택 상자 (빈 값은 NONE으로 표시) */
export { NONE_VALUE as NONE } from "@/lib/validation/master";

export function SelectField({
  name,
  defaultValue,
  options,
  placeholder = "선택",
  value,
  onValueChange,
}: {
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  value?: string;
  onValueChange?: (v: string) => void;
}) {
  return (
    <Select name={name} defaultValue={defaultValue} value={value} onValueChange={onValueChange}>
      <SelectTrigger id={name} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
