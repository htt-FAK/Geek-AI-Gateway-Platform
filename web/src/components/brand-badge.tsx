"use client";

import { modelBrand } from "@/lib/model-market";

/** 模型自家品牌标识：logo（或品牌色首字母块）+ 厂商名。 */
export function BrandBadge({ id, size = "sm" }: { id: string; size?: "sm" | "md" }) {
  const brand = modelBrand(id);
  const iconCls = size === "sm" ? "h-4 w-4 text-[10px]" : "h-5 w-5 text-[12px]";
  return (
    <span className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
      {brand.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logo} alt={brand.label} className={`${iconCls} object-contain`} />
      ) : (
        <span
          className={`${iconCls} flex items-center justify-center rounded-[4px] font-semibold`}
          style={{
            color: brand.color,
            background: `color-mix(in srgb, ${brand.color} 14%, transparent)`,
          }}
        >
          {brand.label.slice(0, 1)}
        </span>
      )}
      {brand.label}
    </span>
  );
}