"use client";

import { FormEvent, useEffect, useState } from "react";
import type { CustomerListItem, MovementItem, OrderItem, PaymentItem } from "@/domain/panel";
import { money, movementLabel, points, signedPoints } from "@/components/panel/format";
import { usePanelContext } from "@/components/panel/panel-context";
import { EmptyState, Notice, fieldClass, primaryClass, secondaryClass } from "@/components/panel/panel-ui";
import { downloadCsv, isUnauthorized, panelErrorMessage, panelFetch } from "@/components/panel/use-panel-api";

type Detail = {
  cliente: CustomerListItem;
  movimientos: MovementItem[];
  pedidos: OrderItem[] | null;
  pagos: PaymentItem[] | null;
};

export function ClientesSection({
  canExport,
  canSeeAmounts,
  canGrantAccess,
}: {
  canExport: boolean;
  canSeeAmounts: boolean;
  canGrantAccess: boolean;
}) {
  const { onUnauthorized } = usePanelContext();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<CustomerListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;

    panelFetch<{ total: number; clientes: CustomerListItem[] }>("/api/panel/clientes?q=")
      .then((data) => {
        if (!active) {
          return;
        }

        setRows(data.clientes);
        setTotal(data.total);
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

  function fail(caught: unknown) {
    if (isUnauthorized(caught)) {
      onUnauthorized();
    } else {
      setError(panelErrorMessage(caught));
    }
  }

  async function search(event?: FormEvent) {
    event?.preventDefault();
    setError(null);
    setPending(true);
    try {
      const data = await panelFetch<{ total: number; clientes: CustomerListItem[] }>(
        `/api/panel/clientes?q=${encodeURIComponent(query.trim())}`,
      );
      setRows(data.clientes);
      setTotal(data.total);
      setDetail(null);
      setPassword(null);
    } catch (caught) {
      fail(caught);
    } finally {
      setPending(false);
    }
  }

  async function openCustomer(id: string) {
    setError(null);
    setPassword(null);
    try {
      setDetail(await panelFetch<Detail>(`/api/panel/clientes/${encodeURIComponent(id)}`));
    } catch (caught) {
      fail(caught);
    }
  }

  async function grantAccess() {
    if (!detail) {
      return;
    }

    setError(null);
    try {
      const result = await panelFetch<{ password: string }>(`/api/panel/clientes/${encodeURIComponent(detail.cliente.id)}/acceso`, {
        method: "POST",
      });
      setPassword(result.password);
      setDetail({
        ...detail,
        cliente: { ...detail.cliente, portal: "temporal" },
      });
    } catch (caught) {
      fail(caught);
    }
  }

  async function exportClients() {
    setError(null);
    try {
      await downloadCsv("clientes");
    } catch (caught) {
      fail(caught);
    }
  }

  const cliente = detail?.cliente;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Clientes</h2>
          <p className="mt-1 text-sm text-zinc-600">Busca por nombre, correo o identificador.</p>
        </div>
        {canExport ? (
          <button className={secondaryClass} type="button" onClick={exportClients}>
            Exportar CSV
          </button>
        ) : null}
      </header>
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={search}>
        <label className="flex-1 text-sm font-medium">
          Buscar
          <input
            className={`${fieldClass} mt-1`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, correo o id"
          />
        </label>
        <button className={`${primaryClass} sm:self-end`} type="submit" disabled={pending}>
          {pending ? "Buscando…" : "Buscar"}
        </button>
      </form>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {rows && rows.length === 0 ? (
        <EmptyState>
          {total === 0 && !query.trim()
            ? "Todavía no hay clientes. Llegan cuando la sincronización guarda la tienda."
            : "Ningún cliente coincide con la búsqueda."}
        </EmptyState>
      ) : null}
      {rows && rows.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(16rem,22rem)_1fr]">
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <p className="border-b border-zinc-200 px-4 py-3 text-xs text-zinc-500">
              {total > rows.length ? `${rows.length} de ${total}` : `${rows.length} clientes`}
            </p>
            <ul>
              {rows.map((row) => (
                <li key={row.id} className="border-b border-zinc-100 last:border-0">
                  <button
                    className="w-full px-4 py-3 text-left hover:bg-zinc-50"
                    type="button"
                    onClick={() => openCustomer(row.id)}
                  >
                    <span className="block font-medium">{row.nombre}</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {row.email || row.id} · {row.nivel ?? "Sin nivel"} · {points(row.puntos)} pts
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {cliente ? (
            <div className="flex flex-col gap-4">
              <article className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">{cliente.nombre}</h3>
                    <p className="mt-1 text-sm text-zinc-600">{cliente.email || "Sin correo"} · {cliente.id}</p>
                    <p className="mt-1 text-sm text-zinc-600">
                      Portal: {cliente.portal}
                      {cliente.telefono ? ` · ${cliente.telefono}` : ""}
                    </p>
                  </div>
                  {canGrantAccess ? (
                    <button className={secondaryClass} type="button" onClick={grantAccess}>
                      {cliente.portal === "sin acceso" ? "Generar acceso" : "Restablecer acceso"}
                    </button>
                  ) : null}
                </div>
                {password ? (
                  <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-950">Contraseña temporal</p>
                    <p className="mt-1 font-mono text-lg text-amber-950">{password}</p>
                    <p className="mt-2 text-sm text-amber-900">
                      Se muestra una sola vez. En el primer ingreso el cliente tiene que cambiarla.
                    </p>
                  </div>
                ) : null}
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-zinc-500">Nivel</dt>
                    <dd className="font-medium">{cliente.nivel ?? "Sin calcular"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Puntos ganados</dt>
                    <dd className="font-medium">{points(cliente.puntos)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Puntos disponibles</dt>
                    <dd className="font-medium">{points(cliente.puntosDisponibles)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Riesgo</dt>
                    <dd className="font-medium">
                      {cliente.enRiesgo == null ? "Sin calcular" : cliente.enRiesgo ? "En riesgo" : "Al día"}
                      {cliente.diasSinActividad != null ? ` · ${points(cliente.diasSinActividad)} días` : ""}
                    </dd>
                  </div>
                  {canSeeAmounts ? (
                    <div>
                      <dt className="text-xs text-zinc-500">Gasto 12 meses</dt>
                      <dd className="font-medium">{money(cliente.gasto12m)}</dd>
                    </div>
                  ) : null}
                </dl>
              </article>
              <article className="rounded-lg border border-zinc-200 bg-white p-4">
                <h3 className="font-semibold">Historial de puntos</h3>
                {detail.movimientos.length === 0 ? (
                  <p className="mt-3 text-sm text-zinc-600">Este cliente todavía no tiene movimientos.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-zinc-100">
                    {detail.movimientos.map((movement, index) => (
                      <li key={`${movement.referencia}-${index}`} className="flex items-start justify-between gap-3 py-3 text-sm">
                        <div>
                          <p className="font-medium">{movementLabel(movement.tipo)}</p>
                          <p className="text-zinc-500">
                            {movement.fecha || "Sin fecha"}
                            {movement.referencia ? ` · ${movement.referencia}` : ""}
                          </p>
                        </div>
                        <p className="font-medium">{signedPoints(movement.puntos)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
              {canSeeAmounts && detail.pedidos ? (
                <article className="rounded-lg border border-zinc-200 bg-white p-4">
                  <h3 className="font-semibold">Pedidos</h3>
                  {detail.pedidos.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-600">No hay pedidos ligados a este cliente.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-zinc-100 text-sm">
                      {detail.pedidos.map((order) => (
                        <li key={order.id} className="py-3">
                          <p className="font-medium">{order.id}</p>
                          <p className="text-zinc-500">
                            {order.fecha || "Sin fecha"} · {order.estado || "sin estado"} · pago {order.pago || "sin estado"} ·{" "}
                            {money(order.total)} {order.moneda}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ) : null}
              {canSeeAmounts && detail.pagos ? (
                <article className="rounded-lg border border-zinc-200 bg-white p-4">
                  <h3 className="font-semibold">Pagos</h3>
                  {detail.pagos.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-600">No hay pagos ligados a este cliente.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-zinc-100 text-sm">
                      {detail.pagos.map((payment) => (
                        <li key={payment.id} className="py-3">
                          <p className="font-medium">{payment.id}</p>
                          <p className="text-zinc-500">
                            {payment.fecha || "Sin fecha"} · {payment.estado || "sin estado"} · {money(payment.monto)} {payment.moneda}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ) : null}
            </div>
          ) : (
            <EmptyState>Elige un cliente para ver puntos, nivel e historial.</EmptyState>
          )}
        </div>
      ) : null}
    </section>
  );
}
