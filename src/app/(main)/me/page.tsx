import type { Metadata } from "next";
import Link from "next/link";
import { UserInfoNav } from "@/components/layout/user-info-nav";
import { buttonVariants } from "@/components/ui/button";
import { isAdmin, requireUser } from "@/lib/permissions";
import { loadManagedComms, loadUserProfile } from "@/lib/user-info";
import { ManagedCommList, ProfileList } from "../users/user-info-sections";

export const metadata: Metadata = { title: "사용자정보 | 춘천시 위원회·위원 통합관리" };

/** 사용자정보 — 본인 정보 열람, 담당 위원회, 비밀번호 변경. 총괄에게는 관리 메뉴(사용자·부서·직위명)가 함께 보인다 */
export default async function MePage() {
  const user = await requireUser();
  const [profile, comms] = await Promise.all([loadUserProfile(user.userId), loadManagedComms(user.userId)]);

  return (
    <>
      <UserInfoNav isAdmin={isAdmin(user)} />
      <section className="flex max-w-3xl flex-col gap-5">
        <h1 className="text-xl font-semibold">사용자정보</h1>
        {profile && <ProfileList profile={profile} />}
        <div className="flex flex-wrap gap-2">
          <Link href="/change-password" className={buttonVariants({ variant: "outline" })}>
            비밀번호 변경
          </Link>
          <Link href={`/users/${user.userId}`} className={buttonVariants({ variant: "ghost" })}>
            내 활동 이력 보기
          </Link>
        </div>
        <ManagedCommList comms={comms} />
      </section>
    </>
  );
}
