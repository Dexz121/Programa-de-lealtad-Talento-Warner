import "server-only";

import { mexicoDate } from "@/domain/cutoff";
import { isLevel, type Level, type PortalStatus } from "@/domain/panel";

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export function asText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

export function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }

  return null;
}

export function asInteger(value: unknown) {
  const number = asNumber(value);
  if (number == null || !Number.isInteger(number)) {
    return null;
  }

  return number;
}

export function asDob(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, 10);
}

export function asMexicoDate(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return mexicoDate(parsed);
    }

    return trimmed.slice(0, 10);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return mexicoDate(value);
  }

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate();
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return mexicoDate(date);
    }
  }

  return "";
}

export function asLevel(value: unknown): Level | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim().toLowerCase();
  if (text === "bronce" || text === "plata" || text === "oro") {
    const level = text.charAt(0).toUpperCase() + text.slice(1);
    return isLevel(level) ? level : null;
  }

  return null;
}

export function asPortal(value: unknown): PortalStatus {
  if (value === "temporal" || value === "activo" || value === "sin acceso") {
    return value;
  }

  return "sin acceso";
}

export function ownerId(data: Record<string, unknown>) {
  const direct = data.customerId ?? data.clienteId ?? data.cliente_id ?? data.userId;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  if (typeof direct === "number" && Number.isFinite(direct)) {
    return String(direct);
  }

  const user = data.user;
  if (user && typeof user === "object" && "id" in user) {
    const id = user.id;
    if (typeof id === "string" && id.trim()) {
      return id.trim();
    }

    if (typeof id === "number" && Number.isFinite(id)) {
      return String(id);
    }
  }

  return "";
}

export function sameId(left: string, right: string) {
  return left === right || (left !== "" && right !== "" && Number(left) === Number(right) && /^\d+$/.test(left) && /^\d+$/.test(right));
}
