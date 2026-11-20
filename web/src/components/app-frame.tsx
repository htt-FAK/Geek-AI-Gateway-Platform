"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/shell";

const BARE_PATHS = new Set(["/", "/login", "/change-password"]);

/** 控制台壳只挂一次，换页时侧栏不重挂，激活条才能滑过去。 */
export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (BARE_PATHS.has(pathname)) return children;
  return <AppShell>{children}</AppShell>;
}
