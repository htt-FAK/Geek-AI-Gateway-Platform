export function ChartBlockSkeleton() {
  return (
    <section className="panel flex min-h-[280px] flex-col p-5" aria-hidden>
      <span className="skeleton h-4 w-24" />
      <span className="skeleton mt-2 h-3 w-32" />
      <span className="skeleton mt-4 h-[200px] w-full" />
    </section>
  );
}

export function MetricValueSkeleton() {
  return <span className="skeleton mt-1.5 block h-5 w-16" aria-hidden />;
}

export function TableSkeletonRows({ rows = 4, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} aria-hidden>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} className="px-4 py-3.5">
              <span className="skeleton block h-4" style={{ width: c === 0 ? "72%" : "48%" }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
