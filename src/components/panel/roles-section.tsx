"use client";

import { FormEvent, useEffect, useState } from "react";
import { PERMISSIONS, type PermissionId } from "@/domain/permissions";
import type { RoleItem } from "@/domain/panel";
import { usePanelContext } from "@/components/panel/panel-context";
import { Notice, fieldClass, primaryClass, secondaryClass } from "@/components/panel/panel-ui";
import { isUnauthorized, panelErrorMessage, panelFetch } from "@/components/panel/use-panel-api";

const INITIAL_IDS = new Set(["administrador", "gerente", "atencion_a_clientes"]);

export function RolesSection() {
  const { onUnauthorized } = usePanelContext();
  const [roles, setRoles] = useState<RoleItem[] | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<PermissionId[]>(["ver_resumen"]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function fail(caught: unknown) {
    if (isUnauthorized(caught)) {
      onUnauthorized();
    } else {
      setError(panelErrorMessage(caught));
    }
  }

  async function load() {
    const data = await panelFetch<{ roles: RoleItem[] }>("/api/panel/roles");
    setRoles(data.roles);
  }

  useEffect(() => {
    let active = true;
    panelFetch<{ roles: RoleItem[] }>("/api/panel/roles")
      .then((data) => {
        if (active) {
          setRoles(data.roles);
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

  function toggle(id: PermissionId, checked: boolean, current: PermissionId[]) {
    return checked ? [...current, id] : current.filter((item) => item !== id);
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      await panelFetch("/api/panel/roles", {
        method: "POST",
        body: JSON.stringify({ name, permissions: selected }),
      });
      setName("");
      setSelected(["ver_resumen"]);
      setMessage("Rol creado.");
      await load();
    } catch (caught) {
      fail(caught);
    } finally {
      setPending(false);
    }
  }

  async function save(role: RoleItem, permissions: PermissionId[], nextName = role.name) {
    setError(null);
    setMessage(null);
    try {
      await panelFetch(`/api/panel/roles/${role.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: nextName, permissions }),
      });
      setMessage("Rol actualizado.");
      await load();
    } catch (caught) {
      fail(caught);
    }
  }

  async function remove(role: RoleItem) {
    setError(null);
    setMessage(null);
    try {
      await panelFetch(`/api/panel/roles/${role.id}`, { method: "DELETE" });
      setMessage("Rol eliminado.");
      await load();
    } catch (caught) {
      fail(caught);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Roles</h2>
        <p className="mt-1 text-sm text-zinc-600">Los permisos salen de una lista fija. Ocultar un botón no sustituye esta revisión.</p>
      </header>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}
      <form className="rounded-lg border border-zinc-200 bg-white p-4" onSubmit={create}>
        <label className="text-sm font-medium">
          Nombre del rol
          <input className={`${fieldClass} mt-1`} value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-medium">Permisos</legend>
          {PERMISSIONS.map((permission) => (
            <label key={permission.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(permission.id)}
                onChange={(event) => setSelected(toggle(permission.id, event.target.checked, selected))}
              />
              {permission.label}
            </label>
          ))}
        </fieldset>
        <button className={`${primaryClass} mt-4`} type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear rol"}
        </button>
      </form>
      {!roles && !error ? <p className="text-sm text-zinc-600">Cargando roles…</p> : null}
      <ul className="grid gap-3">
        {roles?.map((role) => (
          <li key={role.id} className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">{role.name}</h3>
              {INITIAL_IDS.has(role.id) ? null : (
                <button className={secondaryClass} type="button" onClick={() => remove(role)}>
                  Eliminar
                </button>
              )}
            </div>
            <fieldset className="mt-3 grid gap-2 sm:grid-cols-2">
              {PERMISSIONS.map((permission) => (
                <label key={permission.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={role.permissions.includes(permission.id)}
                    onChange={(event) => save(role, toggle(permission.id, event.target.checked, role.permissions))}
                  />
                  {permission.label}
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ul>
    </section>
  );
}
