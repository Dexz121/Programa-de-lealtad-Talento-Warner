"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";

function loginErrorMessage(error: unknown) {
  if (!(error instanceof FirebaseError)) {
    return "No se pudo iniciar sesión.";
  }

  if (
    error.code === "auth/invalid-credential" ||
    error.code === "auth/wrong-password" ||
    error.code === "auth/user-not-found" ||
    error.code === "auth/invalid-email"
  ) {
    return "Correo o contraseña incorrectos.";
  }

  if (error.code === "auth/too-many-requests") {
    return "Demasiados intentos. Espera un momento y vuelve a intentar.";
  }

  if (error.code === "auth/operation-not-allowed" || error.code === "auth/configuration-not-found") {
    return "El acceso con correo y contraseña no está activo en Firebase.";
  }

  if (error.code === "permission-denied") {
    return "No se pudo leer el perfil del equipo. Publica las reglas de Firestore.";
  }

  return "No se pudo iniciar sesión.";
}

export function LoginForm() {
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
      const credential = await signInWithEmailAndPassword(
        getFirebaseAuth(),
        email.trim(),
        password,
      );
      const profile = await getDoc(doc(getFirebaseDb(), "staffUsers", credential.user.uid));

      if (!profile.exists()) {
        await signOut(getFirebaseAuth());
        setError("Esta cuenta no es del equipo interno.");
        return;
      }

      router.push("/panel");
    } catch (caught) {
      setError(loginErrorMessage(caught));
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
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
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
