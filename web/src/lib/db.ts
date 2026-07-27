import path from "path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function resolveDbUrl(): string {
  const raw = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!raw.startsWith("file:")) {
    return raw;
  }
  const rel = raw.slice("file:".length);
  if (path.isAbsolute(rel)) {
    return raw;
  }
  const abs = path.resolve(process.cwd(), rel.replace(/^\.\//, ""));
  return `file:${abs}`;
}

function createClient(): PrismaClient {
  const adapter = new PrismaLibSql({ url: resolveDbUrl() });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
