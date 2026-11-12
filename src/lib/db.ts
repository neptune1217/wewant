/**
 * 앱 전체가 함께 쓰는 Prisma 클라이언트 (서버 전용).
 * 개발 중 코드가 다시 불려도 DB 연결이 계속 늘어나지 않도록 하나만 만들어 재사용한다.
 */
import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL이 설정되지 않았습니다 (.env 확인)");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
