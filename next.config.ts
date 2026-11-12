import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 캐시 컴포넌트(cacheComponents)는 끈다.
  // 모든 화면이 로그인 후 사용자별로 보이는 내부 업무 시스템이라 요청마다 새로 만드는 방식이 단순하고 안전하다.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
