import { Badge } from "@/components/ui/badge";

/** 활성/비활성 표시 */
export function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge variant="secondary">활성</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      비활성
    </Badge>
  );
}

/** 목록 필터용: 활성 여부를 문자열 값으로 */
export const activeValue = (active: boolean) => (active ? "Y" : "N");

export const ACTIVE_FILTER_OPTIONS = [
  { value: "Y", label: "활성" },
  { value: "N", label: "비활성" },
];
