"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { EmailAuthProvider, reauthenticateWithCredential, signInWithEmailAndPassword } from "firebase/auth";
import { Notice, fieldClass, primaryClass } from "@/components/panel/panel-ui";
import { usePortal } from "@/components/portal/portal-context";
import { portalAuthMessage, portalErrorMessage, portalFetch } from "@/components/portal/use-portal-api";
import { getFirebaseAuth } from "@/lib/firebase";

export function ClaveForm() {
  const router = useRouter();
  const { session, refresh } = usePortal();
  const temporal = session.mustChangePassword;
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!temporal && current.trim() === "") {
      setError("Escribe tu contraseña actual.");
      return;
    }

    if (password.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirm) {
      setError("La confirmación no coincide.");
      return;
    }

    const auth = getFirebaseAuth();
    const email = auth.currentUser?.email || session.email;
    if (!auth.currentUser || !email) {
      setError("La sesión expiró. Vuelve a entrar.");
      return;
    }

    setPending(true);

    try {
      if (!temporal) {
        await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(email, current));
      }

      await portalFetch("/api/portal/clave", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      await signInWithEmailAndPassword(auth, email, password);
      await refresh();
      router.replace("/portal");
    } catch (caught) {
      if (
        !temporal &&
        caught instanceof FirebaseError &&
        (caught.code === "auth/wrong-password" || caught.code === "auth/invalid-credential")
      ) {
        setError("La contraseña actual no es correcta.");
        return;
      }

      const message = portalErrorMessage(caught);
      setError(message === "No se pudo completar la acción." ? portalAuthMessage(caught) : message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{temporal ? "Elige tu contraseña" : "Contraseña"}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {temporal
            ? "Tu acceso es temporal. Elige una contraseña propia para usar el portal."
            : "Desde aquí cambias la contraseña de tu acceso."}
        </p>
      </header>
      <form className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4" onSubmit={onSubmit}>
        {temporal ? null : (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Contraseña actual
            <input
              className={fieldClass}
              type="password"
              name="current-password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nueva contraseña
          <input
            className={fieldClass}
            type="password"
            name="new-password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Confirmar contraseña
          <input
            className={fieldClass}
            type="password"
            name="confirm-password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </label>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <button className={primaryClass} type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
    </section>
  );
}
