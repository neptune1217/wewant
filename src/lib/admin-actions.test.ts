/**
 * 구조 검사: 관리 화면(src/app/(main)/admin)의 서버 동작은 모두 총괄 권한을 먼저 확인해야 한다.
 * (CLAUDE.md 규칙 1, 3단계 완료 기준 "부서 계정은 주소를 직접 입력해도 접근 거부")
 *
 * 서버 동작은 브라우저에서 화면을 거치지 않고 직접 호출될 수 있으므로,
 * 각 함수 본문이 `return adminAction(`으로 시작하는지 파일 내용으로 확인한다.
 * 화면(page.tsx)은 requireAdminPage()를 부르는지 확인한다.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ADMIN_DIR = path.join(process.cwd(), "src", "app", "(main)", "admin");

function filesNamed(dir: string, name: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name === name)
    .map((e) => path.join(e.parentPath, e.name));
}

/** `export async function 이름(...)` 마다 본문 첫 문장을 돌려준다 */
function exportedFunctionBodies(source: string): { name: string; firstStatement: string }[] {
  const out: { name: string; firstStatement: string }[] = [];
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
    // 반환 타입(Promise<ActionResult<...>>)에는 `{`가 없으므로 다음 `{`가 본문 시작이다
    const bodyStart = source.indexOf("{", i);
    const body = source.slice(bodyStart + 1).trimStart();
    out.push({ name: m[1], firstStatement: body.split("\n")[0].trim() });
  }
  return out;
}

const actionFiles = filesNamed(ADMIN_DIR, "actions.ts");
const pageFiles = filesNamed(ADMIN_DIR, "page.tsx");

describe("관리 화면 서버 동작은 모두 총괄 권한부터 확인한다", () => {
  it("검사할 파일이 있다", () => {
    expect(actionFiles.length).toBeGreaterThanOrEqual(3);
  });

  for (const file of actionFiles) {
    const rel = path.relative(process.cwd(), file);
    const source = readFileSync(file, "utf8");
    const fns = exportedFunctionBodies(source);

    it(`${rel}: "use server" 파일`, () => {
      expect(source.trimStart().startsWith('"use server"')).toBe(true);
    });

    it(`${rel}: 내보낸 함수가 1개 이상`, () => {
      expect(fns.length).toBeGreaterThan(0);
    });

    for (const fn of fns) {
      it(`${rel} → ${fn.name}()는 return adminAction(으로 시작`, () => {
        expect(fn.firstStatement.startsWith("return adminAction(")).toBe(true);
      });
    }
  }
});

describe("관리 화면은 모두 requireAdminPage()로 권한을 확인한다", () => {
  for (const file of pageFiles) {
    const rel = path.relative(process.cwd(), file);
    it(rel, () => {
      expect(readFileSync(file, "utf8")).toMatch(/await requireAdminPage\(\)/);
    });
  }
});
