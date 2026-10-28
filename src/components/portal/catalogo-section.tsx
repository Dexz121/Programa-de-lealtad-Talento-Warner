import type { RewardItem } from "@/domain/panel";
import { money, points } from "@/components/panel/format";
import { EmptyState, primaryClass } from "@/components/panel/panel-ui";
import { portalRewards } from "@/components/portal/fixtures";

function rewardDetails(reward: RewardItem) {
  const stock = reward.stock == null ? "stock ilimitado" : reward.stock === 0 ? "sin stock" : `stock ${points(reward.stock)}`;
  const base = `${points(reward.puntosRequeridos)} pts · nivel ${reward.nivelMinimo} · ${stock}`;

  if (reward.tipo !== "descuento") {
    return base;
  }

  const discount =
    reward.descuentoTipo === "porcentaje"
      ? `${reward.descuentoValor ?? 0}%`
      : money(reward.descuentoValor);
  const minimum = reward.compraMinima == null ? "" : ` · compra mínima ${money(reward.compraMinima)}`;
  const days = reward.vigenciaDias == null ? "" : ` · vigencia ${reward.vigenciaDias} días`;

  return `${base} · ${discount}${minimum}${days}`;
}

export function CatalogoSection({ rewards = portalRewards }: { rewards?: RewardItem[] }) {
  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Catálogo</h1>
        <p className="mt-1 text-sm text-zinc-600">Recompensas que puedes pedir con tus puntos.</p>
      </header>
      {rewards.length === 0 ? (
        <EmptyState>Todavía no hay recompensas en el catálogo.</EmptyState>
      ) : (
      <ul className="grid gap-4 md:grid-cols-2">
        {rewards.map((reward) => (
          <li key={reward.id} className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
            {reward.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={reward.fotoUrl} alt="" className="h-36 w-full object-cover" />
            ) : (
              <div className="flex h-36 items-center justify-center bg-zinc-100 text-sm text-zinc-500">Sin foto</div>
            )}
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div>
                <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">{reward.tipo}</p>
                <h2 className="mt-1 font-medium">{reward.nombre}</h2>
                {reward.descripcion ? <p className="mt-1 text-sm text-zinc-600">{reward.descripcion}</p> : null}
              </div>
              <p className="text-sm text-zinc-600">{rewardDetails(reward)}</p>
              <div className="mt-auto">
                {/* El canje se registra en una transacción cuando el portal llame a Firebase. */}
                <button className={primaryClass} type="button" disabled>
                  Canjear
                </button>
                <p className="mt-2 text-xs text-zinc-500">El canje se conecta en el siguiente paso.</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      )}
    </section>
  );
}
