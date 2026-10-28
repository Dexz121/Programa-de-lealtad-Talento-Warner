"use client";

import { useEffect, useState } from "react";
import type { MovementItem } from "@/domain/panel";
import { movementLabel, signedPoints } from "@/components/panel/format";
import { EmptyState, Notice } from "@/components/panel/panel-ui";
import { portalErrorMessage, portalFetch } from "@/components/portal/use-portal-api";

export function MovementList({ items }: { items: MovementItem[] }) {
  if (items.length === 0) {
    return <EmptyState>Todavía no hay movimientos de puntos.</EmptyState>;
  }

  return (
    <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white">
      {items.map((item, index) => (
        <li
          key={`${item.fecha}-${item.referencia}-${index}`}
          className="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">{movementLabel(item.tipo)}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {item.fecha} · {item.referencia}
            </p>
          </div>
          <p className={`text-sm font-medium ${item.puntos < 0 ? "text-red-700" : "text-emerald-700"}`}>
            {signedPoints(item.puntos)}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function MovimientosSection() {
  const [items, setItems] = useState<MovementItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    portalFetch<{ movimientos: MovementItem[] }>("/api/portal/movimientos?limit=30")
      .then((data) => {
        if (active) {
          setItems(data.movimientos);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(portalErrorMessage(caught));
          setItems([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>
        <p className="mt-1 text-sm text-zinc-600">Puntos que sumaste o usaste.</p>
      </header>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {items == null ? <p className="text-sm text-zinc-600">Cargando movimientos…</p> : <MovementList items={items} />}
    </section>
  );
}
