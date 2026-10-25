export const fieldClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900";

export const primaryClass =
  "rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60";

export const secondaryClass =
  "rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-60";

export const dangerClass =
  "rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-60";

export function Notice({ tone, children }: { tone: "error" | "ok"; children: string }) {
  const className =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <p className={`rounded-md border px-3 py-2 text-sm ${className}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}

export function EmptyState({ children }: { children: string }) {
  return (
    <p className="rounded-md border border-dashed border-zinc-300 bg-white px-4 py-8 text-sm text-zinc-600">
      {children}
    </p>
  );
}
