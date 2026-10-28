"use client";

import { FormEvent, useState } from "react";
import { Notice } from "@/components/panel/panel-ui";

export function PortalLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // El inicio de sesión del cliente se conecta en el siguiente paso. No llama a Firebase.
    setMessage(null);
    const trimmed = email.trim();

    if (!trimmed.includes("@") || !trimmed.includes(".")) {
      setError("Escribe un correo válido.");
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setError(null);
    setMessage("La sesión del cliente se conecta en el siguiente paso.");
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
      {message ? <Notice tone="ok">{message}</Notice> : null}
      <button
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        type="submit"
      >
        Entrar
      </button>
    </form>
  );
}
