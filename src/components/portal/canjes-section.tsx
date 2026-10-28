import type { RedemptionItem } from "@/domain/panel";
import { points } from "@/components/panel/format";
import { EmptyState } from "@/components/panel/panel-ui";
import { portalRedemptions } from "@/components/portal/fixtures";

export function CanjesSection({ canjes = portalRedemptions }: { canjes?: RedemptionItem[] }) {
  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Mis canjes</h1>
        <p className="mt-1 text-sm text-zinc-600">Productos por entregar y cupones de tus canjes.</p>
      </header>
      {canjes.length === 0 ? (
        <EmptyState>Aún no has canjeado recompensas.</EmptyState>
      ) : (
      <ul className="grid gap-3">
        {canjes.map((canje) => (
          <li key={canje.id} className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{canje.recompensa}</p>
                <p className="mt-1 text-sm text-zinc-600">
                  {points(canje.puntos)} pts · {canje.rewardTipo} · {canje.estado}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{canje.fecha}</p>
              </div>
              {canje.couponCode ? (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                  <p className="text-xs text-zinc-500">Cupón</p>
                  <p className="font-medium tracking-wide">{canje.couponCode}</p>
                  {canje.vence ? <p className="mt-1 text-xs text-zinc-500">Vence {canje.vence}</p> : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      )}
    </section>
  );
}
