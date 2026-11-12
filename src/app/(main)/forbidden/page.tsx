import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "접근 권한 없음 | 춘천시 위원회·위원 통합관리" };

/** 권한이 없는 화면에 들어왔을 때 보여 주는 안내 */
export default async function ForbiddenPage() {
  await requireUser();
  return (
    <section className="flex flex-col items-start gap-3 py-10">
      <h1 className="text-xl font-semibold">접근 권한이 없습니다</h1>
      <p className="text-muted-foreground">
        이 화면은 총괄담당자만 사용할 수 있습니다. 필요하면 총괄담당자에게 요청하세요.
      </p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        홈으로
      </Link>
    </section>
  );
}
