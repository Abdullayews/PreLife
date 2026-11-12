import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 client — engine-less, connected through the better-sqlite3
 * driver adapter. The URL comes from Next's .env loading at runtime
 * (fallback matches .env.example).
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrisma(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:../db/custom.db",
  });
  return new PrismaClient({ adapter, log: ["query"] });
}

export const db = globalForPrisma.prisma ?? createPrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
