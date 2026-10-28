"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MovementItem } from "@/domain/panel";
import { points } from "@/components/panel/format";
import { Notice } from "@/components/panel/panel-ui";
import { MovementList } from "@/components/portal/movimientos-section";
import { usePortal } from "@/components/portal/portal-context";
import { LevelBadge } from "@/components/portal/portal-ui";
import { portalErrorMessage, portalFetch } from "@/components/portal/use-portal-api";

export function InicioSection() {
  const { session } = usePortal();
  const [movements, setMovements] = useState<MovementItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    portalFetch<{ movimientos: MovementItem[] }>("/api/portal/movimientos?limit=3")
      .then((data) => {
        if (active) {
          setMovements(data.movimientos);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(portalErrorMessage(caught));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const stats = [
    { label: "Nivel", value: session.nivel ?? "Sin nivel" },
    { label: "Puntos", value: points(session.puntos) },
    { label: "Disponibles", value: points(session.puntosDisponibles) },
  ];

  return (
    <section className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-zinc-500">Hola</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{session.nombre}</h1>
          {session.nivel ? <LevelBadge level={session.nivel} /> : null}
        </div>
        <p className="mt-2 text-sm text-zinc-600">Este es el resumen de tu programa de lealtad.</p>
      </header>
      <dl className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-zinc-200 bg-white px-4 py-4">
            <dt className="text-sm text-zinc-500">{stat.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight">{stat.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Últimos movimientos</h2>
          <Link className="text-sm underline" href="/portal/movimientos">
            Ver todos
          </Link>
        </div>
        {error ? <Notice tone="error">{error}</Notice> : <MovementList items={movements} />}
      </div>
    </section>
  );
}
