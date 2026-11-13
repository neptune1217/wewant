import type { Metadata } from "next";
import Link from "next/link";
import { DupWarningIcon } from "@/components/dup-warning-icon";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { getActiveAppointRows, summarize } from "@/lib/duplicates";
import { GENDER_LABEL } from "@/lib/enum-labels";
import { requireUser } from "@/lib/permissions";
import { DUP_WARN_THRESHOLD } from "@/lib/rules/duplicate-rules";
import { formatDate, parseDate } from "@/lib/rules/term";

export const metadata: Metadata = { title: "중복위촉 조회 | 춘천시 위원회·위원 통합관리" };

const MAX_PERSONS = 50;

/**
 * 중복위촉 조회 — 성명(+생년월일)으로 검색해 인물별로 재임 중인 위원회와 위촉직 건수를 보여 준다.
 * 총괄·부서 계정 모두 쓸 수 있다. 다른 위원회 정보는 최소 정보(위원회명·소관부서·담당자·직위·위촉유형·임기)만.
 * 조회만 하므로 이력(TB_AuditLog)은 남기지 않는다.
 */
export default async function DuplicatesPage({ searchParams }: PageProps<"/committees/duplicates">) {
  await requireUser();
  const sp = await searchParams;
  const name = (typeof sp.name === "string" ? sp.name : "").trim().slice(0, 30);
  const birthRaw = (typeof sp.birth === "string" ? sp.birth : "").trim();

  let birth: Date | null = null;
  let birthError = false;
  if (birthRaw) {
    try {
      birth = parseDate(birthRaw);
    } catch {
      birthError = true;
    }
  }

  const searched = name.length > 0 && !birthError;
  const persons = searched
    ? await prisma.tB_Person.findMany({
        where: { person_name: { contains: name }, person_activ: true, ...(birth ? { birth_date: birth } : {}) },
        orderBy: [{ person_name: "asc" }, { birth_date: "asc" }, { person_id: "asc" }],
        take: MAX_PERSONS + 1,
      })
    : [];
  const shown = persons.slice(0, MAX_PERSONS);
  const rowsByPerson = await getActiveAppointRows(shown.map((p) => p.person_id));
  const people = shown
    .map((p) => {
      const rows = rowsByPerson.get(p.person_id) ?? [];
      return { person: p, rows, dup: summarize(rows) };
    })
    // 위촉직이 많은 사람부터
    .sort((a, b) => b.dup.count - a.dup.count);
  const sameNames = new Set(
    shown.map((p) => p.person_name).filter((n, i, all) => all.indexOf(n) !== i),
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">중복위촉 조회</h1>
          <p className="text-sm text-muted-foreground">
            위촉직 건수는 운영 중(승인된 활성) 위원회에서 지금 재임 중인 위촉직만 셉니다. 당연직은 세지 않습니다.
            {` ${DUP_WARN_THRESHOLD}개 이상이면 경고 아이콘이 붙습니다(조례상 3개까지가 원칙, 입력은 막지 않음).`}
          </p>
        </div>
        <Link href="/committees" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          ← 위원회 목록
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-md border p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dup-name">성명</Label>
          <Input id="dup-name" name="name" defaultValue={name} required maxLength={30} className="w-44" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dup-birth">생년월일 (선택)</Label>
          <Input id="dup-birth" name="birth" type="date" defaultValue={birthRaw} className="w-44" />
        </div>
        <Button type="submit">조회</Button>
        {birthError && <p className="text-sm text-destructive">생년월일이 올바른 날짜가 아닙니다.</p>}
      </form>

      {!searched ? (
        <p className="text-sm text-muted-foreground">성명을 입력하고 조회하세요. 생년월일을 함께 넣으면 동명이인을 좁힐 수 있습니다.</p>
      ) : people.length === 0 ? (
        <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {persons.length > MAX_PERSONS ? `${MAX_PERSONS}명 이상입니다. 앞의 ${MAX_PERSONS}명만 보여 줍니다. ` : `${people.length}명. `}
            {sameNames.size > 0 && "같은 성명의 인물이 있습니다 — 생년월일·성별로 구분하세요."}
          </p>
          {people.map(({ person, rows, dup }) => (
            <article key={person.person_id} className="rounded-md border">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{person.person_name}</span>
                  <DupWarningIcon info={dup} />
                  <span className="text-sm text-muted-foreground">
                    {GENDER_LABEL[person.person_gender]} · {formatDate(person.birth_date)}
                    {person.is_public ? " · 공무원" : ""}
                  </span>
                </div>
                <Badge variant={dup.warn ? "destructive" : "secondary"}>위촉직 {dup.count}개</Badge>
              </header>
              {rows.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">재임 중인 위원회가 없습니다.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>위원회</TableHead>
                        <TableHead>소관부서</TableHead>
                        <TableHead>담당자</TableHead>
                        <TableHead>위원회 내 직위</TableHead>
                        <TableHead>위촉유형</TableHead>
                        <TableHead>임기</TableHead>
                        <TableHead>건수</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r, i) => (
                        <TableRow key={`${r.commId}-${i}`}>
                          <TableCell>
                            <Link href={`/committees/${r.commId}`} className="underline-offset-2 hover:underline">
                              {r.commName}
                            </Link>
                          </TableCell>
                          <TableCell>{r.deptName}</TableCell>
                          <TableCell>{r.mngUserName}</TableCell>
                          <TableCell>{r.apposName}</TableCell>
                          <TableCell>{r.typeLabel}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {r.start} ~ {r.expireDue ?? ""}
                          </TableCell>
                          <TableCell>
                            {r.counted ? (
                              <Badge variant="outline">포함</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">제외({r.excludeReason})</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
