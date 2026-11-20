import { ReactNode } from "react";

/**
 * 控制台统一页头：12px 分区名 + 20px 页面名 + 一行次要说明，右侧为操作槽。
 * 每个页面只留一个实心主按钮，其余操作用 ghost / 文字按钮。
 */
export function PageHeader({
  group,
  title,
  description,
  actions,
}: {
  group: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[12px] leading-none text-[var(--text-tertiary)]">{group}</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
