import { Badge } from "@/components/ui/badge";
import { COMM_STATUS_LABEL, type CommStatus } from "@/lib/rules/comm-rules";

/** 위원회 상태: 운영 중 / 승인 대기 / 비활성 */
export function CommStatusBadge({ status }: { status: CommStatus }) {
  if (status === "ACTIVE") return <Badge variant="secondary">{COMM_STATUS_LABEL.ACTIVE}</Badge>;
  if (status === "PENDING") {
    return (
      <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
        {COMM_STATUS_LABEL.PENDING}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {COMM_STATUS_LABEL.INACTIVE}
    </Badge>
  );
}
