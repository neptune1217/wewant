/** 사용자 정보 화면 조각 — /me 와 /users/[userId] 가 함께 쓴다 (서버 컴포넌트) */
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { ActivityRow, ManagedComm, UserProfile } from "@/lib/user-info";

export function ProfileList({ profile }: { profile: UserProfile }) {
  const rows: [string, string][] = [
    ["아이디", profile.loginId],
    ["이름", profile.name],
    ["부서", profile.deptName],
    ["권한", profile.authName],
    ["전화(내선)", profile.phone],
    ["상태", profile.active ? "활성" : "비활성"],
    ["마지막 로그인", profile.lastLoginAt ?? "-"],
  ];
  return (
    <dl className="grid grid-cols-[8rem_1fr] gap-y-2 rounded-lg border p-4 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ManagedCommList({ comms }: { comms: ManagedComm[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">담당 위원회 {comms.length > 0 && `(${comms.length}개)`}</h2>
      {comms.length === 0 ? (
        <p className="text-sm text-muted-foreground">담당 중인 위원회가 없습니다.</p>
      ) : (
        <ul className="divide-y rounded-lg border text-sm">
          {comms.map((c) => (
            <li key={c.commId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <Link href={`/committees/${c.commId}`} className="underline-offset-4 hover:underline">
                {c.commName}
              </Link>
              <span className="flex items-center gap-2 text-muted-foreground">
                현원 {c.memberCount} / {c.memberCap}명
                <Badge variant={c.statusLabel === "운영 중" ? "secondary" : "outline"}>{c.statusLabel}</Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ActivityTable({ rows }: { rows: ActivityRow[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">최근 활동 이력</h2>
      <p className="text-xs text-muted-foreground">최근 20건. 무엇을 했는지만 보이고, 바뀐 값은 보이지 않습니다.</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">기록이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">일시</th>
                <th className="px-3 py-2 font-medium">동작</th>
                <th className="px-3 py-2 font-medium">대상</th>
                <th className="px-3 py-2 font-medium">대상 코드</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.logId} className="border-t">
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{r.at}</td>
                  <td className="px-3 py-1.5">{r.action}</td>
                  <td className="px-3 py-1.5">{r.target}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{r.targetId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
