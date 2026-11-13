import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { UserInfoNav } from "@/components/layout/user-info-nav";
import { buttonVariants } from "@/components/ui/button";
import { canViewUser, isAdmin, requireUser } from "@/lib/permissions";
import { loadManagedComms, loadRecentActivity, loadUserProfile } from "@/lib/user-info";
import { ActivityTable, ManagedCommList, ProfileList } from "../user-info-sections";

export const metadata: Metadata = { title: "사용자 상세 | 춘천시 위원회·위원 통합관리" };

/**
 * 사용자 상세 — 기본 정보, 담당 위원회, 최근 활동 이력.
 * 총괄은 누구든, 부서 계정은 본인만 (canViewUser). 다른 사람이면 있든 없든 권한 없음으로 보낸다.
 */
export default async function UserDetailPage({ params }: PageProps<"/users/[userId]">) {
  const user = await requireUser();
  const { userId } = await params;
  if (!canViewUser(user, userId)) redirect("/forbidden");

  const profile = await loadUserProfile(userId);
  if (!profile) notFound();
  const [comms, activity] = await Promise.all([loadManagedComms(userId), loadRecentActivity(userId)]);
  const self = user.userId === userId;

  return (
    <>
      <UserInfoNav isAdmin={isAdmin(user)} />
      <section className="flex max-w-3xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">
            {self ? "내 정보" : `${profile.name} 님 정보`}
          </h1>
          {isAdmin(user) && !self && (
            <Link href="/admin/users" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              ← 사용자 관리
            </Link>
          )}
        </div>
        <ProfileList profile={profile} />
        <ManagedCommList comms={comms} />
        <ActivityTable rows={activity} />
      </section>
    </>
  );
}
