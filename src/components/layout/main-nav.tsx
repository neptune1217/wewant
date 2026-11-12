"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "홈" },
  { href: "/committees", label: "위원회·위원" },
  { href: "/stats", label: "통계" },
  { href: "/me", label: "사용자정보" },
] as const;

/** 로그인 후 상단의 4개 탭 */
export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="주 메뉴" className="flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
