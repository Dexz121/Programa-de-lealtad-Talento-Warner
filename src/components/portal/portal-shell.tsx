"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { secondaryClass } from "@/components/panel/panel-ui";
import { ClaveForm } from "@/components/portal/clave-form";
import { portalCustomer } from "@/components/portal/fixtures";
import { LevelBadge } from "@/components/portal/portal-ui";

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
  const searchParams = useSearchParams();
  const temporal = searchParams.get("estado") === "temporal";
  const onLogin = pathname === "/portal/login";
  const onClave = pathname === "/portal/clave";
  const blocked = temporal && !onLogin;

  useEffect(() => {
    if (blocked && !onClave) {
      router.replace("/portal/clave?estado=temporal");
    }
  }, [blocked, onClave, router]);

  if (onLogin) {
    return children;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-100 text-zinc-900 md:flex-row">
      <aside className="border-b border-zinc-200 bg-white md:w-60 md:border-r md:border-b-0">
        <div className="px-4 py-5">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Programa de lealtad</p>
          <p className="mt-2 text-sm font-medium">{portalCustomer.nombre}</p>
          <div className="mt-2">
            {blocked ? (
              <p className="text-sm text-zinc-500">Acceso temporal</p>
            ) : (
              <LevelBadge level={portalCustomer.nivel} />
            )}
          </div>
        </div>
        {blocked ? (
          <p className="px-4 pb-4 text-sm text-zinc-600">Primero elige tu contraseña. El resto del portal espera ese cambio.</p>
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
          <Link className={`${secondaryClass} inline-block`} href="/portal/login">
            Cerrar sesión
          </Link>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex justify-end px-4 py-3 md:hidden">
          <Link className={secondaryClass} href="/portal/login">
            Cerrar sesión
          </Link>
        </div>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          {blocked && !onClave ? <ClaveForm /> : children}
        </main>
      </div>
    </div>
  );
}
