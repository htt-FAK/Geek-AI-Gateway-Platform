"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { loadProfile, saveProfile, UserProfile } from "@/lib/appearance";

function initials(name: string) {
  const t = name.trim();
  if (!t) return "?";
  if (/^\d+$/.test(t)) return t.slice(-2);
  return t.slice(0, 1).toUpperCase();
}

export function UserMenu({ phone }: { phone: string }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({ displayName: phone, avatarDataUrl: null });
  const [draftName, setDraftName] = useState(phone);
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loaded = loadProfile(phone);
    setProfile(loaded);
    setDraftName(loaded.displayName);
    setDraftAvatar(loaded.avatarDataUrl);
  }, [phone]);

  function persist(next: UserProfile) {
    saveProfile(phone, next);
    setProfile(next);
  }

  function onPickAvatar(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : null;
      setDraftAvatar(url);
    };
    reader.readAsDataURL(file);
  }

  function saveEdit() {
    const next = {
      displayName: draftName.trim() || phone,
      avatarDataUrl: draftAvatar,
    };
    persist(next);
    setEditOpen(false);
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-[var(--bg-surface)]"
          onClick={() => setOpen((v) => !v)}
          aria-label="用户菜单"
        >
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[var(--bg-hover)] text-[12px] font-medium text-[var(--text-primary)]">
            {profile.avatarDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarDataUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(profile.displayName)
            )}
          </span>
        </button>

        {open ? (
          <>
            <button type="button" className="fixed inset-0 z-[39]" aria-label="关闭菜单" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-10 z-[40] w-64 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-xl">
              <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
                <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[var(--bg-hover)] text-[14px] font-medium">
                  {profile.avatarDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatarDataUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(profile.displayName)
                  )}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium text-[var(--text-primary)]">{profile.displayName}</div>
                  <div className="truncate text-[12px] text-[var(--text-tertiary)]">ID · {phone}</div>
                </div>
              </div>
              <div className="p-1.5">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2.5 text-left text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                  onClick={() => {
                    setDraftName(profile.displayName);
                    setDraftAvatar(profile.avatarDataUrl);
                    setOpen(false);
                    setEditOpen(true);
                  }}
                >
                  自定义头像与名称
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2.5 text-left text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                  onClick={async () => {
                    setOpen(false);
                    await fetch("/api/auth/logout", { method: "POST" });
                    window.location.href = "/login";
                  }}
                >
                  退出
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[50] bg-[var(--overlay-scrim)]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[50] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 outline-none">
            <Dialog.Title className="text-[15px] font-medium">头像与名称</Dialog.Title>
            <Dialog.Description className="mt-1 text-[13px] text-[var(--text-secondary)]">
              仅保存在本机浏览器，换设备需重新设置。
            </Dialog.Description>

            <div className="mt-4 flex items-center gap-4">
              <button
                type="button"
                className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[var(--bg-hover)] text-[18px] font-medium"
                onClick={() => fileRef.current?.click()}
              >
                {draftAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draftAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials(draftName || phone)
                )}
              </button>
              <div className="space-y-2">
                <button type="button" className="btn btn-secondary py-1.5 text-[13px]" onClick={() => fileRef.current?.click()}>
                  选择图片
                </button>
                {draftAvatar ? (
                  <button
                    type="button"
                    className="block text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    onClick={() => setDraftAvatar(null)}
                  >
                    清除头像
                  </button>
                ) : null}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  onPickAvatar(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </div>

            <label className="mt-4 block space-y-1.5">
              <span className="text-[13px] text-[var(--text-secondary)]">显示名称</span>
              <input className="field" value={draftName} onChange={(e) => setDraftName(e.target.value)} maxLength={32} />
            </label>
            <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">账号 ID：{phone}</p>

            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className="btn btn-ghost">
                  取消
                </button>
              </Dialog.Close>
              <button type="button" className="btn" onClick={saveEdit}>
                保存
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
