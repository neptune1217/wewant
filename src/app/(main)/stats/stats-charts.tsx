"use client";

/** 통계 차트 (Recharts) — 각 차트 아래에 같은 숫자의 표를 함께 보여 준다 */
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Bucket, StatsResult } from "@/lib/rules/stats-rules";

/** 두 범주용 색 (밝은·어두운 화면 모두에서 구분되는 파랑·주황) */
const PAIR_COLORS = ["#2563eb", "#f59e0b"];
const BAR_COLOR = "#2563eb";

const pct = (n: number, total: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

function NumbersTable({ title, data, total }: { title: string; data: Bucket[]; total: number }) {
  return (
    <table className="w-full text-sm" data-stat={title}>
      <caption className="sr-only">{title} 숫자</caption>
      <tbody>
        {data.map((b, i) => (
          <tr key={b.key} className="border-t first:border-t-0">
            <th scope="row" className="py-1 text-left font-normal">
              {data.length === 2 && (
                <span className="mr-1.5 inline-block size-2.5 rounded-sm align-middle" style={{ background: PAIR_COLORS[i] }} />
              )}
              {b.label}
            </th>
            <td className="py-1 text-right tabular-nums" data-key={b.key}>
              {b.count}명
            </td>
            <td className="w-14 py-1 text-right tabular-nums text-muted-foreground">{pct(b.count, total)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PairChart({ title, data, total }: { title: string; data: Bucket[]; total: number }) {
  return (
    <figure className="flex flex-col gap-2 rounded-lg border p-4">
      <figcaption className="font-medium">{title}</figcaption>
      <div className="h-44" aria-hidden>
        {total === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">위원 없음</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="label" innerRadius="55%" outerRadius="90%" isAnimationActive={false}>
                {data.map((b, i) => (
                  <Cell key={b.key} fill={PAIR_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${v}명`, ""]} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <NumbersTable title={title} data={data} total={total} />
    </figure>
  );
}

export function StatsCharts({ stats }: { stats: StatsResult }) {
  const total = stats.memberCount;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <PairChart title="성별" data={stats.gender} total={total} />
      <PairChart title="구분(공무원·민간)" data={stats.publicType} total={total} />
      <PairChart title="위촉유형" data={stats.appointType} total={total} />
      <figure className="flex flex-col gap-2 rounded-lg border p-4 md:col-span-3">
        <figcaption className="font-medium">연령대 (오늘 기준 만 나이)</figcaption>
        <div className="h-56" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.ageBands} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [`${v}명`, "위원"]} cursor={{ fillOpacity: 0.1 }} />
              <Bar dataKey="count" fill={BAR_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <NumbersTable title="연령대" data={stats.ageBands} total={total} />
      </figure>
    </div>
  );
}
