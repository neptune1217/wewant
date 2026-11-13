import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { requireUser } from "@/lib/permissions";
import { parseStatsDept } from "@/lib/rules/stats-rules";
import { loadStats, loadStatsDepts } from "@/lib/stats";
import { StatsCharts } from "./stats-charts";

export const metadata: Metadata = { title: "통계 | 춘천시 위원회·위원 통합관리" };

/**
 * 통계 — 범위(전체/국소/부서)별 위원회 수, 위원 수, 성별·구분·위촉유형·연령대 분포.
 * 집계 대상(활성+승인) 위원회의 재임 중 위원만 센다. 총괄·부서 계정 모두 같은 숫자를 본다(개인 정보 없음).
 */
export default async function StatsPage({ searchParams }: PageProps<"/stats">) {
  await requireUser();
  const { depts, options } = await loadStatsDepts();
  const deptId = parseStatsDept(await searchParams, depts);
  const stats = await loadStats(depts, deptId);
  const scopeLabel = deptId ? options.find((o) => o.value === deptId)?.label : "춘천시 전체";

  const cards: [string, number, string][] = [
    ["위원회", stats.commCount, "운영 중(승인된 활성) 위원회"],
    ["위원", stats.memberCount, "재임 중 위촉 건 (한 사람이 두 위원회면 2명)"],
    ["실인원", stats.personCount, "같은 사람은 1명으로"],
  ];

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">통계</h1>
        <p className="text-sm text-muted-foreground">
          승인된 활성 위원회의 재임 중 위원 기준입니다. 분포는 위원(위촉 건) 기준입니다.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-md border p-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="stats-dept">범위</Label>
          <select
            id="stats-dept"
            name="dept"
            defaultValue={deptId ?? ""}
            className="h-9 w-72 max-w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="">춘천시 전체</option>
            {(["국소", "부서"] as const).map((g) => (
              <optgroup key={g} label={g === "국소" ? "국소 (하위 부서 포함)" : "부서"}>
                {options
                  .filter((o) => o.group === g)
                  .map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        <Button type="submit">보기</Button>
      </form>

      <h2 className="text-lg font-semibold" data-testid="stats-scope">
        {scopeLabel}
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map(([label, value, hint]) => (
          <div key={label} className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-semibold tabular-nums" data-stat-card={label}>
              {value}
            </p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>
      <StatsCharts stats={stats} />
    </section>
  );
}
