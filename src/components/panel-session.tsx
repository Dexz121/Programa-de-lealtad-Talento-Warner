"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";

type StaffProfile = {
  email: string;
  roleName: string;
};

export function PanelSession() {
  const router = useRouter();
  const [profile, setProfile] = useState<StaffProfile | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();

    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const snapshot = await getDoc(doc(getFirebaseDb(), "staffUsers", user.uid));

      if (!snapshot.exists()) {
        await signOut(auth);
        router.replace("/login");
        return;
      }

      const data = snapshot.data();
      setProfile({
        email: typeof data.email === "string" ? data.email : (user.email ?? ""),
        roleName: typeof data.roleName === "string" ? data.roleName : "Equipo",
      });
    });
  }, [router]);

  async function logout() {
    await signOut(getFirebaseAuth());
    router.replace("/login");
  }

  if (!profile) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
        <p className="text-sm text-zinc-600">Comprobando sesión…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-zinc-500">Programa de lealtad</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Panel interno</h1>
      <p className="mt-3 text-zinc-600">
        Sesión iniciada como {profile.email}. Rol: {profile.roleName}.
      </p>
      <p className="mt-3 text-zinc-600">
        Aquí irán el resumen, la búsqueda de clientes, el riesgo, los cumpleaños y la
        gestión de recompensas.
      </p>
      <button
        className="mt-8 w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        type="button"
        onClick={logout}
      >
        Cerrar sesión
      </button>
    </main>
  );
}
