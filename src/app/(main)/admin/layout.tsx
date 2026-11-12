import { UserInfoNav } from "@/components/layout/user-info-nav";
import { requireAdminPage } from "@/lib/permissions";

/** 기준정보 관리(총괄 전용) 공통 틀. 각 화면과 서버 동작도 따로 권한을 확인한다. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdminPage();
  return (
    <>
      <UserInfoNav isAdmin />
      {children}
    </>
  );
}
