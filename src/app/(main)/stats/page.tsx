import type { Metadata } from "next";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "통계 | 춘천시 위원회·위원 통합관리" };

/** 통계 — 10단계에서 채운다 */
export default async function StatsPage() {
  await requireUser();
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold">통계</h1>
      <p className="text-muted-foreground">위원회·위원 통계는 10단계에서 만듭니다.</p>
    </section>
  );
}
