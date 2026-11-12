import { logoutAction } from "@/app/logout-action";
import { MainNav } from "@/components/layout/main-nav";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/permissions";

/** 로그인 후 공통 화면: 상단 제목·사용자·로그아웃, 4개 탭 */
export default async function MainLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col px-4">
          <div className="flex items-center justify-between gap-4 pt-3">
            <span className="font-semibold">춘천시 위원회·위원 통합관리</span>
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-muted-foreground sm:inline">
                {user.deptName} · {user.name} ({user.authName})
              </span>
              <form action={logoutAction}>
                <Button type="submit" variant="outline" size="sm">
                  로그아웃
                </Button>
              </form>
            </div>
          </div>
          <MainNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
