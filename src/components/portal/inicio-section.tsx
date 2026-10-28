import Link from "next/link";
import { points } from "@/components/panel/format";
import { portalCustomer, portalMovements } from "@/components/portal/fixtures";
import { MovementList } from "@/components/portal/movimientos-section";
import { LevelBadge } from "@/components/portal/portal-ui";

const STATS = [
  { label: "Nivel", value: portalCustomer.nivel },
  { label: "Puntos", value: points(portalCustomer.puntos) },
  { label: "Disponibles", value: points(portalCustomer.puntosDisponibles) },
];

export function InicioSection() {
  return (
    <section className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-zinc-500">Hola</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{portalCustomer.nombre}</h1>
          <LevelBadge level={portalCustomer.nivel} />
        </div>
        <p className="mt-2 text-sm text-zinc-600">Este es el resumen de tu programa de lealtad.</p>
      </header>
      <dl className="grid gap-3 sm:grid-cols-3">
        {STATS.map((stat) => (
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
        <MovementList items={portalMovements.slice(0, 3)} />
      </div>
    </section>
  );
}
