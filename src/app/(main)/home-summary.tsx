/** 홈 — 위원회 구성 요약 (성별, 공무원/민간, 정원 대비 현원) */
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Dashboard } from "@/lib/dashboard";
import type { Ratios } from "@/lib/rules/dashboard-rules";
import { cn } from "@/lib/utils";

/** 두 값을 나눈 가로 막대 (왼쪽 진한 색, 오른쪽 옅은 색) */
function SplitBar({
  label,
  left,
  right,
}: {
  label: string;
  left: { name: string; count: number; pct: number };
  right: { name: string; count: number; pct: number };
}) {
  const empty = left.count + right.count === 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {label} — {left.name} {left.count}명 ({left.pct}%)
        </span>
        <span>
          {right.name} {right.count}명 ({right.pct}%)
        </span>
      </div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={empty ? `${label}: 위원 없음` : `${label}: ${left.name} ${left.pct}%, ${right.name} ${right.pct}%`}
      >
        {!empty && (
          <>
            <div className="bg-primary" style={{ width: `${left.pct}%` }} />
            <div className="bg-primary/35" style={{ width: `${right.pct}%` }} />
          </>
        )}
      </div>
    </div>
  );
}

/** 정원 대비 현원 막대 (정원을 넘으면 빨강) */
function CapacityBar({ current, cap }: { current: number; cap: number }) {
  const pct = cap === 0 ? 0 : Math.min(100, Math.round((current / cap) * 100));
  const over = current > cap;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>정원 대비 현원</span>
        <span className={cn(over && "font-medium text-destructive")}>
          {current} / {cap}명{over ? " (정원 초과)" : ""}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`현원 ${current}명, 정원 ${cap}명`}>
        <div className={cn("h-full", over ? "bg-destructive" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RatioBars({ ratios, cap }: { ratios: Ratios; cap: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      <CapacityBar current={ratios.total} cap={cap} />
      <SplitBar
        label="성별"
        left={{ name: "남", count: ratios.male, pct: ratios.malePct }}
        right={{ name: "여", count: ratios.female, pct: ratios.femalePct }}
      />
      <SplitBar
        label="구분"
        left={{ name: "공무원", count: ratios.public, pct: ratios.publicPct }}
        right={{ name: "민간", count: ratios.private, pct: ratios.privatePct }}
      />
    </div>
  );
}

export function HomeSummary({ data }: { data: Dashboard }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{data.scopeLabel} 요약</h2>
        <span className="text-xs text-muted-foreground">재임 중 위원 기준 · 합계는 승인된 위원회만</span>
      </div>
      {data.comms.length === 0 ? (
        <p className="text-sm text-muted-foreground">담당 중인 활성 위원회가 없습니다.</p>
      ) : (
        <>
          <div className="rounded-md bg-muted/40 p-3">
            <p className="mb-2 text-sm font-medium">합계 — 위원회 {data.total.commCount}개</p>
            <RatioBars ratios={data.total.ratios} cap={data.total.memberCap} />
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {data.comms.map((c) => (
              <li key={c.commId} className="flex flex-col gap-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Link href={`/committees/${c.commId}`} className="font-medium underline-offset-4 hover:underline">
                    {c.commName}
                  </Link>
                  {!c.approved && <Badge variant="outline">승인 대기 · 합계 제외</Badge>}
                </div>
                <RatioBars ratios={c.ratios} cap={c.memberCap} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
