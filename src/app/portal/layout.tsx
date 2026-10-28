import { Suspense, type ReactNode } from "react";
import { PortalShell } from "@/components/portal/portal-shell";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center bg-zinc-100 px-6 py-16 text-sm text-zinc-600">Cargando portal…</main>
      }
    >
      <PortalShell>{children}</PortalShell>
    </Suspense>
  );
}
