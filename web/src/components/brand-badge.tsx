"use client";

import { modelBrand } from "@/lib/model-market";

/** 模型自家品牌标识：截图里的厂商标 + 厂商名。 */
export function BrandBadge({ id, size = "sm" }: { id: string; size?: "sm" | "md" }) {
  const brand = modelBrand(id);
  const tile = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const label = size === "sm" ? "text-[12px]" : "text-[13px]";
  return (
    <span className={`inline-flex items-center gap-2 ${label} font-medium tracking-[-0.01em] text-[var(--text-secondary)]`}>
      {brand.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.logo}
          alt=""
          className={`${tile} shrink-0 object-contain transition-transform duration-200 group-hover:scale-110`}
        />
      ) : (
        <span
          className={`${tile} inline-flex shrink-0 items-center justify-center rounded-[7px] text-[11px] font-semibold`}
          style={{
            color: brand.color,
            background: `color-mix(in srgb, ${brand.color} 16%, var(--bg-surface))`,
          }}
        >
          {brand.label.slice(0, 1)}
        </span>
      )}
      {brand.label}
    </span>
  );
}
