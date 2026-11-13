import { Badge } from "@/components/ui/badge";
import type { AccessStatusKind } from "@/lib/rules/access-rules";

/** 열람 요청 상태 표시 (요청 없음은 표시하지 않음) */
export function AccessStatusBadge({ kind, viewUntil }: { kind: AccessStatusKind; viewUntil: string | null }) {
  switch (kind) {
    case "APPROVED":
      return <Badge variant="secondary">열람 중 ~{viewUntil}</Badge>;
    case "PENDING":
      return <Badge variant="outline">열람 요청 대기</Badge>;
    case "REJECTED":
      return <Badge variant="outline" className="text-muted-foreground">열람 거절</Badge>;
    case "EXPIRED":
      return <Badge variant="outline" className="text-muted-foreground">열람 만료</Badge>;
    default:
      return null;
  }
}
