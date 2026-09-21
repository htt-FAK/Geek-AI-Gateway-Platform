"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";

export type MePayload = {
  phone: string;
  models: string[];
  keyMode: string;
  keyMasked: string | null;
  keyRevealedAt: string | null;
  gatewayUrl: string;
  canRevealKey: boolean;
  canRegenerateKey: boolean;
  budget: {
    dailyUsed: number;
    weeklyUsed: number;
    monthlyUsed: number;
    dailyLimit: number;
    weeklyLimit: number;
    monthlyLimit: number;
  };
};

type MeState = {
  me: MePayload | null;
  error: string;
  refresh: () => Promise<MePayload | null>;
  setMe: React.Dispatch<React.SetStateAction<MePayload | null>>;
};

const MeContext = createContext<MeState | null>(null);

const ME_TTL_MS = 15_000;
let meCache: { data: MePayload; at: number } | null = null;
let meInflight: Promise<MePayload | null> | null = null;

export function invalidateMeCache() {
  meCache = null;
  meInflight = null;
}

async function loadMe(opts?: { force?: boolean }): Promise<MePayload | null> {
  if (!opts?.force && meCache && Date.now() - meCache.at < ME_TTL_MS) {
    return meCache.data;
  }
  if (!opts?.force && meInflight) {
    return meInflight;
  }
  const run = (async () => {
    const res = await fetch("/api/me");
    if (!res.ok) return null;
    const data = (await res.json()) as MePayload;
    meCache = { data, at: Date.now() };
    return data;
  })();
  meInflight = run;
  try {
    return await run;
  } finally {
    if (meInflight === run) meInflight = null;
  }
}

function useMeController(): MeState {
  const router = useRouter();
  const [me, setMe] = useState<MePayload | null>(() =>
    meCache && Date.now() - meCache.at < ME_TTL_MS ? meCache.data : null,
  );
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      invalidateMeCache();
      const data = await loadMe({ force: true });
      if (!data) {
        setMe(null);
        router.replace("/login");
        return null;
      }
      setMe(data);
      return data;
    } catch {
      setError("加载失败");
      return null;
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await loadMe();
        if (cancelled) return;
        if (!data) {
          router.replace("/login");
          return;
        }
        setMe(data);
      } catch {
        if (!cancelled) setError("加载失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { me, error, refresh, setMe };
}

export function MeProvider({ children }: { children: ReactNode }) {
  const value = useMeController();
  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe(): MeState {
  const ctx = useContext(MeContext);
  if (!ctx) {
    throw new Error("useMe must be used within MeProvider");
  }
  return ctx;
}

export function ConsolePage({
  children,
  phone,
  maxWidth = true,
}: {
  children: ReactNode;
  phone?: string;
  maxWidth?: boolean;
}) {
  return (
    <AppShell phone={phone}>
      <div className={`px-5 py-5 md:px-6 ${maxWidth ? "mx-auto max-w-console" : "h-full"}`}>
        {children}
      </div>
    </AppShell>
  );
}
