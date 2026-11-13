import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadMemberRows } from "@/lib/members";
import { isAdmin, requireUser } from "@/lib/permissions";
import {
  filterMembers,
  filterToQuery,
  parseMemberFilter,
  REAPPOINT_LABEL,
  STATUS_LABEL,
} from "@/lib/rules/member-filter";
import { MembersTable } from "./members-table";

export const metadata: Metadata = { title: "위원 조회 | 춘천시 위원회·위원 통합관리" };

/**
 * 위원 조회 — 열람 권한이 있는 위원회의 위촉 건을 조건으로 걸러 보고 엑셀로 내보낸다.
 * 조건은 주소(URL)에 담고, 엑셀 내보내기(/members/export)도 같은 조건·같은 함수로 거른다.
 */
export default async function MembersPage({ searchParams }: PageProps<"/members">) {
  const user = await requireUser();
  const filter = parseMemberFilter(await searchParams);
  const { rows, commOptions, deptOptions } = await loadMemberRows(user);
  const result = filterMembers(rows, filter);
  const query = filterToQuery(filter);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">위원 조회</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin(user)
              ? "모든 위원회의 위원을 조회합니다."
              : "본인 담당 위원회와 열람 승인 기간 중인 위원회의 위원만 조회됩니다."}
          </p>
        </div>
        <Link href="/committees" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          ← 위원회 목록
        </Link>
      </div>

      <form method="get" className="grid grid-cols-2 gap-3 rounded-md border p-4 sm:grid-cols-3 lg:grid-cols-5">
        <Field label="성명" htmlFor="f-name">
          <Input id="f-name" name="name" defaultValue={filter.name ?? ""} maxLength={30} />
        </Field>
        <Field label="출생연도" htmlFor="f-from">
          <div className="flex items-center gap-1">
            <Input id="f-from" name="birthFrom" inputMode="numeric" placeholder="부터" defaultValue={filter.birthFrom ?? ""} maxLength={4} />
            <span className="text-muted-foreground">~</span>
            <Input aria-label="출생연도 까지" name="birthTo" inputMode="numeric" placeholder="까지" defaultValue={filter.birthTo ?? ""} maxLength={4} />
          </div>
        </Field>
        <Field label="성별" htmlFor="f-gender">
          <NativeSelect id="f-gender" name="gender" value={filter.gender} options={[["MALE", "남"], ["FEMALE", "여"]]} />
        </Field>
        <Field label="위촉유형" htmlFor="f-type">
          <NativeSelect id="f-type" name="type" value={filter.type} options={[["EX_OFFICIO", "당연직"], ["APPOINTED", "위촉직"]]} />
        </Field>
        <Field label="연임횟수" htmlFor="f-reappoint">
          <NativeSelect
            id="f-reappoint"
            name="reappoint"
            value={filter.reappoint}
            options={Object.entries(REAPPOINT_LABEL)}
          />
        </Field>
        <Field label="위해촉 상태" htmlFor="f-status">
          <NativeSelect
            id="f-status"
            name="status"
            value={filter.status}
            options={Object.entries(STATUS_LABEL)}
            allLabel={null}
          />
        </Field>
        <Field label="위원회" htmlFor="f-comm">
          <NativeSelect id="f-comm" name="comm" value={filter.commId} options={commOptions.map((o) => [o.value, o.label])} />
        </Field>
        <Field label="부서" htmlFor="f-dept">
          <NativeSelect id="f-dept" name="dept" value={filter.deptId} options={deptOptions.map((o) => [o.value, o.label])} />
        </Field>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
          <Button type="submit">조회</Button>
          <Link href="/members" className={buttonVariants({ variant: "ghost" })}>
            초기화
          </Link>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          조회 결과 <strong data-testid="member-count">{result.length}</strong>건
        </p>
        {result.length > 0 && (
          // 파일 내려받기는 화면 이동이 아니므로 일반 링크(a)를 쓴다
          <a href={`/members/export${query ? `?${query}` : ""}`} className={buttonVariants({ variant: "outline" })}>
            엑셀 내보내기
          </a>
        )}
      </div>
      <MembersTable rows={result} />
    </section>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

/** GET 양식에 그대로 실리는 기본 선택 상자 */
function NativeSelect({
  id,
  name,
  value,
  options,
  allLabel = "전체",
}: {
  id: string;
  name: string;
  value: string | undefined;
  options: [string, string][];
  /** null이면 "전체" 선택지를 두지 않는다 */
  allLabel?: string | null;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={value ?? ""}
      className="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
    >
      {allLabel !== null && <option value="">{allLabel}</option>}
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
