"use client";

/** 可读文本就是最终值；动画层对读屏隐藏。 */
export function RollingValue({ value }: { value: string }) {
  return (
    <span className="inline-grid overflow-hidden">
      <span className="sr-only">{value}</span>
      <span key={value} aria-hidden className="kpi-roll col-start-1 row-start-1">
        {value}
      </span>
    </span>
  );
}
