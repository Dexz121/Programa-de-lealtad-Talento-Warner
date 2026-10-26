"use client";

import { FormEvent, useEffect, useState } from "react";
import type { TokenItem } from "@/domain/panel";
import { usePanelContext } from "@/components/panel/panel-context";
import { EmptyState, Notice, fieldClass, primaryClass, secondaryClass } from "@/components/panel/panel-ui";
import { isUnauthorized, panelErrorMessage, panelFetch } from "@/components/panel/use-panel-api";

export function TokensSection() {
  const { onUnauthorized } = usePanelContext();
  const [tokens, setTokens] = useState<TokenItem[] | null>(null);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function fail(caught: unknown) {
    if (isUnauthorized(caught)) {
      onUnauthorized();
    } else {
      setError(panelErrorMessage(caught));
    }
  }

  async function load() {
    const data = await panelFetch<{ tokens: TokenItem[] }>("/api/panel/tokens");
    setTokens(data.tokens);
  }

  useEffect(() => {
    let active = true;
    panelFetch<{ tokens: TokenItem[] }>("/api/panel/tokens")
      .then((data) => {
        if (active) {
          setTokens(data.tokens);
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

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSecret(null);
    setPending(true);
    try {
      const created = await panelFetch<TokenItem & { token: string }>("/api/panel/tokens", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setSecret(created.token);
      setName("");
      await load();
    } catch (caught) {
      fail(caught);
    } finally {
      setPending(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      await panelFetch(`/api/panel/tokens/${id}`, { method: "DELETE" });
      await load();
    } catch (caught) {
      fail(caught);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Tokens de evaluación</h2>
        <p className="mt-1 text-sm text-zinc-600">Sirven para los endpoints de fidelización. Solo se guarda el hash.</p>
      </header>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {secret ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-950">Token nuevo</p>
          <p className="mt-1 break-all font-mono text-sm text-amber-950">{secret}</p>
          <p className="mt-2 text-sm text-amber-900">Cópialo ahora. No se vuelve a mostrar.</p>
        </div>
      ) : null}
      <form className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:flex-row sm:items-end" onSubmit={create}>
        <label className="flex-1 text-sm font-medium">
          Nombre
          <input className={`${fieldClass} mt-1`} value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <button className={primaryClass} type="submit" disabled={pending}>
          {pending ? "Generando…" : "Generar token"}
        </button>
      </form>
      {!tokens && !error ? <p className="text-sm text-zinc-600">Cargando tokens…</p> : null}
      {tokens && tokens.length === 0 ? <EmptyState>Todavía no hay tokens.</EmptyState> : null}
      <ul className="grid gap-3">
        {tokens?.map((token) => (
          <li key={token.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4">
            <div>
              <p className="font-medium">{token.name}</p>
              <p className="text-sm text-zinc-600">
                {token.prefix}… · {token.createdAt || "hoy"} · {token.revoked ? "revocado" : "activo"}
              </p>
            </div>
            {token.revoked ? null : (
              <button className={secondaryClass} type="button" onClick={() => revoke(token.id)}>
                Revocar
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
