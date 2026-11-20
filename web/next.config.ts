import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-libsql", "@libsql/client"],
  /* PM2 生产纳管期间跑 dev 用 NEXT_DIST_DIR=.next-dev 隔离，避免 turbopack 污染生产 .next */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
