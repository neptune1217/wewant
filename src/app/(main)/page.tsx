import { loadDashboard } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { isAdmin, requireUser, todayKST } from "@/lib/permissions";
import { accessStatus } from "@/lib/rules/access-rules";
import { formatDate } from "@/lib/rules/term";
import { AccessInbox, type InboxRow, type MyReqRow } from "./access-inbox";
import { ExpiryAlerts } from "./expiry-alerts";
import { HomeSummary } from "./home-summary";

/** 날짜·시각을 한국 시간 YYYY-MM-DD로 */
const kstDate = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

/** 홈 — 임기만료 알림, 위원회 구성 요약, 열람 요청 처리함 */
export default async function HomePage() {
  const user = await requireUser();
  const today = todayKST();

  const [dashboard, pending, myReqs] = await Promise.all([
    loadDashboard(user),
    // 처리할 요청: 담당자는 본인 담당 위원회, 총괄은 전체
    prisma.tB_AccessReq.findMany({
      where: { req_status: "PENDING", ...(isAdmin(user) ? {} : { comm: { mng_user_id: user.userId } }) },
      include: {
        comm: { select: { comm_id: true, comm_name: true } },
        req_user: { select: { user_name: true, dept: { select: { dept_name: true } } } },
      },
      orderBy: { req_at: "asc" },
    }),
    prisma.tB_AccessReq.findMany({
      where: { req_user_id: user.userId },
      include: { comm: { select: { comm_id: true, comm_name: true } } },
      orderBy: { req_at: "desc" },
      take: 20,
    }),
  ]);

  const inbox: InboxRow[] = pending.map((r) => ({
    reqId: r.req_id,
    commId: r.comm.comm_id,
    commName: r.comm.comm_name,
    requester: `${r.req_user.user_name}(${r.req_user.dept.dept_name})`,
    reason: r.req_reason,
    reqAt: kstDate(r.req_at),
  }));
  const mine: MyReqRow[] = myReqs.map((r) => {
    const s = accessStatus(
      [{ reqId: r.req_id, status: r.req_status, reqAt: r.req_at, viewUntil: r.view_until }],
      today,
    );
    return {
      reqId: r.req_id,
      commId: r.comm.comm_id,
      commName: r.comm.comm_name,
      reqAt: kstDate(r.req_at),
      kind: s.kind,
      viewUntil: s.viewUntil ? formatDate(s.viewUntil) : null,
    };
  });

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">안녕하세요, {user.name}님</h1>
        <p className="text-muted-foreground">
          {isAdmin(user)
            ? "총괄담당자 계정입니다. 모든 위원회를 관리할 수 있습니다."
            : "부서 담당자 계정입니다. 본인이 담당자로 지정된 위원회를 관리할 수 있습니다."}
        </p>
      </div>
      <ExpiryAlerts alerts={dashboard.alerts} />
      <AccessInbox inbox={inbox} mine={mine} />
      <HomeSummary data={dashboard} />
    </section>
  );
}
