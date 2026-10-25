"use client";

import { useEffect, useState } from "react";
import { usePanelContext } from "@/components/panel/panel-context";
import { EmptyState, Notice, secondaryClass } from "@/components/panel/panel-ui";
import { points } from "@/components/panel/format";
import { downloadCsv, isUnauthorized, panelErrorMessage, panelFetch } from "@/components/panel/use-panel-api";

type RiskRow = { id: string; nombre: string; email: string; diasSinActividad: number | null };
type BirthdayRow = { id: string; nombre: string; email: string; fechaCumpleanos: string };

export function ListSection({
  kind,
  canExport,
}: {
  kind: "riesgo" | "cumpleanos";
  canExport: boolean;
}) {
  const { onUnauthorized } = usePanelContext();
  const [rows, setRows] = useState<Array<RiskRow | BirthdayRow> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    panelFetch<{ clientes: Array<RiskRow | BirthdayRow> }>(`/api/panel/${kind}`)
      .then((data) => {
        if (active) {
          setRows(data.clientes);
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
  }, [kind, onUnauthorized]);

  async function exportList() {
    try {
      await downloadCsv(kind);
    } catch (caught) {
      if (isUnauthorized(caught)) {
        onUnauthorized();
      } else {
        setError(panelErrorMessage(caught));
      }
    }
  }

  const title = kind === "riesgo" ? "Clientes en riesgo" : "Cumpleaños próximos";
  const description =
    kind === "riesgo"
      ? "Quien ya compró y lleva 90 días o más sin actividad al 30 de abril de 2026."
      : "Cumpleaños entre el 30 de abril y el 7 de mayo de 2026, inclusive.";

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-zinc-600">{description}</p>
        </div>
        {canExport ? (
          <button className={secondaryClass} type="button" onClick={exportList}>
            Exportar CSV
          </button>
        ) : null}
      </header>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!rows && !error ? <p className="text-sm text-zinc-600">Cargando lista…</p> : null}
      {rows && rows.length === 0 ? (
        <EmptyState>
          {kind === "riesgo"
            ? "No hay clientes en riesgo. Si la sincronización aún no corre, la lista sigue vacía."
            : "No hay cumpleaños en esa ventana."}
        </EmptyState>
      ) : null}
      {rows && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Correo</th>
                <th className="px-4 py-3 font-medium">{kind === "riesgo" ? "Días sin actividad" : "Cumpleaños"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-medium">{row.nombre}</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">{row.id}</span>
                  </td>
                  <td className="px-4 py-3">{row.email || "—"}</td>
                  <td className="px-4 py-3">
                    {"diasSinActividad" in row ? points(row.diasSinActividad) : row.fechaCumpleanos}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
