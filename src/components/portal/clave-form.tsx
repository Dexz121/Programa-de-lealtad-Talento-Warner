"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Notice, fieldClass, primaryClass } from "@/components/panel/panel-ui";

export function ClaveForm() {
  const temporal = useSearchParams().get("estado") === "temporal";
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // El cambio de contraseña se aplica cuando exista la sesión del cliente.
    setMessage(null);

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

    setError(null);
    setMessage("El cambio de contraseña se conecta en el siguiente paso.");
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {temporal ? "Elige tu contraseña" : "Contraseña"}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          {temporal
            ? "Tu acceso es temporal. Elige una contraseña propia para usar el portal."
            : "Desde aquí cambiarás la contraseña de tu acceso."}
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
        {message ? <Notice tone="ok">{message}</Notice> : null}
        <button className={primaryClass} type="submit">
          Guardar contraseña
        </button>
      </form>
    </section>
  );
}
