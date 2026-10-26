"use client";

import { useCallback, useEffect, useState } from "react";
import type { SyncRunItem } from "@/domain/panel";
import { usePanelContext } from "@/components/panel/panel-context";
import { EmptyState, Notice, primaryClass } from "@/components/panel/panel-ui";
import { isUnauthorized, panelErrorMessage, panelFetch } from "@/components/panel/use-panel-api";

export function SyncSection() {
  const { onUnauthorized } = usePanelContext();
  const [runs, setRuns] = useState<SyncRunItem[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [tone, setTone] = useState<"ok" | "error">("ok");

  function fail(caught: unknown) {
    if (isUnauthorized(caught)) {
      onUnauthorized();
    } else {
      setError(panelErrorMessage(caught));
    }
  }

  const loadRuns = useCallback(async () => {
    const data = await panelFetch<{ corridas: SyncRunItem[] }>("/api/panel/sincronizar");
    setRuns(data.corridas);
  }, []);

  useEffect(() => {
    let active = true;
    loadRuns()
      .catch((caught) => {
        if (!active) {
          return;
        }

        if (isUnauthorized(caught)) {
          onUnauthorized();
        } else {
          setError(panelErrorMessage(caught));
        }
      });

    return () => {
      active = false;
    };
  }, [loadRuns, onUnauthorized]);

  async function run() {
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const result = await panelFetch<{ ok: boolean; mensaje: string }>("/api/panel/sincronizar", { method: "POST" });
      setTone(result.ok ? "ok" : "error");
      setMessage(result.mensaje);
      await loadRuns();
    } catch (caught) {
      fail(caught);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Sincronización</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Descarga clientes, pedidos y pagos, y recalcula los puntos al 30 de abril de 2026. La primera corrida puede tardar cerca de un minuto.
        </p>
      </header>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone={tone}>{message}</Notice> : null}
      <button className={`${primaryClass} w-fit`} type="button" onClick={run} disabled={pending}>
        {pending ? "Sincronizando…" : "Sincronizar ahora"}
      </button>
      {!runs && !error ? <p className="text-sm text-zinc-600">Cargando corridas…</p> : null}
      {runs && runs.length === 0 ? <EmptyState>Todavía no hay corridas registradas.</EmptyState> : null}
      {runs && runs.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Inicio</th>
                <th className="px-4 py-3 font-medium">Fin</th>
                <th className="px-4 py-3 font-medium">Requests</th>
                <th className="px-4 py-3 font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((runItem) => (
                <tr key={runItem.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">{runItem.inicio || "—"}</td>
                  <td className="px-4 py-3">{runItem.fin || "—"}</td>
                  <td className="px-4 py-3">{runItem.requests}</td>
                  <td className="px-4 py-3">{runItem.resultado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
