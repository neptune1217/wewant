// Prisma 7 설정 파일. Prisma 7은 .env를 스스로 읽지 않으므로 dotenv를 먼저 불러온다.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Prisma 7은 시드를 자동 실행하지 않는다. `npx prisma db seed`로 직접 실행한다.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
