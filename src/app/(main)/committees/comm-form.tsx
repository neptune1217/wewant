"use client";

/** 위원회 등록·수정 대화상자 (목록과 상세 화면이 함께 쓴다) */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormDialog } from "@/components/form/form-dialog";
import { FormField, SelectField } from "@/components/form/form-field";
import { Input } from "@/components/ui/input";
import { createComm, updateComm } from "./actions";

export type Option = { value: string; label: string };

/** 수정 대화상자에 채울 값 — 편집 권한이 있는 위원회만 화면으로 보낸다 */
export type CommEditPayload = {
  id: string;
  comm_name: string;
  dept_id: string;
  mng_user_id: string;
  inst_type: "LAW" | "ORDINANCE" | "ETC";
  legal_1: string | null;
  legal_2: string | null;
  op_type: "STANDING" | "NON_STANDING";
  member_cap: number;
  term_yr: number;
  reappoint_num: number;
};

export type CommFormOptions = {
  isAdmin: boolean;
  me: { id: string; name: string };
  deptOptions: Option[];
  /** 담당자 후보(활성 사용자) — 총괄만 고른다 */
  managerOptions: Option[];
  /** 새 위원회의 기본 소관부서 (본인 부서) */
  defaultDeptId: string;
};

const INST_OPTIONS: Option[] = [
  { value: "LAW", label: "법령" },
  { value: "ORDINANCE", label: "조례" },
  { value: "ETC", label: "기타" },
];
const OP_OPTIONS: Option[] = [
  { value: "STANDING", label: "상설" },
  { value: "NON_STANDING", label: "비상설" },
];

export function CommFormDialog({
  open,
  onOpenChange,
  current,
  options,
  currentLabels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: CommEditPayload | null;
  options: CommFormOptions;
  /** 기존 값이 비활성이라 선택지에 없을 때 보여 줄 이름 */
  currentLabels?: { dept?: string; manager?: string };
}) {
  const router = useRouter();
  return (
    <FormDialog<{ commId: string } | undefined>
      open={open}
      onOpenChange={onOpenChange}
      title={current ? "위원회 수정" : "위원회 등록"}
      description={
        current
          ? undefined
          : options.isAdmin
            ? "총괄담당자가 등록한 위원회는 바로 승인됩니다."
            : "등록하면 승인 대기 상태가 되며, 총괄담당자가 승인하면 통계 등에 포함됩니다."
      }
      action={current ? updateComm : createComm}
      onSuccess={(r) => {
        if (r.data?.commId) router.push(`/committees/${r.data.commId}`);
      }}
    >
      <CommFields current={current} options={options} currentLabels={currentLabels} />
    </FormDialog>
  );
}

function withCurrent(opts: Option[], value: string | undefined, label: string | undefined): Option[] {
  if (!value || opts.some((o) => o.value === value)) return opts;
  return [{ value, label: `${label ?? value} (비활성)` }, ...opts];
}

function CommFields({
  current,
  options,
  currentLabels,
}: {
  current: CommEditPayload | null;
  options: CommFormOptions;
  currentLabels?: { dept?: string; manager?: string };
}) {
  const [instType, setInstType] = useState<string>(current?.inst_type ?? "ORDINANCE");

  return (
    <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
      {current && <input type="hidden" name="id" value={current.id} />}
      <div className="sm:col-span-2">
        <FormField name="comm_name" label="위원회명">
          <Input id="comm_name" name="comm_name" defaultValue={current?.comm_name} required autoFocus />
        </FormField>
      </div>
      <FormField name="dept_id" label="소관부서" hint="통계 집계 기준입니다.">
        <SelectField
          name="dept_id"
          defaultValue={current?.dept_id ?? options.defaultDeptId}
          options={withCurrent(options.deptOptions, current?.dept_id, currentLabels?.dept)}
          placeholder="소관부서 선택"
        />
      </FormField>
      <FormField
        name="mng_user_id"
        label="담당자"
        hint={options.isAdmin ? "편집 권한은 담당자 한 사람에게만 있습니다." : "담당자 변경은 총괄담당자에게 요청하세요."}
      >
        {options.isAdmin ? (
          <SelectField
            name="mng_user_id"
            defaultValue={current?.mng_user_id ?? options.me.id}
            options={withCurrent(options.managerOptions, current?.mng_user_id, currentLabels?.manager)}
            placeholder="담당자 선택"
          />
        ) : (
          <>
            <input type="hidden" name="mng_user_id" value={current?.mng_user_id ?? options.me.id} />
            <Input disabled value={current ? (currentLabels?.manager ?? options.me.name) : options.me.name} />
          </>
        )}
      </FormField>
      <FormField name="inst_type" label="설치유형">
        <SelectField name="inst_type" value={instType} onValueChange={setInstType} options={INST_OPTIONS} />
      </FormField>
      <FormField name="op_type" label="운영형태">
        <SelectField name="op_type" defaultValue={current?.op_type ?? "STANDING"} options={OP_OPTIONS} />
      </FormField>
      <div className="sm:col-span-2">
        <FormField name="legal_1" label={instType === "LAW" ? "근거법령명 (필수)" : "근거법령명"}>
          <Input id="legal_1" name="legal_1" defaultValue={current?.legal_1 ?? ""} />
        </FormField>
      </div>
      <div className="sm:col-span-2">
        <FormField
          name="legal_2"
          label={instType === "ORDINANCE" ? "근거조례규칙명 (필수)" : "근거조례규칙명"}
        >
          <Input id="legal_2" name="legal_2" defaultValue={current?.legal_2 ?? ""} />
        </FormField>
      </div>
      <FormField name="member_cap" label="정원">
        <Input id="member_cap" name="member_cap" type="number" min={1} defaultValue={current?.member_cap} required />
      </FormField>
      <FormField
        name="term_yr"
        label="임기 (년)"
        hint={current ? "바꾸면 새 위촉부터 적용됩니다." : undefined}
      >
        <Input id="term_yr" name="term_yr" type="number" min={1} max={10} defaultValue={current?.term_yr ?? 2} required />
      </FormField>
      <FormField name="reappoint_num" label="연임 가능횟수" hint="0이면 연임할 수 없습니다.">
        <Input
          id="reappoint_num"
          name="reappoint_num"
          type="number"
          min={0}
          defaultValue={current?.reappoint_num ?? 1}
          required
        />
      </FormField>
    </div>
  );
}
