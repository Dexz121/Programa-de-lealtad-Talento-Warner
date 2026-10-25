"use client";

import { useEffect, useState } from "react";
import type { RedemptionItem } from "@/domain/panel";
import { points } from "@/components/panel/format";
import { usePanelContext } from "@/components/panel/panel-context";
import { EmptyState, Notice, fieldClass, secondaryClass } from "@/components/panel/panel-ui";
import { isUnauthorized, panelErrorMessage, panelFetch } from "@/components/panel/use-panel-api";

const FILTERS = ["todos", "pendiente", "entregado", "vigente", "usado", "cancelado", "vencido"] as const;

export function CanjesSection() {
  const { onUnauthorized } = usePanelContext();
  const [rows, setRows] = useState<RedemptionItem[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("todos");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function fail(caught: unknown) {
    if (isUnauthorized(caught)) {
      onUnauthorized();
    } else {
      setError(panelErrorMessage(caught));
    }
  }

  async function load() {
    const data = await panelFetch<{ canjes: RedemptionItem[] }>("/api/panel/canjes");
    setRows(data.canjes);
  }

  useEffect(() => {
    let active = true;
    panelFetch<{ canjes: RedemptionItem[] }>("/api/panel/canjes")
      .then((data) => {
        if (active) {
          setRows(data.canjes);
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

  async function act(id: string, accion: "entregar" | "aplicar" | "cancelar") {
    setError(null);
    setMessage(null);
    setPendingId(id);
    try {
      await panelFetch(`/api/panel/canjes/${id}`, { method: "POST", body: JSON.stringify({ accion }) });
      setMessage(accion === "cancelar" ? "Canje cancelado y puntos devueltos." : "Canje actualizado.");
      await load();
    } catch (caught) {
      fail(caught);
    } finally {
      setPendingId(null);
    }
  }

  const visible = rows?.filter((row) => filter === "todos" || row.estado === filter) ?? [];

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Canjes</h2>
          <p className="mt-1 text-sm text-zinc-600">Entrega productos, aplica cupones o cancela y devuelve los puntos.</p>
        </div>
        <label className="text-sm font-medium">
          Estado
          <select className={`${fieldClass} mt-1`} value={filter} onChange={(event) => setFilter(event.target.value as (typeof FILTERS)[number])}>
            {FILTERS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </header>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}
      {!rows && !error ? <p className="text-sm text-zinc-600">Cargando canjes…</p> : null}
      {rows && visible.length === 0 ? <EmptyState>No hay canjes en este estado.</EmptyState> : null}
      <ul className="grid gap-3">
        {visible.map((row) => (
          <li key={row.id} className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{row.recompensa}</p>
                <p className="mt-1 text-sm text-zinc-600">
                  {row.cliente} · {points(row.puntos)} pts · {row.estado}
                  {row.couponCode ? ` · ${row.couponCode}` : ""}
                  {row.vence ? ` · vence ${row.vence}` : ""}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{row.fecha || "Sin fecha"} · {row.id}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {row.rewardTipo === "producto" && row.estado === "pendiente" ? (
                  <button className={secondaryClass} type="button" disabled={pendingId === row.id} onClick={() => act(row.id, "entregar")}>
                    Marcar entregado
                  </button>
                ) : null}
                {row.rewardTipo === "descuento" && row.estado === "vigente" ? (
                  <button className={secondaryClass} type="button" disabled={pendingId === row.id} onClick={() => act(row.id, "aplicar")}>
                    Aplicar cupón
                  </button>
                ) : null}
                {row.estado !== "cancelado" && row.estado !== "usado" && row.estado !== "vencido" ? (
                  <button className={secondaryClass} type="button" disabled={pendingId === row.id} onClick={() => act(row.id, "cancelar")}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
