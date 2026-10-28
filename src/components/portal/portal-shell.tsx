"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { PortalSession } from "@/domain/panel";
import { getFirebaseAuth } from "@/lib/firebase";
import { secondaryClass } from "@/components/panel/panel-ui";
import { PortalProvider } from "@/components/portal/portal-context";
import { LevelBadge } from "@/components/portal/portal-ui";
import { isUnauthorized, PanelError, portalFetch } from "@/components/portal/use-portal-api";

const SECTIONS = [
  { href: "/portal", label: "Inicio" },
  { href: "/portal/catalogo", label: "Catálogo" },
  { href: "/portal/canjes", label: "Mis canjes" },
  { href: "/portal/movimientos", label: "Movimientos" },
  { href: "/portal/clave", label: "Contraseña" },
];

function isCurrent(pathname: string, href: string) {
  if (href === "/portal") {
    return pathname === "/portal";
  }

  return pathname === href;
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const onLogin = pathname === "/portal/login";
  const onClave = pathname === "/portal/clave";
  const [session, setSession] = useState<PortalSession | null>(null);
  const [ready, setReady] = useState(onLogin);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    const next = await portalFetch<PortalSession>("/api/portal/session");
    setSession(next);
    return next;
  }, []);

  useEffect(() => {
    if (onLogin) {
      return;
    }

    return onAuthStateChanged(getFirebaseAuth(), async (user) => {
      if (!user) {
        setSession(null);
        router.replace("/portal/login");
        return;
      }

      try {
        setSession(await portalFetch<PortalSession>("/api/portal/session"));
      } catch (caught) {
        const rejected = isUnauthorized(caught) || (caught instanceof PanelError && caught.status === 403);
        if (rejected) {
          await signOut(getFirebaseAuth());
          router.replace("/portal/login");
          return;
        }

        setFailed(true);
        setSession(null);
      } finally {
        setReady(true);
      }
    });
  }, [onLogin, router]);

  useEffect(() => {
    if (session?.mustChangePassword && !onLogin && !onClave) {
      router.replace("/portal/clave");
    }
  }, [onClave, onLogin, router, session]);

  async function logout() {
    await signOut(getFirebaseAuth());
    router.replace("/portal/login");
  }

  if (onLogin) {
    return children;
  }

  if (!ready || !session) {
    return (
      <main className="flex flex-1 flex-col items-start gap-4 bg-zinc-100 px-6 py-16 text-sm text-zinc-600">
        {failed ? "No se pudo comprobar la sesión." : "Comprobando sesión…"}
        {failed ? (
          <button className={secondaryClass} type="button" onClick={() => void logout()}>
            Volver al acceso
          </button>
        ) : null}
      </main>
    );
  }

  const blocked = session.mustChangePassword;

  return (
    <PortalProvider value={{ session, refresh }}>
      <div className="flex min-h-full flex-1 flex-col bg-zinc-100 text-zinc-900 md:flex-row">
        <aside className="border-b border-zinc-200 bg-white md:w-60 md:border-r md:border-b-0">
          <div className="px-4 py-5">
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Programa de lealtad</p>
            <p className="mt-2 text-sm font-medium">{session.nombre}</p>
            <div className="mt-2">
              {blocked ? (
                <p className="text-sm text-zinc-500">Acceso temporal</p>
              ) : session.nivel ? (
                <LevelBadge level={session.nivel} />
              ) : (
                <p className="text-sm text-zinc-500">Sin nivel</p>
              )}
            </div>
          </div>
          {blocked ? (
            <p className="px-4 pb-4 text-sm text-zinc-600">
              Primero elige tu contraseña. El resto del portal espera ese cambio.
            </p>
          ) : (
            <nav className="flex gap-2 overflow-x-auto px-3 pb-3 md:flex-col md:px-3 md:pb-6">
              {SECTIONS.map((section) => (
                <Link
                  key={section.href}
                  href={section.href}
                  className={`rounded-md px-3 py-2 text-left text-sm whitespace-nowrap ${
                    isCurrent(pathname, section.href) ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                  aria-current={isCurrent(pathname, section.href) ? "page" : undefined}
                >
                  {section.label}
                </Link>
              ))}
            </nav>
          )}
          <div className="hidden px-3 pb-6 md:block">
            <button className={secondaryClass} type="button" onClick={() => void logout()}>
              Cerrar sesión
            </button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex justify-end px-4 py-3 md:hidden">
            <button className={secondaryClass} type="button" onClick={() => void logout()}>
              Cerrar sesión
            </button>
          </div>
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            {blocked && !onClave ? (
              <p className="text-sm text-zinc-600">Elige tu contraseña para continuar.</p>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </PortalProvider>
  );
}
