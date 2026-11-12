import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 CLI configuration. Connection URLs moved here from the schema;
 * dotenv loads .env because the CLI no longer does it automatically. At
 * runtime Next.js loads .env itself and src/lib/db.ts passes the URL to
 * the PrismaBetterSqlite3 driver adapter.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./db/custom.db",
  },
});
