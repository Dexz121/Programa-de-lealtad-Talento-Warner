"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import type { PortalSession } from "@/domain/panel";
import { getFirebaseAuth } from "@/lib/firebase";
import { Notice } from "@/components/panel/panel-ui";
import { PanelError, portalAuthMessage, portalErrorMessage, portalFetch } from "@/components/portal/use-portal-api";

export function PortalLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      const session = await portalFetch<PortalSession>("/api/portal/session");
      router.push(session.mustChangePassword ? "/portal/clave" : "/portal");
    } catch (caught) {
      await signOut(getFirebaseAuth()).catch(() => undefined);
      if (caught instanceof PanelError) {
        setError(portalErrorMessage(caught));
        return;
      }

      setError(portalAuthMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Correo
        <input
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-normal text-zinc-900"
          type="email"
          name="email"
          autoComplete="username"
          placeholder="correo@ejemplo.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Contraseña
        <input
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-normal text-zinc-900"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <button
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        type="submit"
        disabled={pending}
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
