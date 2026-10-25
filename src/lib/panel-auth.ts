import "server-only";

import { connection } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { INITIAL_ROLES, PERMISSIONS, type PermissionId } from "@/domain/permissions";
import type { PanelSession } from "@/domain/panel";
import { asRecord, asText } from "@/lib/panel-values";

const PERMISSION_IDS = new Set<string>(PERMISSIONS.map((permission) => permission.id));

export class PanelActionError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function isPermissionId(value: string): value is PermissionId {
  return PERMISSION_IDS.has(value);
}

export function sanitizePermissions(values: unknown): PermissionId[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const selected = new Set<PermissionId>();
  for (const value of values) {
    if (typeof value === "string" && isPermissionId(value)) {
      selected.add(value);
    }
  }

  return PERMISSIONS.map((permission) => permission.id).filter((id) => selected.has(id));
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function initialRole(nameOrId: string) {
  const normalized = nameOrId.trim().toLowerCase();
  return INITIAL_ROLES.find(
    (role) => role.id === normalized || role.name.toLowerCase() === normalized,
  );
}

async function resolveRole(roleId: string, roleName: string) {
  const db = getAdminDb();

  if (roleId) {
    const byId = await db.collection("roles").doc(roleId).get();
    if (byId.exists) {
      const data = asRecord(byId.data());
      const name = asText(data.name) || roleName || roleId;
      return {
        roleId,
        roleName: name,
        permissions: sanitizePermissions(data.permissions),
      };
    }
  }

  if (roleName) {
    const byName = await db.collection("roles").where("name", "==", roleName).limit(1).get();
    const match = byName.docs[0];
    if (match) {
      const data = asRecord(match.data());
      return {
        roleId: match.id,
        roleName: asText(data.name) || roleName,
        permissions: sanitizePermissions(data.permissions),
      };
    }
  }

  const fallback = initialRole(roleName) ?? (roleId ? initialRole(roleId) : undefined);
  if (fallback) {
    return {
      roleId: fallback.id,
      roleName: fallback.name,
      permissions: [...fallback.permissions],
    };
  }

  return {
    roleId: roleId || "sin-rol",
    roleName: roleName || "Sin rol",
    permissions: [] as PermissionId[],
  };
}

export async function requireStaff(request: Request, permission?: PermissionId) {
  await connection();

  const token = bearerToken(request);
  if (!token) {
    return { response: Response.json({ error: "No autorizado" }, { status: 401 }) };
  }

  let uid = "";
  let tokenEmail = "";

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    uid = decoded.uid;
    tokenEmail = decoded.email ?? "";
  } catch {
    return { response: Response.json({ error: "No autorizado" }, { status: 401 }) };
  }

  const staffSnap = await getAdminDb().collection("staffUsers").doc(uid).get();
  if (!staffSnap.exists) {
    return { response: Response.json({ error: "Esta cuenta no es del equipo interno." }, { status: 403 }) };
  }

  const data = asRecord(staffSnap.data());
  if (data.active === false) {
    return { response: Response.json({ error: "Esta cuenta está desactivada." }, { status: 403 }) };
  }

  const roleName = asText(data.roleName);
  const roleId = asText(data.roleId);
  const role = await resolveRole(roleId, roleName);

  if (!roleId && role.roleId !== "sin-rol") {
    await staffSnap.ref.set({ roleId: role.roleId, roleName: role.roleName }, { merge: true });
  }

  if (permission && !role.permissions.includes(permission)) {
    return { response: Response.json({ error: "No tienes permiso para esta acción." }, { status: 403 }) };
  }

  const staff: PanelSession & { uid: string } = {
    uid,
    email: asText(data.email) || tokenEmail,
    displayName: asText(data.displayName),
    roleId: role.roleId,
    roleName: role.roleName,
    permissions: role.permissions,
  };

  return { staff };
}
