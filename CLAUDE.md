# wewant — 춘천시 위원회·위원 통합관리 시스템

춘천시청 각 부서 담당자가 엑셀로 따로 관리하던 위원회·위원 정보를 하나의 DB로 통합 관리하는 웹 시스템. 현재는 **프로토타입**이며 모든 데이터는 가상이다.

## 먼저 읽을 문서
- `docs/개발계획.md` — 기술스택, 권한 설계, 단계별 진행 순서와 완료 기준
- `docs/데이터모델.md` — 테이블·필드·계산 규칙. **원본 자료와 다르면 이 문서가 우선**
- 원본 자료: `테이블 설명.txt`, `필드변수 설명.txt`, `테이블 및 필드명(예시데이터 포함).xlsx`

## 기술스택 (버전 고정)
- Next.js 16 (App Router, TypeScript, Server Actions) — 요청 가로채기 파일은 `middleware.ts`가 아니라 `proxy.ts`
- PostgreSQL (Docker Compose)
- Prisma ORM **7** — `prisma@7`, `@prisma/client@7`로 설치. `@latest`는 8 RC가 설치되므로 쓰지 않는다
- Better Auth (아이디+비밀번호, DB 세션). Auth.js/NextAuth는 쓰지 않는다
- Tailwind CSS + shadcn/ui, TanStack Table, Recharts, ExcelJS, Zod
- Vitest(규칙 계산), Playwright(권한 시나리오)

라이브러리 설정 방법이 확실하지 않으면 추측하지 말고 해당 버전의 공식 문서를 확인한다.

## 작업 방식
- **한 번에 한 단계만** 진행한다. `docs/개발계획.md`의 단계 순서를 따르고, 완료 기준을 통과하기 전에는 다음 단계로 넘어가지 않는다.
- 코드를 쓰기 전에 만들거나 바꿀 파일 목록과 접근 방법을 먼저 설명하고 확인을 받는다.
- 단계마다 브랜치를 만들고, 완료 기준을 통과하면 커밋한다.
- 사용자는 전문 개발자가 아니다. 설명은 한국어로, 실행할 명령은 그대로 복사해 쓸 수 있게 적는다.

## 반드시 지킬 규칙
1. **권한 검사는 서버에서 한다.** 모든 Server Action과 Route Handler는 `src/lib/permissions.ts`의 함수를 거친다. 화면에서 버튼을 숨기는 것만으로는 안 된다.
2. **편집 권한 기준은 위원회의 `mng_user_id` 한 사람**이다. 같은 부서 동료라도 편집할 수 없다. 총괄(r01)은 전체 가능.
3. **삭제는 비활성화로 처리한다.** 행을 실제로 지우지 않는다.
4. **스키마 변경은 Prisma 마이그레이션으로만** 하고, 바꿀 때 `docs/데이터모델.md`도 함께 고친다.
5. **TB_Pos 행은 위촉 건이 참조 중이면 수정하지 않는다.** 소속직위 변경은 위촉 건의 `pos_id` 교체로 처리한다(데이터모델 "직위 변경 규칙").
6. **중복위촉은 차단하지 않고 경고만** 한다. 카운트는 위촉직만, 당연직은 제외.
7. 임기만료 예정일 기본값은 `위촉일 + 임기년수 − 1일`.
8. 임기·연임·중복위촉·권한 로직은 순수 함수로 분리하고 **테스트를 먼저** 작성한다. 이후 작업에서 이 테스트가 깨지면 멈추고 알린다.
9. 생성·수정·삭제·엑셀 내보내기는 TB_AuditLog에 기록한다.
10. DB 테이블·필드 이름은 데이터모델 문서의 표기(`TB_Comm`, `comm_id` 등)를 유지한다. UI 문구는 모두 한국어.
11. 비밀번호·DB 접속정보는 `.env`에만 두고 커밋하지 않는다.
12. 실제 개인정보를 넣지 않는다. 시드와 테스트는 가상 데이터만 사용한다.

## 현재 진행 상태
- [x] 0단계 준비 (문서, CLAUDE.md)
- [x] 1단계 프로젝트 뼈대와 DB
- [x] 2단계 로그인과 권한 골격
- [x] 3단계 기준정보 관리 (총괄 전용)
- [x] 4단계 위원회 관리
- [x] 5단계 인물·소속직위·위촉 (핵심)
- [x] 6단계 중복위촉 조회와 경고
- [x] 7단계 열람 요청·승인
- [x] 8단계 필터와 엑셀 내보내기

## 구현 메모 (1단계에서 확정)
- Prisma 생성 코드는 `src/generated/prisma`(커밋 안 함). 가져오기: `@/generated/prisma/client`, 선택값은 `@/generated/prisma/enums`
- 앱에서 DB는 `src/lib/db.ts`의 `prisma`만 쓴다(서버 전용)
- 선택값은 코드에서 영문(`GUKSO`), DB에는 한글(`국소`). 한글 표기 변환은 `src/lib/enum-labels.ts`
- 고유코드 자동 채번은 DB 시퀀스(`tb_dept_seq` 등) — 첫 마이그레이션 SQL에 직접 추가함
- Prisma 7은 시드를 자동 실행하지 않는다 → `npm run db:seed`
- 시청 내부망 운영 전제라 외부 웹폰트(Google Fonts)를 쓰지 않는다. shadcn 설치·추가 시 `next/font/google`이 다시 들어오면 제거한다

## 구현 메모 (2단계에서 확정)
- 인증: Better Auth 1.7.22 (`src/lib/auth.ts`). TB_User가 사용자 테이블을 겸하며, Prisma 필드명만 `id`(DB 컬럼은 `user_id`)
- 화면·서버 동작은 `src/lib/permissions.ts`의 `requireUser()` / `requireAdmin()` / `assertPermission()`을 쓴다. 판정 규칙은 `src/lib/rules/permission-rules.ts`(순수 함수, 테스트 있음)
- `src/proxy.ts`는 로그인 쿠키 유무만 보는 1차 확인. 진짜 확인은 `requireUser()`
- 로그인 화면 서버 액션만 권한 확인 예외(로그인 전이므로)
- Better Auth HTTP 주소는 로그인·로그아웃·세션·비밀번호 변경만 열려 있다(`disabledPaths`). 사용자 정보 변경은 앱의 서버 액션이 권한 확인 후 Prisma로 처리
- Next.js `cacheComponents`는 끔(모든 화면이 로그인 사용자별)
- shadcn/ui 4.23.0 (radix, `components.json`). Vitest는 4 (Better Auth와의 의존성 충돌 때문)

## 공통 화면 패턴 (3단계에서 확정 — 4단계 이후 그대로 재사용)
- 화면 구성: `page.tsx`(서버: 권한 확인 → DB 조회 → 표 데이터로 변환) + `xxx-table.tsx`(클라이언트: 열 정의·대화상자) + `actions.ts`(서버 동작)
- 목록: `src/components/data-table/data-table.tsx` (TanStack Table **v9** — `useTable`, `tableFeatures`. v8 문법 `useReactTable`을 쓰지 않는다). 선택 필터 열에는 `filterFn: "equalsString"`
- 등록·수정: `FormDialog` + `FormField`/`SelectField`/`FieldError`. 확인: `ConfirmDialog`. 상태: `StatusBadge`
- 서버 동작은 `ActionResult`(`src/lib/action-result.ts`)를 돌려준다. 입력 검사는 Zod 스키마(`src/lib/validation/`)를 화면과 서버가 공유
- 관리자 서버 동작은 본문이 `return adminAction(...)`으로 시작해야 한다(`src/lib/admin-actions.test.ts`가 검사). 관리자 화면은 `requireAdminPage()`
- 변경은 트랜잭션 안에서 `writeAudit()`로 이력을 남긴다. 비활성화는 action `삭제`, 다시 활성화는 `수정`으로 기록
- 스키마를 바꾼 뒤에는 개발 서버를 다시 시작한다(실행 중인 서버가 예전 Prisma 연결을 붙잡고 있음)
- 로그인 사용자용 서버 동작은 `return userAction(...)`으로 시작하고, 본문에서 대상별 판정(`checkCommUpdate`, `assertPermission` 등)을 반드시 부른다. `src/lib/server-actions.test.ts`가 src/app의 모든 서버 동작을 검사한다(예외: 로그인)
- 권한이 없는 대상의 상세 값은 화면(클라이언트)으로 보내지 않는다. 목록 행에는 기본 정보만, 수정용 값은 편집 권한이 있을 때만 싣는다

## 구현 메모 (4단계에서 확정)
- 위원회 승인: 부서 계정 등록 → 승인 대기, 총괄 승인 후 집계 포함. **모든 집계(통계·중복위촉·홈 요약)는 `isCountedComm` / `COUNTED_COMM_WHERE`(활성+승인)만 센다**
- 위원회 권한 판정은 `getCommAccess(commId)`(상세 화면)와 `checkCommCreate`/`checkCommUpdate`(서버 동작)
- 목록 표 `hiddenColumns`: 필터에만 쓰고 화면에 숨길 열

## 구현 메모 (5단계에서 확정)
- 위촉 흐름별 날짜 처리는 `docs/데이터모델.md` "위촉 업무 흐름" 표가 기준. 계산은 `term.ts`(resolveExpireDue, nextTermDates, positionChangeDates, dDay), 규칙은 `appoint-rules.ts`
- **연임횟수 = 연속된 임기의 연임 수**: 가장 최근 신규(보궐) 위촉 이후의 "연임" 건만 센다. 공백 후 신규 위촉되면 0회로 초기화. 사용자 확인 예시 2가지가 테스트에 있다
- 경고 후 저장: 서버 동작이 `needsConfirm(warnings)`를 돌려주면 화면이 `confirm_warnings=Y`를 붙여 다시 보낸다(`FormDialog`가 자동 처리, 신규 위촉 대화상자는 직접 처리)
- 위촉·인물 서버 동작: `src/app/(main)/committees/[commId]/appoint-actions.ts`, `person-actions.ts`. 검색류는 `const user = await requireUser()`로 시작
- 명부 행에는 편집 권한이 있을 때만 인물·소속직위 편집용 값을 싣는다
- 데이터가 있는 테이블에 필수 칸·고유 제약을 추가하면 `migrate dev`가 확인 질문으로 멈춘다 → `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`로 SQL을 만들어 마이그레이션 폴더에 넣고 `migrate dev`로 적용

## 구현 메모 (6단계에서 확정)
- 중복위촉 규칙은 `src/lib/rules/duplicate-rules.ts`(순수 함수, 테스트 있음), DB 조회는 `src/lib/duplicates.ts`(`getDupSummaries`, `getActiveAppointRows`, `currentAppointedCount`)
- 위촉직 건수 = 재임 중 위촉직이 있는 집계 대상 위원회(활성+승인) 수. 당연직·해촉·승인 대기·비활성 제외, 인물은 `person_id`로 구분
- 경고 아이콘은 `src/components/dup-warning-icon.tsx`. 명부·신규 위촉 인물 검색·중복위촉 조회 화면에서 쓴다. 아이콘 정보에는 위원회명만 담는다
- 신규 위촉 경고는 `createAppoint`의 경고 목록(정원 초과와 함께)에 들어가고, 확인 후 저장되면 이력의 `warnings`에 남는다
- 조회 화면은 `/committees/duplicates` (GET 검색, 서버 동작 없음)
- shadcn 컴포넌트는 `cn`을 `"cn"` 패키지에서 가져온다(기존 파일과 같게 유지)

## 구현 메모 (7단계에서 확정)
- 열람 규칙은 `src/lib/rules/access-rules.ts`(viewUntilDate, accessStatus, requestBlockReason), 요청·처리 권한은 `permission-rules.ts`의 `canRequestAccess` / `canDecideAccess`
- 서버 동작은 `src/app/(main)/committees/[commId]/access-actions.ts`(requestAccess, decideAccess). 처리는 대기 상태일 때만 `updateMany`로 바꿔 중복 처리를 막는다
- `getCommAccess()`가 본인 요청 상태(`myAccess`)를 함께 돌려준다. 열람 중(편집 불가)이면 상세 화면에 읽기 전용 안내
- 위원회 목록의 위원회명은 항상 상세 링크(권한이 없으면 상세 화면에서 열람 요청)
- 홈의 열람 요청 처리함은 `src/app/(main)/access-inbox.tsx`. 9단계 대시보드는 이 화면에 덧붙인다

## 구현 메모 (8단계에서 확정)
- 위원 조회 `/members` + 엑셀 `/members/export`(Route Handler). 데이터는 `src/lib/members.ts`의 `loadMemberRows(user)` — 열람 가능 위원회만(`viewableComms`)
- 필터는 주소 조건 → `parseMemberFilter` → `filterMembers`(`src/lib/rules/member-filter.ts`, 테스트 있음). 화면과 엑셀이 같은 함수를 써서 건수가 같다. 화면 표에는 따로 검색칸을 두지 않는다(`DataTable searchable={false}`)
- Route Handler는 첫 문장이 `const user = await requireUser(`여야 한다(`server-actions.test.ts`가 검사, `api/auth` 제외)
- 내보내기 이력은 `writeAudit({ action: EXPORT, detail: {...} })` — 조건과 행 수를 그대로 남긴다
