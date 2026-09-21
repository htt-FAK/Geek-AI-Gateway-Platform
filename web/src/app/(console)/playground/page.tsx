"use client";

import { Suspense } from "react";
import PlaygroundInner from "./playground-inner";

export default function PlaygroundPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-[var(--text-tertiary)]">
          加载调试台…
        </div>
      }
    >
      <PlaygroundInner />
    </Suspense>
  );
}
