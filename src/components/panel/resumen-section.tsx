"use client";

import { useEffect, useState } from "react";
import type { Level } from "@/domain/panel";
import { money, points } from "@/components/panel/format";
import { usePanelContext } from "@/components/panel/panel-context";
import { EmptyState, Notice, secondaryClass } from "@/components/panel/panel-ui";
import { downloadCsv, isUnauthorized, panelErrorMessage, panelFetch } from "@/components/panel/use-panel-api";

type Summary = {
  totalClientes: number;
  niveles: Record<Level | "Sin calcular", number>;
  top: Array<{ id: string; nombre: string; nivel: Level | null; puntos: number | null; gasto12m?: number | null }>;
  enRiesgo: number | null;
  cumpleanos: number | null;
};

const LEVEL_ORDER: Array<Level | "Sin calcular"> = ["Bronce", "Plata", "Oro", "Sin calcular"];

export function ResumenSection({ canExport }: { canExport: boolean }) {
  const { onUnauthorized } = usePanelContext();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    panelFetch<Summary>("/api/panel/resumen")
      .then((data) => {
        if (active) {
          setSummary(data);
        }
      })
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
  }, [onUnauthorized]);

  async function exportClients() {
    setExportError(null);
    try {
      await downloadCsv("clientes");
    } catch (caught) {
      if (isUnauthorized(caught)) {
        onUnauthorized();
      } else {
        setExportError(panelErrorMessage(caught));
      }
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Resumen</h2>
          <p className="mt-1 text-sm text-zinc-600">Clientes por nivel y los diez con más puntos.</p>
        </div>
        {canExport ? (
          <button className={secondaryClass} type="button" onClick={exportClients}>
            Exportar clientes
          </button>
        ) : null}
      </header>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {exportError ? <Notice tone="error">{exportError}</Notice> : null}
      {!summary && !error ? <p className="text-sm text-zinc-600">Cargando resumen…</p> : null}
      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <article className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-sm text-zinc-500">Clientes</p>
              <p className="mt-1 text-2xl font-semibold">{points(summary.totalClientes)}</p>
            </article>
            {LEVEL_ORDER.map((level) => (
              <article key={level} className="rounded-lg border border-zinc-200 bg-white p-4">
                <p className="text-sm text-zinc-500">{level}</p>
                <p className="mt-1 text-2xl font-semibold">{points(summary.niveles[level] ?? 0)}</p>
              </article>
            ))}
            {summary.enRiesgo != null ? (
              <article className="rounded-lg border border-zinc-200 bg-white p-4">
                <p className="text-sm text-zinc-500">En riesgo</p>
                <p className="mt-1 text-2xl font-semibold">{points(summary.enRiesgo)}</p>
              </article>
            ) : null}
            {summary.cumpleanos != null ? (
              <article className="rounded-lg border border-zinc-200 bg-white p-4">
                <p className="text-sm text-zinc-500">Cumpleaños en la ventana</p>
                <p className="mt-1 text-2xl font-semibold">{points(summary.cumpleanos)}</p>
              </article>
            ) : null}
          </div>
          {summary.top.length === 0 ? (
            <EmptyState>Todavía no hay puntos calculados. El top aparece cuando la sincronización guarda el saldo de cada cliente.</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="border-b border-zinc-200 text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Nivel</th>
                    <th className="px-4 py-3 font-medium">Puntos</th>
                    {"gasto12m" in (summary.top[0] ?? {}) ? (
                      <th className="px-4 py-3 font-medium">Gasto 12 meses</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {summary.top.map((row) => (
                    <tr key={row.id} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3">
                        <span className="font-medium">{row.nombre}</span>
                        <span className="mt-0.5 block text-xs text-zinc-500">{row.id}</span>
                      </td>
                      <td className="px-4 py-3">{row.nivel ?? "Sin calcular"}</td>
                      <td className="px-4 py-3">{points(row.puntos)}</td>
                      {"gasto12m" in row ? <td className="px-4 py-3">{money(row.gasto12m)}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
