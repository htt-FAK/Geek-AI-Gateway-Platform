"use client";

import { ReactNode, useEffect, useState } from "react";
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

export function useMe() {
  const router = useRouter();
  const [me, setMe] = useState<MePayload | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    const res = await fetch("/api/me");
    if (!res.ok) {
      router.replace("/login");
      return null;
    }
    const data = (await res.json()) as MePayload;
    setMe(data);
    return data;
  }

  useEffect(() => {
    void refresh().catch(() => setError("加载失败"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return { me, error, refresh, setMe };
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
