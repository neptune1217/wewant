"use client";

import { TriangleAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type DupWarningInfo = {
  count: number;
  warn: boolean;
  label: string;
  commNames: string[];
};

/**
 * 위촉직 4개 이상인 인물 이름 옆 경고 아이콘.
 * 마우스를 올리거나 키보드로 초점을 주면 "위촉직 N개 위원회 중복 위촉"과 위원회 목록을 보여 준다.
 */
export function DupWarningIcon({ info }: { info?: DupWarningInfo | null }) {
  if (!info?.warn) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${info.label}: ${info.commNames.join(", ")}`}
            className="inline-flex align-middle text-amber-600 hover:text-amber-700 focus-visible:outline-2 focus-visible:outline-ring dark:text-amber-400"
            onClick={(e) => e.stopPropagation()}
          >
            <TriangleAlert className="size-4" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="block">
          <p className="font-semibold">{info.label}</p>
          <ul className="mt-1 list-disc pl-4">
            {info.commNames.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
