"use client";

/** 인물 입력칸 (등록·수정 공용) */
import { FormField, SelectField } from "@/components/form/form-field";
import { Input } from "@/components/ui/input";

export type PersonValues = {
  person_name: string;
  person_gender: "MALE" | "FEMALE";
  birth_date: string;
  is_public: boolean;
};

export function PersonFields({ current }: { current?: PersonValues }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField name="person_name" label="성명">
        <Input id="person_name" name="person_name" defaultValue={current?.person_name} required autoFocus />
      </FormField>
      <FormField name="person_gender" label="성별">
        <SelectField
          name="person_gender"
          defaultValue={current?.person_gender}
          options={[
            { value: "MALE", label: "남" },
            { value: "FEMALE", label: "여" },
          ]}
          placeholder="성별 선택"
        />
      </FormField>
      <FormField name="birth_date" label="생년월일">
        <Input id="birth_date" name="birth_date" type="date" defaultValue={current?.birth_date} required />
      </FormField>
      <FormField name="is_public" label="현직 춘천시 공무원">
        <SelectField
          name="is_public"
          defaultValue={current ? (current.is_public ? "Y" : "N") : "N"}
          options={[
            { value: "N", label: "아니오" },
            { value: "Y", label: "예" },
          ]}
        />
      </FormField>
    </div>
  );
}
