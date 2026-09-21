"use client";

import type { ReactNode } from "react";
import { MeProvider } from "@/components/console";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return <MeProvider>{children}</MeProvider>;
}
