"use client";

import { getFirebaseAuth } from "@/lib/firebase";

export class PanelError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function authorizedHeaders(extra?: HeadersInit) {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new PanelError("La sesión expiró. Vuelve a entrar.", 401);
  }

  const headers = new Headers(extra);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  return headers;
}

export async function panelFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authorizedHeaders(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...init, headers });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "No se pudo completar la acción.";
    throw new PanelError(message, response.status);
  }

  return payload as T;
}

export async function downloadCsv(tipo: "clientes" | "riesgo" | "cumpleanos") {
  const headers = await authorizedHeaders();
  const response = await fetch(`/api/panel/export?tipo=${tipo}`, { headers });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "No se pudo exportar el reporte.";
    throw new PanelError(message, response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${tipo}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function panelErrorMessage(error: unknown) {
  if (error instanceof PanelError) {
    return error.message;
  }

  return "No se pudo completar la acción.";
}

export function isUnauthorized(error: unknown) {
  return error instanceof PanelError && error.status === 401;
}
