/**
 * 구조 검사: 서버 동작(Server Action)은 모두 서버에서 권한을 먼저 확인해야 한다. (CLAUDE.md 규칙 1)
 *
 * 서버 동작은 화면을 거치지 않고 직접 호출될 수 있으므로, 파일 내용으로 다음을 확인한다.
 * - src/app 아래 "use server" 파일의 모든 내보낸 함수는 첫 문장이 권한 관문으로 시작한다.
 *   · return adminAction(   — 총괄 전용 (3단계 완료 기준)
 *   · return userAction(    — 로그인 사용자. 이 경우 본문에서 대상별 권한 판정 함수를 반드시 부른다 (4단계 완료 기준)
 *   · await requireUser( / getCurrentUser( — 본인 정보만 다루는 동작
 * - 관리 화면(page.tsx)은 requireAdminPage()로 권한을 확인한다.
 * - Route Handler(route.ts)의 내보낸 GET/POST 등은 첫 문장이 `const user = await requireUser(`다 (8단계, 엑셀 내보내기).
 * 예외: 로그인 화면(로그인 전이므로 확인할 사용자가 없다)
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_DIR = path.join(process.cwd(), "src", "app");
const ADMIN_DIR = path.join(APP_DIR, "(main)", "admin");

/** 로그인 전 동작이라 권한 확인 대상이 아닌 파일 */
const EXEMPT = [path.join("src", "app", "login", "actions.ts")];

/** userAction 본문에서 반드시 하나 이상 불러야 하는 대상별 권한 판정 함수 */
const TARGET_CHECKS = ["checkCommCreate(", "checkCommUpdate(", "assertPermission("];

const ALLOWED_STARTS = [
  "return adminAction(",
  "return userAction(",
  "await requireUser(",
  "const user = await requireUser(",
  "if (await getCurrentUser())",
];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".test.ts"))
    .map((e) => path.join(e.parentPath, e.name));
}

/** `export async function 이름(...) { ... }` 마다 이름과 본문 전체를 돌려준다 */
export function exportedFunctions(source: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /export\s+async\s+function\s+(\w+)\s*(?:<[^>]*>)?\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    // 매개변수 괄호를 끝까지 건너뛴다
    let i = m.index + m[0].length;
    let depth = 1;
    while (depth > 0 && i < source.length) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")") depth--;
      i++;
    }
    // 본문 시작은 줄 끝의 `{` (반환 타입 안의 `{ commId: string }` 같은 것과 구분)
    const bodyOpen = /\{[ \t]*\r?\n/g;
    bodyOpen.lastIndex = i;
    const start = bodyOpen.exec(source)?.index ?? -1;
    let braces = 0;
    let end = start;
    for (; end < source.length; end++) {
      if (source[end] === "{") braces++;
      else if (source[end] === "}" && --braces === 0) break;
    }
    out.push({ name: m[1], body: source.slice(start + 1, end).trim() });
  }
  return out;
}

const serverFiles = walk(APP_DIR).filter((f) => readFileSync(f, "utf8").trimStart().startsWith('"use server"'));

describe("모든 서버 동작은 권한 관문으로 시작한다", () => {
  it("검사할 서버 동작 파일이 있다", () => {
    expect(serverFiles.length).toBeGreaterThanOrEqual(5);
  });

  for (const file of serverFiles) {
    const rel = path.relative(process.cwd(), file);
    if (EXEMPT.includes(rel)) continue;
    const isAdminFile = file.startsWith(ADMIN_DIR);

    for (const fn of exportedFunctions(readFileSync(file, "utf8"))) {
      it(`${rel} → ${fn.name}()`, () => {
        if (isAdminFile) {
          // 관리 화면은 총괄 전용
          expect(fn.body.startsWith("return adminAction(")).toBe(true);
          return;
        }
        expect(ALLOWED_STARTS.some((s) => fn.body.startsWith(s))).toBe(true);
        if (fn.body.startsWith("return userAction(")) {
          // 로그인만 확인하므로 대상별 권한 판정이 본문에 있어야 한다
          expect(TARGET_CHECKS.some((c) => fn.body.includes(c))).toBe(true);
        }
      });
    }
  }
});

describe("관리 화면은 모두 requireAdminPage()로 권한을 확인한다", () => {
  for (const file of walk(ADMIN_DIR).filter((f) => f.endsWith("page.tsx"))) {
    it(path.relative(process.cwd(), file), () => {
      expect(readFileSync(file, "utf8")).toMatch(/await requireAdminPage\(\)/);
    });
  }
});

/** 로그인 처리 자체를 맡는 Better Auth 주소는 검사 대상이 아니다 */
const ROUTE_EXEMPT = [path.join("src", "app", "api", "auth")];

describe("모든 Route Handler는 권한 관문으로 시작한다", () => {
  const routeFiles = walk(APP_DIR).filter(
    (f) => /route\.ts$/.test(f) && !ROUTE_EXEMPT.some((e) => path.relative(process.cwd(), f).startsWith(e)),
  );
  it("검사할 Route Handler가 있다", () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(1);
  });
  for (const file of routeFiles) {
    const fns = exportedFunctions(readFileSync(file, "utf8"));
    for (const fn of fns) {
      it(`${path.relative(process.cwd(), file)} → ${fn.name}()`, () => {
        expect(fn.body.startsWith("const user = await requireUser(")).toBe(true);
      });
    }
  }
});
