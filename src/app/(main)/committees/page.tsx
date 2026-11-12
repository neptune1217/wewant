import type { Metadata } from "next";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "위원회·위원 | 춘천시 위원회·위원 통합관리" };

/** 위원회·위원 — 4단계(위원회 관리)부터 채운다 */
export default async function CommitteesPage() {
  await requireUser();
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold">위원회·위원</h1>
      <p className="text-muted-foreground">위원회 목록과 위원 명부는 4단계에서 만듭니다.</p>
    </section>
  );
}
