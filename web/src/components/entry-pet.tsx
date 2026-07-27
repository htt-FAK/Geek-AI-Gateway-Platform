"use client";

import { useState } from "react";

export function EntryPet() {
  const [react, setReact] = useState(false);

  function onTap() {
    setReact(true);
    window.setTimeout(() => setReact(false), 900);
  }

  return (
    <button
      type="button"
      className={`entry-pet ${react ? "entry-pet--react" : ""}`}
      onClick={onTap}
      aria-label="桌宠"
      title="戳戳我"
    >
      <span className="entry-pet-glow" aria-hidden />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/entry-pet.png" alt="" width={148} height={148} draggable={false} />
      <span className="entry-pet-bubble" aria-hidden>
        {react ? "来啦～" : "嗨"}
      </span>
    </button>
  );
}
