"use client";

import { FormEvent, useEffect, useState } from "react";
import { LEVELS, type RewardItem } from "@/domain/panel";
import { points } from "@/components/panel/format";
import { usePanelContext } from "@/components/panel/panel-context";
import { EmptyState, Notice, fieldClass, primaryClass, secondaryClass } from "@/components/panel/panel-ui";
import { isUnauthorized, panelErrorMessage, panelFetch } from "@/components/panel/use-panel-api";

type RewardDraft = {
  tipo: "producto" | "descuento";
  nombre: string;
  descripcion: string;
  puntosRequeridos: string;
  stock: string;
  nivelMinimo: (typeof LEVELS)[number];
  limitePorCliente: string;
  activo: boolean;
  descuentoTipo: "porcentaje" | "monto";
  descuentoValor: string;
  compraMinima: string;
  vigenciaDias: string;
};

const EMPTY: RewardDraft = {
  tipo: "producto",
  nombre: "",
  descripcion: "",
  puntosRequeridos: "",
  stock: "",
  nivelMinimo: "Bronce",
  limitePorCliente: "",
  activo: true,
  descuentoTipo: "porcentaje",
  descuentoValor: "",
  compraMinima: "",
  vigenciaDias: "",
};

function draftFrom(reward: RewardItem): RewardDraft {
  return {
    tipo: reward.tipo,
    nombre: reward.nombre,
    descripcion: reward.descripcion,
    puntosRequeridos: String(reward.puntosRequeridos),
    stock: reward.stock == null ? "" : String(reward.stock),
    nivelMinimo: reward.nivelMinimo,
    limitePorCliente: reward.limitePorCliente == null ? "" : String(reward.limitePorCliente),
    activo: reward.activo,
    descuentoTipo: reward.descuentoTipo ?? "porcentaje",
    descuentoValor: reward.descuentoValor == null ? "" : String(reward.descuentoValor),
    compraMinima: reward.compraMinima == null ? "" : String(reward.compraMinima),
    vigenciaDias: reward.vigenciaDias == null ? "" : String(reward.vigenciaDias),
  };
}

function payloadFrom(draft: RewardDraft) {
  return {
    tipo: draft.tipo,
    nombre: draft.nombre,
    descripcion: draft.descripcion,
    puntosRequeridos: Number(draft.puntosRequeridos),
    stock: draft.stock.trim() === "" ? null : Number(draft.stock),
    nivelMinimo: draft.nivelMinimo,
    limitePorCliente: draft.limitePorCliente.trim() === "" ? null : Number(draft.limitePorCliente),
    activo: draft.activo,
    descuentoTipo: draft.tipo === "descuento" ? draft.descuentoTipo : null,
    descuentoValor: draft.tipo === "descuento" && draft.descuentoValor.trim() !== "" ? Number(draft.descuentoValor) : null,
    compraMinima: draft.tipo === "descuento" && draft.compraMinima.trim() !== "" ? Number(draft.compraMinima) : null,
    vigenciaDias: draft.tipo === "descuento" && draft.vigenciaDias.trim() !== "" ? Number(draft.vigenciaDias) : null,
  };
}

export function CatalogoSection() {
  const { onUnauthorized } = usePanelContext();
  const [rewards, setRewards] = useState<RewardItem[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<RewardDraft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function fail(caught: unknown) {
    if (isUnauthorized(caught)) {
      onUnauthorized();
    } else {
      setError(panelErrorMessage(caught));
    }
  }

  async function load() {
    const data = await panelFetch<{ recompensas: RewardItem[] }>("/api/panel/recompensas");
    setRewards(data.recompensas);
  }

  useEffect(() => {
    let active = true;
    panelFetch<{ recompensas: RewardItem[] }>("/api/panel/recompensas")
      .then((data) => {
        if (active) {
          setRewards(data.recompensas);
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

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const body = JSON.stringify(payloadFrom(draft));
      if (editing) {
        await panelFetch(`/api/panel/recompensas/${editing}`, { method: "PATCH", body });
        setMessage("Recompensa actualizada.");
      } else {
        await panelFetch("/api/panel/recompensas", { method: "POST", body });
        setMessage("Recompensa creada.");
      }
      setDraft(EMPTY);
      setEditing(null);
      await load();
    } catch (caught) {
      fail(caught);
    } finally {
      setPending(false);
    }
  }

  async function upload(id: string, file: File | undefined) {
    if (!file) {
      return;
    }

    setError(null);
    setMessage(null);
    const body = new FormData();
    body.set("foto", file);
    try {
      await panelFetch(`/api/panel/recompensas/${id}/foto`, { method: "POST", body });
      setMessage("Foto actualizada.");
      await load();
    } catch (caught) {
      fail(caught);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Catálogo</h2>
        <p className="mt-1 text-sm text-zinc-600">Productos y descuentos que el cliente puede canjear.</p>
      </header>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}
      <form className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-2" onSubmit={save}>
        <label className="text-sm font-medium">
          Tipo
          <select
            className={`${fieldClass} mt-1`}
            value={draft.tipo}
            onChange={(event) => setDraft({ ...draft, tipo: event.target.value === "descuento" ? "descuento" : "producto" })}
          >
            <option value="producto">Producto</option>
            <option value="descuento">Descuento</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Nivel mínimo
          <select
            className={`${fieldClass} mt-1`}
            value={draft.nivelMinimo}
            onChange={(event) => {
              const nivel = LEVELS.find((level) => level === event.target.value) ?? "Bronce";
              setDraft({ ...draft, nivelMinimo: nivel });
            }}
          >
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium md:col-span-2">
          Nombre
          <input className={`${fieldClass} mt-1`} value={draft.nombre} onChange={(event) => setDraft({ ...draft, nombre: event.target.value })} required />
        </label>
        <label className="text-sm font-medium md:col-span-2">
          Descripción
          <textarea className={`${fieldClass} mt-1`} rows={3} value={draft.descripcion} onChange={(event) => setDraft({ ...draft, descripcion: event.target.value })} />
        </label>
        <label className="text-sm font-medium">
          Puntos requeridos
          <input className={`${fieldClass} mt-1`} inputMode="numeric" value={draft.puntosRequeridos} onChange={(event) => setDraft({ ...draft, puntosRequeridos: event.target.value })} required />
        </label>
        <label className="text-sm font-medium">
          Stock {draft.tipo === "descuento" ? "(vacío = ilimitado)" : ""}
          <input className={`${fieldClass} mt-1`} inputMode="numeric" value={draft.stock} onChange={(event) => setDraft({ ...draft, stock: event.target.value })} required={draft.tipo === "producto"} />
        </label>
        <label className="text-sm font-medium">
          Límite por cliente
          <input className={`${fieldClass} mt-1`} inputMode="numeric" value={draft.limitePorCliente} onChange={(event) => setDraft({ ...draft, limitePorCliente: event.target.value })} placeholder="Opcional" />
        </label>
        <label className="flex items-center gap-2 self-end text-sm font-medium">
          <input type="checkbox" checked={draft.activo} onChange={(event) => setDraft({ ...draft, activo: event.target.checked })} />
          Activa
        </label>
        {draft.tipo === "descuento" ? (
          <>
            <label className="text-sm font-medium">
              Descuento
              <select
                className={`${fieldClass} mt-1`}
                value={draft.descuentoTipo}
                onChange={(event) => setDraft({ ...draft, descuentoTipo: event.target.value === "monto" ? "monto" : "porcentaje" })}
              >
                <option value="porcentaje">Porcentaje</option>
                <option value="monto">Monto fijo en MXN</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Valor
              <input className={`${fieldClass} mt-1`} inputMode="decimal" value={draft.descuentoValor} onChange={(event) => setDraft({ ...draft, descuentoValor: event.target.value })} required />
            </label>
            <label className="text-sm font-medium">
              Compra mínima
              <input className={`${fieldClass} mt-1`} inputMode="decimal" value={draft.compraMinima} onChange={(event) => setDraft({ ...draft, compraMinima: event.target.value })} placeholder="Opcional" />
            </label>
            <label className="text-sm font-medium">
              Vigencia en días
              <input className={`${fieldClass} mt-1`} inputMode="numeric" value={draft.vigenciaDias} onChange={(event) => setDraft({ ...draft, vigenciaDias: event.target.value })} required />
            </label>
          </>
        ) : null}
        <div className="flex gap-2 md:col-span-2">
          <button className={primaryClass} type="submit" disabled={pending}>
            {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear recompensa"}
          </button>
          {editing ? (
            <button
              className={secondaryClass}
              type="button"
              onClick={() => {
                setEditing(null);
                setDraft(EMPTY);
              }}
            >
              Cancelar edición
            </button>
          ) : null}
        </div>
      </form>
      {!rewards && !error ? <p className="text-sm text-zinc-600">Cargando catálogo…</p> : null}
      {rewards && rewards.length === 0 ? <EmptyState>El catálogo está vacío.</EmptyState> : null}
      <ul className="grid gap-3">
        {rewards?.map((reward) => (
          <li key={reward.id} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:flex-row sm:items-start">
            {reward.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={reward.fotoUrl} alt="" className="h-20 w-20 rounded-md object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-md bg-zinc-100 text-xs text-zinc-500">Sin foto</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {reward.nombre}{" "}
                <span className="text-sm font-normal text-zinc-500">{reward.activo ? reward.tipo : "inactiva"}</span>
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                {points(reward.puntosRequeridos)} pts · nivel {reward.nivelMinimo} · stock {reward.stock == null ? "ilimitado" : points(reward.stock)}
              </p>
              {reward.descripcion ? <p className="mt-1 text-sm text-zinc-600">{reward.descripcion}</p> : null}
            </div>
            <div className="flex flex-col gap-2">
              <button
                className={secondaryClass}
                type="button"
                onClick={() => {
                  setEditing(reward.id);
                  setDraft(draftFrom(reward));
                }}
              >
                Editar
              </button>
              <label className={`${secondaryClass} cursor-pointer text-center`}>
                Subir foto
                <input
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => upload(reward.id, event.target.files?.[0])}
                />
              </label>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
