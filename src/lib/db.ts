import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 client — engine-less, connected through the better-sqlite3
 * driver adapter.
 *
 * Relative `file:` URLs are resolved against the PROJECT ROOT before the
 * adapter sees them: Next's standalone server chdirs into
 * `.next/standalone` at boot (`process.chdir(__dirname)`), so a bare
 * `./db/custom.db` would otherwise point inside the build output. This
 * keeps `DATABASE_URL=file:./db/custom.db` working identically in
 * `next dev` (cwd = repo root) and in production standalone.
 */
const DEFAULT_URL = "file:./db/custom.db";

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? DEFAULT_URL;
  const match = /^file:(\.\/|\.\.\/)/.exec(url);
  if (!match) return url; // absolute path, :memory:, or a foreign scheme — pass through
  let base = process.cwd();
  if (base.endsWith(`${path.sep}.next${path.sep}standalone`)) {
    base = path.resolve(base, "..", "..");
  }
  return `file:${path.resolve(base, url.slice("file:".length))}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrisma(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: resolveDatabaseUrl() });
  return new PrismaClient({ adapter, log: ["query"] });
}

export const db = globalForPrisma.prisma ?? createPrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
