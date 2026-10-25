import { Suspense } from "react";
import { PanelApp } from "@/components/panel/panel-app";

export default function PanelPage() {
  return (
    <Suspense fallback={<main className="flex-1 bg-zinc-100 px-6 py-16 text-sm text-zinc-600">Cargando panel…</main>}>
      <PanelApp />
    </Suspense>
  );
}
