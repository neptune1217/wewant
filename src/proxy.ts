/**
 * 요청 가로채기 (Next.js 16에서 middleware.ts → proxy.ts)
 *
 * 로그인 쿠키가 아예 없으면 로그인 화면으로 보내는 "1차 확인"만 한다.
 * 쿠키가 진짜 유효한지, 사용자가 활성 상태인지는 서버의 requireUser()가 확인한다.
 * (Next.js 문서: Proxy는 낙관적 확인용이며 전체 인증·권한 수단으로 쓰지 않는다)
 */
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/** 로그인하지 않아도 열리는 주소 */
const PUBLIC_PATHS = ["/login", "/api/auth"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // 정적 파일·이미지·파비콘은 제외
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
