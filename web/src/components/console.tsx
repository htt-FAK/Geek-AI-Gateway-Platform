"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type MePayload = {
  phone: string;
  role?: string;
  models: string[];
  keyMode: string;
  keyMasked: string | null;
  keyRevealedAt: string | null;
  gatewayUrl: string;
  canRevealKey: boolean;
  canRegenerateKey: boolean;
  balance: {
    unlimited: boolean;
    grantedCny: number;
    spendCny: number;
    balanceCny: number | null;
  };
};

export function useMe() {
  const router = useRouter();
  const [me, setMe] = useState<MePayload | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    const res = await fetch("/api/me");
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        await fetch("/api/auth/logout", { method: "POST" });
      }
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
  maxWidth = true,
}: {
  children: ReactNode;
  phone?: string;
  maxWidth?: boolean;
}) {
  return (
    <div className={`px-5 py-5 md:px-6 ${maxWidth ? "mx-auto max-w-console" : "h-full"}`}>
      {children}
    </div>
  );
}
