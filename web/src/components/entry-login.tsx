"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/shell";
import { EntryPet } from "@/components/entry-pet";

const REMEMBER_KEY = "aigw.login.remember";

type Remembered = {
  phone: string;
  password: string;
};

function readRemembered(): Remembered | null {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Remembered;
    if (!data?.phone || !data?.password) return null;
    return data;
  } catch {
    return null;
  }
}

export function EntryLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const docs = process.env.NEXT_PUBLIC_DOCS_BASE_URL;

  useEffect(() => {
    const saved = readRemembered();
    if (!saved) return;
    setPhone(saved.phone);
    setPassword(saved.password);
    setRemember(true);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setHint("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password, remember }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "登录失败");
        return;
      }
      try {
        if (remember) {
          localStorage.setItem(REMEMBER_KEY, JSON.stringify({ phone, password }));
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        /* ignore storage errors */
      }
      router.replace(data.requirePasswordChange ? "/change-password" : "/playground");
    } catch {
      setError("连不上服务。确认已启动且地址正确。");
    } finally {
      setLoading(false);
    }
  }

  function onForgot() {
    setError("");
    setHint("忘记密码请联系管理员重置，或由管理员在控制台重置后重新进入。");
  }

  return (
    <AuthShell>
      <div className="entry-stage relative mx-auto flex min-h-[calc(100vh-4.75rem)] max-w-[1280px] flex-col lg:flex-row lg:items-center">
        <section className="entry-manifest flex flex-1 flex-col justify-center px-8 pb-8 pt-16 md:px-16 lg:max-w-[58%] lg:px-20 lg:pb-28 lg:pt-8">
          <h1 className="entry-headline moonshot-line font-display text-[clamp(2.5rem,5.8vw,4.5rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-[#FAFAFC]">
            有趣的人，
            <br />
            <span className="whitespace-nowrap">在这里调用世界</span>
          </h1>
          <p className="entry-sub mt-10 max-w-[24rem] text-[15px] font-medium leading-[1.7] tracking-tight text-[#C4C4D0]">
            高科极客 AI 网关平台
          </p>
        </section>

        <section className="entry-panel flex flex-1 items-center justify-start px-8 pb-24 pt-4 md:px-16 lg:justify-end lg:px-20 lg:pb-28 lg:pt-8">
          <form onSubmit={onSubmit} className="entry-form-sharp w-full max-w-[320px] space-y-7">
            <p className="entry-form-title">进入</p>
            <label className="block space-y-2">
              <span className="entry-label">手机号</span>
              <input
                className="entry-field"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11 位手机号"
                autoComplete="username"
                required
              />
            </label>
            <label className="block space-y-2">
              <span className="entry-label">密码</span>
              <input
                className="entry-field"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <div className="flex items-center justify-between gap-3 pt-0.5">
              <label className="entry-check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>记住密码</span>
              </label>
              <button type="button" className="entry-link" onClick={onForgot}>
                忘记密码
              </button>
            </div>

            {error ? <p className="text-sm text-[var(--status-error)]">{error}</p> : null}
            {hint ? <p className="text-[12px] leading-relaxed text-[#9A9AAC]">{hint}</p> : null}

            <button className="btn entry-enter w-full" type="submit" disabled={loading}>
              {loading ? "进入中…" : "进入"}
            </button>
            {docs ? (
              <a
                href={docs}
                target="_blank"
                rel="noreferrer"
                className="block text-center text-[12px] font-medium text-[#7A7A8A] transition-colors hover:text-[#C0C0CE]"
              >
                文档
              </a>
            ) : null}
          </form>
        </section>

        <footer className="entry-foot px-8 pb-10 md:px-16 lg:absolute lg:bottom-12 lg:left-20 lg:px-0 lg:pb-0">
          <p className="text-[12px] font-medium leading-relaxed text-[#7A7A8A]">Geek · 高科极客工作室</p>
          <p className="mt-1 text-[12px] tracking-[0.01em] text-[#7A7A8A]">
            Interesting people. Calling the world from here.
          </p>
        </footer>
      </div>
      <EntryPet />
    </AuthShell>
  );
}
