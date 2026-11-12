// 1단계 임시 화면. 2단계에서 로그인 화면과 공통 레이아웃으로 바뀐다.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-2xl font-semibold">춘천시 위원회·위원 통합관리 시스템</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        프로토타입입니다. 모든 데이터는 가상 데이터입니다.
      </p>
      <p className="text-sm text-zinc-500">현재 진행: 1단계 — 프로젝트 뼈대와 DB</p>
    </main>
  );
}
