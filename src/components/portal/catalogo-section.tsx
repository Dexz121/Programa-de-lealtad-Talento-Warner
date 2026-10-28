"use client";

import { useEffect, useState } from "react";
import type { RewardItem } from "@/domain/panel";
import { redeemPreview } from "@/domain/redemption";
import { money, points } from "@/components/panel/format";
import { EmptyState, Notice, primaryClass } from "@/components/panel/panel-ui";
import { usePortal } from "@/components/portal/portal-context";
import { portalErrorMessage, portalFetch } from "@/components/portal/use-portal-api";

type RedeemResult = {
  id: string;
  estado: string;
  couponCode: string | null;
  vence: string | null;
};

function rewardDetails(reward: RewardItem) {
  const stock = reward.stock == null ? "stock ilimitado" : reward.stock === 0 ? "sin stock" : `stock ${points(reward.stock)}`;
  const base = `${points(reward.puntosRequeridos)} pts · nivel ${reward.nivelMinimo} · ${stock}`;

  if (reward.tipo !== "descuento") {
    return base;
  }

  const discount =
    reward.descuentoTipo === "porcentaje" ? `${reward.descuentoValor ?? 0}%` : money(reward.descuentoValor);
  const minimum = reward.compraMinima == null ? "" : ` · compra mínima ${money(reward.compraMinima)}`;
  const days = reward.vigenciaDias == null ? "" : ` · vigencia ${reward.vigenciaDias} días`;

  return `${base} · ${discount}${minimum}${days}`;
}

export function CatalogoSection() {
  const { session, refresh } = usePortal();
  const [rewards, setRewards] = useState<RewardItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    portalFetch<{ recompensas: RewardItem[] }>("/api/portal/catalogo")
      .then((data) => {
        if (active) {
          setRewards(data.recompensas);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(portalErrorMessage(caught));
          setRewards([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function redeem(rewardId: string) {
    setError(null);
    setMessage(null);
    setPendingId(rewardId);

    try {
      const result = await portalFetch<RedeemResult>("/api/portal/canjes", {
        method: "POST",
        body: JSON.stringify({ rewardId }),
      });
      setMessage(
        result.couponCode
          ? `Canje listo. Tu cupón es ${result.couponCode}${result.vence ? ` y vence el ${result.vence}` : ""}.`
          : "Canje registrado. El equipo lo entrega en tienda.",
      );
      await refresh();
      const data = await portalFetch<{ recompensas: RewardItem[] }>("/api/portal/catalogo");
      setRewards(data.recompensas);
    } catch (caught) {
      setError(portalErrorMessage(caught));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Catálogo</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Tienes {points(session.puntosDisponibles)} puntos disponibles.
        </p>
      </header>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}
      {rewards == null ? (
        <p className="text-sm text-zinc-600">Cargando catálogo…</p>
      ) : rewards.length === 0 ? (
        <EmptyState>Todavía no hay recompensas en el catálogo.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {rewards.map((reward) => {
            const block = redeemPreview({
              activo: reward.activo,
              nivelMinimo: reward.nivelMinimo,
              nivel: session.nivel,
              puntosRequeridos: reward.puntosRequeridos,
              puntosDisponibles: session.puntosDisponibles,
              stock: reward.stock,
            });

            return (
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
                    <button
                      className={primaryClass}
                      type="button"
                      disabled={block != null || pendingId != null}
                      onClick={() => void redeem(reward.id)}
                    >
                      {pendingId === reward.id ? "Canjeando…" : "Canjear"}
                    </button>
                    {block ? <p className="mt-2 text-xs text-zinc-500">{block}</p> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
