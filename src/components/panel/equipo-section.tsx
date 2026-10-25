"use client";

import { FormEvent, useEffect, useState } from "react";
import type { StaffItem } from "@/domain/panel";
import { usePanelContext } from "@/components/panel/panel-context";
import { EmptyState, Notice, fieldClass, primaryClass, secondaryClass } from "@/components/panel/panel-ui";
import { isUnauthorized, panelErrorMessage, panelFetch } from "@/components/panel/use-panel-api";

type RoleOption = { id: string; name: string };

export function EquipoSection() {
  const { staff, onUnauthorized } = usePanelContext();
  const [people, setPeople] = useState<StaffItem[] | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
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
    const data = await panelFetch<{ usuarios: StaffItem[]; roles: RoleOption[] }>("/api/panel/usuarios");
    setPeople(data.usuarios);
    setRoles(data.roles);
    setRoleId((current) => current || data.roles[0]?.id || "");
  }

  useEffect(() => {
    let active = true;
    panelFetch<{ usuarios: StaffItem[]; roles: RoleOption[] }>("/api/panel/usuarios")
      .then((data) => {
        if (!active) {
          return;
        }
        setPeople(data.usuarios);
        setRoles(data.roles);
        setRoleId(data.roles[0]?.id ?? "");
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

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      await panelFetch("/api/panel/usuarios", {
        method: "POST",
        body: JSON.stringify({ email, displayName, password, roleId, active: true }),
      });
      setEmail("");
      setDisplayName("");
      setPassword("");
      setMessage("Cuenta creada.");
      await load();
    } catch (caught) {
      fail(caught);
    } finally {
      setPending(false);
    }
  }

  async function save(person: StaffItem, patch: { roleId?: string; active?: boolean; password?: string }) {
    setError(null);
    setMessage(null);
    try {
      await panelFetch(`/api/panel/usuarios/${person.uid}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setMessage("Cuenta actualizada.");
      await load();
    } catch (caught) {
      fail(caught);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Equipo</h2>
        <p className="mt-1 text-sm text-zinc-600">Cuentas internas. No se puede desactivar al último administrador.</p>
      </header>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}
      <form className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-2" onSubmit={create}>
        <label className="text-sm font-medium">
          Nombre
          <input className={`${fieldClass} mt-1`} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label className="text-sm font-medium">
          Correo
          <input className={`${fieldClass} mt-1`} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="text-sm font-medium">
          Contraseña
          <input className={`${fieldClass} mt-1`} type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
        </label>
        <label className="text-sm font-medium">
          Rol
          <select className={`${fieldClass} mt-1`} value={roleId} onChange={(event) => setRoleId(event.target.value)} required>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <button className={`${primaryClass} md:col-span-2 w-fit`} type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear cuenta"}
        </button>
      </form>
      {!people && !error ? <p className="text-sm text-zinc-600">Cargando equipo…</p> : null}
      {people && people.length === 0 ? <EmptyState>No hay cuentas de equipo.</EmptyState> : null}
      <ul className="grid gap-3">
        {people?.map((person) => (
          <li key={person.uid} className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="font-medium">{person.displayName || person.email}</p>
            <p className="text-sm text-zinc-600">{person.email}</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-sm font-medium">
                Rol
                <select
                  className={`${fieldClass} mt-1`}
                  value={person.roleId}
                  onChange={(event) => save(person, { roleId: event.target.value })}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={secondaryClass}
                type="button"
                disabled={person.email === staff.email && person.active}
                onClick={() => save(person, { active: !person.active })}
              >
                {person.active ? "Desactivar" : "Activar"}
              </button>
              <span className="text-sm text-zinc-500">{person.active ? "Activa" : "Desactivada"}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
