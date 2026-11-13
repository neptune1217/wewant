/** 홈 — 임기만료 알림 (D-60 이내, 만료일 지남은 맨 위) */
import Link from "next/link";
import type { ExpiryAlertRow } from "@/lib/dashboard";
import { ALERT_WINDOW_DAYS, type ExpiryLevel } from "@/lib/rules/dashboard-rules";
import { cn } from "@/lib/utils";

const LEVEL_STYLE: Record<ExpiryLevel, string> = {
  OVERDUE: "bg-destructive text-white",
  D7: "bg-destructive/15 text-destructive",
  D30: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  D60: "bg-muted text-muted-foreground",
};

const ddayText = (d: number) => (d < 0 ? `D+${-d}` : d === 0 ? "D-day" : `D-${d}`);

export function ExpiryAlerts({ alerts }: { alerts: ExpiryAlertRow[] }) {
  const overdue = alerts.filter((a) => a.level === "OVERDUE");
  const upcoming = alerts.filter((a) => a.level !== "OVERDUE");
  const urgent = upcoming.filter((a) => a.level === "D7").length;

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">
          임기만료 예정 {upcoming.length > 0 && `(${upcoming.length}명)`}
        </h2>
        <span className="text-xs text-muted-foreground">
          만료 {ALERT_WINDOW_DAYS}일 이내 위촉직 · 7일 이내 {urgent}명
        </span>
      </div>

      {overdue.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="mb-2 text-sm font-medium text-destructive">
            만료일 지남 — 해촉 또는 연임 처리 필요 ({overdue.length}명)
          </p>
          <AlertList rows={overdue} />
        </div>
      )}

      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">{ALERT_WINDOW_DAYS}일 이내에 임기가 끝나는 위원이 없습니다.</p>
      ) : (
        <AlertList rows={upcoming} />
      )}
    </section>
  );
}

function AlertList({ rows }: { rows: ExpiryAlertRow[] }) {
  return (
    <ul className="divide-y text-sm">
      {rows.map((a) => (
        <li key={a.appointId} className="flex flex-wrap items-center justify-between gap-2 py-2" data-dday={a.dday}>
          <span className="min-w-0">
            <span className="font-medium">{a.name}</span>
            <span className="text-muted-foreground"> · {a.apposName} · </span>
            <Link href={`/committees/${a.commId}`} className="underline-offset-4 hover:underline">
              {a.commName}
            </Link>
          </span>
          <span className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-muted-foreground">{a.expireDue}</span>
            <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", LEVEL_STYLE[a.level])}>
              {ddayText(a.dday)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
