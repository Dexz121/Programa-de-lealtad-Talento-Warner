"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { PanelSession } from "@/domain/panel";
import type { PermissionId } from "@/domain/permissions";
import { getFirebaseAuth } from "@/lib/firebase";
import { CanjesSection } from "@/components/panel/canjes-section";
import { CatalogoSection } from "@/components/panel/catalogo-section";
import { ClientesSection } from "@/components/panel/clientes-section";
import { EquipoSection } from "@/components/panel/equipo-section";
import { ListSection } from "@/components/panel/list-section";
import { PanelProvider } from "@/components/panel/panel-context";
import { ResumenSection } from "@/components/panel/resumen-section";
import { RolesSection } from "@/components/panel/roles-section";
import { SyncSection } from "@/components/panel/sync-section";
import { TokensSection } from "@/components/panel/tokens-section";
import { secondaryClass } from "@/components/panel/panel-ui";
import { isUnauthorized, panelFetch } from "@/components/panel/use-panel-api";

const SECTIONS: Array<{ id: string; label: string; permission: PermissionId }> = [
  { id: "resumen", label: "Resumen", permission: "ver_resumen" },
  { id: "clientes", label: "Clientes", permission: "buscar_cliente" },
  { id: "riesgo", label: "Riesgo", permission: "ver_riesgo_cumpleanos" },
  { id: "cumpleanos", label: "Cumpleaños", permission: "ver_riesgo_cumpleanos" },
  { id: "catalogo", label: "Catálogo", permission: "gestionar_catalogo" },
  { id: "canjes", label: "Canjes", permission: "gestionar_canjes" },
  { id: "equipo", label: "Equipo", permission: "gestionar_usuarios" },
  { id: "roles", label: "Roles", permission: "gestionar_roles" },
  { id: "tokens", label: "Tokens", permission: "gestionar_tokens" },
  { id: "sincronizacion", label: "Sincronización", permission: "ejecutar_sincronizacion" },
];

export function PanelApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [staff, setStaff] = useState<PanelSession | null>(null);
  const [ready, setReady] = useState(false);

  const onUnauthorized = useCallback(() => {
    void signOut(getFirebaseAuth()).finally(() => {
      router.replace("/login");
    });
  }, [router]);

  useEffect(() => {
    return onAuthStateChanged(getFirebaseAuth(), async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        setStaff(await panelFetch<PanelSession>("/api/panel/session"));
      } catch (caught) {
        if (isUnauthorized(caught)) {
          onUnauthorized();
          return;
        }

        await signOut(getFirebaseAuth());
        router.replace("/login");
      } finally {
        setReady(true);
      }
    });
  }, [onUnauthorized, router]);

  async function logout() {
    await signOut(getFirebaseAuth());
    router.replace("/login");
  }

  if (!ready || !staff) {
    return (
      <main className="flex flex-1 items-center bg-zinc-100 px-6 py-16 text-sm text-zinc-600">
        Comprobando sesión…
      </main>
    );
  }

  const visible = SECTIONS.filter((section) => staff.permissions.includes(section.permission));
  const requested = searchParams.get("seccion");
  const current = visible.find((section) => section.id === requested) ?? visible[0];

  function open(id: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("seccion", id);
    router.replace(`/panel?${next.toString()}`);
  }

  const can = (permission: PermissionId) => staff.permissions.includes(permission);

  return (
    <PanelProvider value={{ staff, onUnauthorized }}>
      <div className="flex min-h-full flex-1 flex-col bg-zinc-100 text-zinc-900 md:flex-row">
        <aside className="border-b border-zinc-200 bg-white md:w-60 md:border-r md:border-b-0">
          <div className="px-4 py-5">
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Programa de lealtad</p>
            <p className="mt-2 text-sm font-medium">{staff.displayName || staff.email}</p>
            <p className="text-sm text-zinc-500">{staff.roleName}</p>
          </div>
          <nav className="flex gap-2 overflow-x-auto px-3 pb-3 md:flex-col md:px-3 md:pb-6">
            {visible.map((section) => (
              <button
                key={section.id}
                className={`rounded-md px-3 py-2 text-left text-sm whitespace-nowrap ${
                  current?.id === section.id ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
                }`}
                type="button"
                aria-current={current?.id === section.id ? "page" : undefined}
                onClick={() => open(section.id)}
              >
                {section.label}
              </button>
            ))}
          </nav>
          <div className="hidden px-3 pb-6 md:block">
            <button className={secondaryClass} type="button" onClick={logout}>
              Cerrar sesión
            </button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex justify-end px-4 py-3 md:hidden">
            <button className={secondaryClass} type="button" onClick={logout}>
              Cerrar sesión
            </button>
          </div>
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            {current?.id === "resumen" ? <ResumenSection canExport={can("exportar_reportes")} /> : null}
            {current?.id === "clientes" ? (
              <ClientesSection
                canExport={can("exportar_reportes")}
                canSeeAmounts={can("ver_montos")}
                canGrantAccess={can("generar_acceso_portal")}
              />
            ) : null}
            {current?.id === "riesgo" ? <ListSection kind="riesgo" canExport={can("exportar_reportes")} /> : null}
            {current?.id === "cumpleanos" ? <ListSection kind="cumpleanos" canExport={can("exportar_reportes")} /> : null}
            {current?.id === "catalogo" ? <CatalogoSection /> : null}
            {current?.id === "canjes" ? <CanjesSection /> : null}
            {current?.id === "equipo" ? <EquipoSection /> : null}
            {current?.id === "roles" ? <RolesSection /> : null}
            {current?.id === "tokens" ? <TokensSection /> : null}
            {current?.id === "sincronizacion" ? <SyncSection /> : null}
            {!current ? (
              <p className="text-sm text-zinc-600">Esta cuenta no tiene permisos para ver el panel.</p>
            ) : null}
          </main>
        </div>
      </div>
    </PanelProvider>
  );
}
