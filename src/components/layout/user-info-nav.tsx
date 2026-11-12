"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/me", label: "내 정보", adminOnly: false },
  { href: "/admin/users", label: "사용자 관리", adminOnly: true },
  { href: "/admin/depts", label: "부서 관리", adminOnly: true },
  { href: "/admin/positions", label: "위원회 직위명", adminOnly: true },
] as const;

/** 사용자정보 탭의 하위 메뉴. 관리 메뉴는 총괄에게만 보인다 (권한 확인은 서버가 따로 한다) */
export function UserInfoNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => isAdmin || !i.adminOnly);
  if (items.length <= 1) return null;

  return (
    <nav aria-label="사용자정보 메뉴" className="mb-6 flex flex-wrap gap-2">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
