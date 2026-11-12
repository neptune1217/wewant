import { isAdmin, requireUser } from "@/lib/permissions";

/** 홈 — 9단계에서 담당 위원회 요약·임기만료 알림·열람 요청으로 채운다 */
export default async function HomePage() {
  const user = await requireUser();

  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold">안녕하세요, {user.name}님</h1>
      <p className="text-muted-foreground">
        {isAdmin(user)
          ? "총괄담당자 계정입니다. 모든 위원회를 관리할 수 있습니다."
          : "부서 담당자 계정입니다. 본인이 담당자로 지정된 위원회를 관리할 수 있습니다."}
      </p>
      <p className="mt-6 text-sm text-muted-foreground">
        담당 위원회 요약, 임기만료 예정자, 열람 요청은 이후 단계에서 이 화면에 표시됩니다.
      </p>
    </section>
  );
}
