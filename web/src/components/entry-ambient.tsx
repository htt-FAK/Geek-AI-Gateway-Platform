"use client";

import { useEffect, useRef } from "react";

const LINE_A = Array.from({ length: 6 }, () => "Geek").join("            ");
const LINE_B = Array.from({ length: 4 }, () => "Geek").join("                 ");

export function EntryAmbient() {
  const rootRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!root || !dot || !ring) return;

    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;

    const shell = root.closest(".entry-shell");
    shell?.classList.add("entry-shell--custom-cursor");

    const rows = Array.from(root.querySelectorAll<HTMLElement>(".entry-marquee-row"));

    let mx = window.innerWidth * 0.55;
    let my = window.innerHeight * 0.42;
    let rx = mx;
    let ry = my;
    let active = false;
    let hitAmt = 0;
    let raf = 0;

    function placeDot(x: number, y: number) {
      dot!.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
    }

    function onMove(e: PointerEvent) {
      mx = e.clientX;
      my = e.clientY;
      active = true;
      placeDot(mx, my);
    }

    function onLeave() {
      active = false;
    }

    function textHit(x: number, y: number) {
      const padX = 36;
      const padY = 22;
      for (const row of rows) {
        const r = row.getBoundingClientRect();
        if (x >= r.left - padX && x <= r.right + padX && y >= r.top - padY && y <= r.bottom + padY) {
          return true;
        }
      }
      return false;
    }

    function tick() {
      rx += (mx - rx) * 0.42;
      ry += (my - ry) * 0.42;

      const hitting = active && textHit(rx, ry);
      hitAmt += ((hitting ? 1 : 0) - hitAmt) * 0.32;

      const box = root!.getBoundingClientRect();
      root!.style.setProperty("--mx", `${rx - box.left}px`);
      root!.style.setProperty("--my", `${ry - box.top}px`);
      root!.style.setProperty("--hit", hitAmt.toFixed(3));
      root!.classList.toggle("is-text-hit", hitAmt > 0.12);

      ring!.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0) translate(-50%, -50%) scale(${(
        1 +
        hitAmt * 0.75
      ).toFixed(3)})`;
      ring!.style.opacity = active ? String(0.55 + hitAmt * 0.45) : "0";
      ring!.classList.toggle("is-hitting", hitAmt > 0.12);
      dot!.style.opacity = active ? "1" : "0";

      raf = window.requestAnimationFrame(tick);
    }

    placeDot(mx, my);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    raf = window.requestAnimationFrame(tick);

    return () => {
      shell?.classList.remove("entry-shell--custom-cursor");
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={rootRef} className="entry-marquee" aria-hidden>
        <div className="entry-marquee-glow" />
        <div className="entry-marquee-crescent" />

        <div className="entry-marquee-row entry-marquee-row--top">
          <div className="entry-marquee-track entry-marquee-track--lg">
            <span className="entry-marquee-text">{LINE_A}</span>
            <span className="entry-marquee-text">{LINE_A}</span>
          </div>
        </div>
        <div className="entry-marquee-row entry-marquee-row--bot">
          <div className="entry-marquee-track entry-marquee-track--sm entry-marquee-track--rev">
            <span className="entry-marquee-text">{LINE_B}</span>
            <span className="entry-marquee-text">{LINE_B}</span>
          </div>
        </div>

        <div className="entry-marquee-scan" />
        <div className="entry-marquee-spotlight" />
        <div className="entry-marquee-hitlight" />
      </div>

      <span ref={dotRef} className="entry-cursor entry-cursor--dot" aria-hidden />
      <span ref={ringRef} className="entry-cursor entry-cursor--ring" aria-hidden />
    </>
  );
}
