// Better Auth가 로그인·로그아웃·세션 요청을 처리하는 주소 (/api/auth/...)
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
