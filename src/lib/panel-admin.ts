import "server-only";

import { createHash, randomBytes, randomInt } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { put } from "@vercel/blob";
import { mexicoDate } from "@/domain/cutoff";
import type { RedemptionItem, RewardItem, RoleItem, StaffItem, TokenItem } from "@/domain/panel";
import { rewardClaimId } from "@/domain/redemption";
import { isLevel } from "@/domain/panel";
import { INITIAL_ROLES, type PermissionId } from "@/domain/permissions";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { PanelActionError, isPermissionId, sanitizePermissions } from "@/lib/panel-auth";
import { asInteger, asMexicoDate, asNumber, asRecord, asText } from "@/lib/panel-values";
import { invalidateReads } from "@/lib/read-cache";

const INITIAL_ROLE_IDS = new Set<string>(INITIAL_ROLES.map((role) => role.id));

type RewardDraft = Omit<RewardItem, "id" | "fotoUrl">;

function authCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return String(error.code);
  }

  return "";
}

function rewardFromDoc(id: string, value: unknown): RewardItem {
  const data = asRecord(value);
  const tipo = data.tipo === "descuento" ? "descuento" : "producto";
  const nivel = asText(data.nivelMinimo);
  const descuentoTipo = data.descuentoTipo === "porcentaje" || data.descuentoTipo === "monto" ? data.descuentoTipo : null;

  return {
    id,
    tipo,
    nombre: asText(data.nombre) || "Sin nombre",
    descripcion: asText(data.descripcion),
    puntosRequeridos: asInteger(data.puntosRequeridos) ?? 0,
    stock: data.stock == null ? null : asInteger(data.stock),
    nivelMinimo: isLevel(nivel) ? nivel : "Bronce",
    limitePorCliente: asInteger(data.limitePorCliente),
    activo: data.activo !== false,
    fotoUrl: asText(data.fotoUrl) || null,
    descuentoTipo: tipo === "descuento" ? descuentoTipo : null,
    descuentoValor: tipo === "descuento" ? asNumber(data.descuentoValor) : null,
    compraMinima: tipo === "descuento" ? asNumber(data.compraMinima) : null,
    vigenciaDias: tipo === "descuento" ? asInteger(data.vigenciaDias) : null,
  };
}

function rewardTipoOf(data: Record<string, unknown>): "producto" | "descuento" {
  if (data.rewardTipo === "descuento" || data.tipo === "descuento") {
    return "descuento";
  }

  const estado = asText(data.estado);
  if (estado === "vigente" || estado === "usado" || estado === "vencido") {
    return "descuento";
  }

  return "producto";
}

export function parseReward(input: unknown): RewardDraft {
  const body = asRecord(input);
  if (body.tipo !== "producto" && body.tipo !== "descuento") {
    throw new PanelActionError("Elige si la recompensa es producto o descuento.", 400);
  }

  const nombre = asText(body.nombre);
  if (!nombre || nombre.length > 120) {
    throw new PanelActionError("El nombre es obligatorio y debe tener hasta 120 caracteres.", 400);
  }

  const descripcion = asText(body.descripcion);
  if (descripcion.length > 2000) {
    throw new PanelActionError("La descripción es demasiado larga.", 400);
  }

  const puntosRequeridos = asInteger(body.puntosRequeridos);
  if (puntosRequeridos == null || puntosRequeridos < 0) {
    throw new PanelActionError("Los puntos requeridos deben ser un entero de 0 o más.", 400);
  }

  const nivelMinimo = asText(body.nivelMinimo);
  if (!isLevel(nivelMinimo)) {
    throw new PanelActionError("El nivel mínimo debe ser Bronce, Plata u Oro.", 400);
  }

  let limitePorCliente: number | null = null;
  if (body.limitePorCliente !== null && body.limitePorCliente !== "" && body.limitePorCliente !== undefined) {
    limitePorCliente = asInteger(body.limitePorCliente);
    if (limitePorCliente == null || limitePorCliente < 1) {
      throw new PanelActionError("El límite por cliente debe ser un entero mayor a 0, o quedar vacío.", 400);
    }
  }

  const draft: RewardDraft = {
    tipo: body.tipo,
    nombre,
    descripcion,
    puntosRequeridos,
    stock: null,
    nivelMinimo,
    limitePorCliente,
    activo: body.activo !== false,
    descuentoTipo: null,
    descuentoValor: null,
    compraMinima: null,
    vigenciaDias: null,
  };

  if (body.tipo === "producto") {
    const stock = asInteger(body.stock);
    if (stock == null || stock < 0) {
      throw new PanelActionError("El stock de un producto debe ser un entero de 0 o más.", 400);
    }

    draft.stock = stock;
    return draft;
  }

  if (body.stock !== null && body.stock !== "" && body.stock !== undefined) {
    const stock = asInteger(body.stock);
    if (stock == null || stock < 0) {
      throw new PanelActionError("El stock del descuento debe ser un entero de 0 o más, o vacío si es ilimitado.", 400);
    }

    draft.stock = stock;
  }

  if (body.descuentoTipo !== "porcentaje" && body.descuentoTipo !== "monto") {
    throw new PanelActionError("El descuento debe ser porcentaje o monto fijo.", 400);
  }

  const descuentoValor = asNumber(body.descuentoValor);
  if (descuentoValor == null || descuentoValor <= 0) {
    throw new PanelActionError("El valor del descuento debe ser mayor a 0.", 400);
  }

  if (body.descuentoTipo === "porcentaje" && descuentoValor > 100) {
    throw new PanelActionError("El porcentaje no puede ser mayor a 100.", 400);
  }

  let compraMinima: number | null = null;
  if (body.compraMinima !== null && body.compraMinima !== "" && body.compraMinima !== undefined) {
    compraMinima = asNumber(body.compraMinima);
    if (compraMinima == null || compraMinima < 0) {
      throw new PanelActionError("La compra mínima debe ser 0 o más.", 400);
    }
  }

  const vigenciaDias = asInteger(body.vigenciaDias);
  if (vigenciaDias == null || vigenciaDias < 1) {
    throw new PanelActionError("La vigencia debe ser un número entero de días, de 1 o más.", 400);
  }

  draft.descuentoTipo = body.descuentoTipo;
  draft.descuentoValor = descuentoValor;
  draft.compraMinima = compraMinima;
  draft.vigenciaDias = vigenciaDias;
  return draft;
}

function rewardPayload(draft: RewardDraft) {
  return {
    tipo: draft.tipo,
    nombre: draft.nombre,
    descripcion: draft.descripcion,
    puntosRequeridos: draft.puntosRequeridos,
    stock: draft.stock,
    nivelMinimo: draft.nivelMinimo,
    limitePorCliente: draft.limitePorCliente,
    activo: draft.activo,
    descuentoTipo: draft.descuentoTipo,
    descuentoValor: draft.descuentoValor,
    compraMinima: draft.compraMinima,
    vigenciaDias: draft.vigenciaDias,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export async function listRewards() {
  const snap = await getAdminDb().collection("rewards").get();
  return snap.docs
    .map((doc) => rewardFromDoc(doc.id, doc.data()))
    .sort((left, right) => left.nombre.localeCompare(right.nombre, "es"));
}

export async function createReward(input: unknown) {
  const draft = parseReward(input);
  const ref = getAdminDb().collection("rewards").doc();
  await ref.set({
    ...rewardPayload(draft),
    fotoUrl: null,
    createdAt: FieldValue.serverTimestamp(),
  });
  invalidateReads("portal:catalogo");
  return rewardFromDoc(ref.id, { ...draft, fotoUrl: null });
}

export async function updateReward(id: string, input: unknown) {
  const ref = getAdminDb().collection("rewards").doc(id);
  const current = await ref.get();
  if (!current.exists) {
    throw new PanelActionError("Esa recompensa no existe.", 404);
  }

  const draft = parseReward(input);
  await ref.set(rewardPayload(draft), { merge: true });
  invalidateReads("portal:catalogo");
  return rewardFromDoc(id, { ...asRecord(current.data()), ...draft });
}

export async function uploadRewardPhoto(id: string, file: File) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new PanelActionError("Falta configurar el almacenamiento de fotos.", 500);
  }

  const allowed = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
  ]);
  const extension = allowed.get(file.type);
  if (!extension) {
    throw new PanelActionError("La foto debe ser JPG, PNG o WebP.", 400);
  }

  if (file.size <= 0 || file.size > 2 * 1024 * 1024) {
    throw new PanelActionError("La foto debe pesar entre 1 byte y 2 MB.", 400);
  }

  const ref = getAdminDb().collection("rewards").doc(id);
  const current = await ref.get();
  if (!current.exists) {
    throw new PanelActionError("Esa recompensa no existe.", 404);
  }

  const blob = await put(`recompensas/${id}-${randomBytes(6).toString("hex")}.${extension}`, Buffer.from(await file.arrayBuffer()), {
    access: "public",
    contentType: file.type,
  });
  await ref.set({ fotoUrl: blob.url, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  invalidateReads("portal:catalogo");
  return { fotoUrl: blob.url };
}

export async function listRedemptions() {
  const db = getAdminDb();
  const [redemptions, rewards] = await Promise.all([
    db.collection("redemptions").get(),
    db.collection("rewards").get(),
  ]);
  const customerIds = [
    ...new Set(
      redemptions.docs
        .map((doc) => {
          const data = asRecord(doc.data());
          return asText(data.customerId) || asText(data.clienteId) || asText(data.cliente_id);
        })
        .filter(Boolean),
    ),
  ];
  const names = new Map<string, string>();
  for (let index = 0; index < customerIds.length; index += 50) {
    const chunk = customerIds.slice(index, index + 50);
    const customers = await db.getAll(...chunk.map((id) => db.collection("customers").doc(id)));
    for (const doc of customers) {
      if (!doc.exists) {
        continue;
      }
      const data = asRecord(doc.data());
      const nombre = asText(data.name) || asText(data.nombre) || doc.id;
      names.set(doc.id, nombre);
      const sourceId = asText(data.cliente_id) || asText(data.id);
      if (sourceId) {
        names.set(sourceId, nombre);
      }
    }
  }

  const rewardNames = new Map(rewards.docs.map((doc) => [doc.id, asText(asRecord(doc.data()).nombre) || doc.id]));
  const rows: RedemptionItem[] = redemptions.docs.map((doc) => {
    const data = asRecord(doc.data());
    const customerId = asText(data.customerId) || asText(data.clienteId) || asText(data.cliente_id);
    const rewardId = asText(data.rewardId);

    return {
      id: doc.id,
      customerId,
      cliente: asText(data.cliente) || names.get(customerId) || customerId || "Cliente",
      rewardId,
      recompensa: asText(data.rewardNombre) || asText(data.recompensa) || rewardNames.get(rewardId) || "Recompensa",
      rewardTipo: rewardTipoOf(data),
      puntos: asInteger(data.puntos) ?? 0,
      estado: asText(data.estado) || "pendiente",
      couponCode: asText(data.couponCode) || null,
      vence: asMexicoDate(data.vence) || null,
      fecha: asMexicoDate(data.fecha ?? data.createdAt),
    };
  });

  return rows.sort((left, right) => right.fecha.localeCompare(left.fecha) || right.id.localeCompare(left.id));
}

export async function applyRedemptionAction(id: string, accion: unknown) {
  if (accion !== "entregar" && accion !== "aplicar" && accion !== "cancelar") {
    throw new PanelActionError("La acción del canje no es válida.", 400);
  }

  const db = getAdminDb();
  const redemptionRef = db.collection("redemptions").doc(id);
  let affectedCustomerId = "";

  await db.runTransaction(async (transaction) => {
    const redemptionSnap = await transaction.get(redemptionRef);
    if (!redemptionSnap.exists) {
      throw new PanelActionError("Ese canje no existe.", 404);
    }

    const redemption = asRecord(redemptionSnap.data());
    const estado = asText(redemption.estado);
    const rewardTipo = rewardTipoOf(redemption);
    const customerId = asText(redemption.customerId) || asText(redemption.clienteId) || asText(redemption.cliente_id);
    const rewardId = asText(redemption.rewardId);
    const couponId = asText(redemption.couponId);
    const rewardRef = rewardId ? db.collection("rewards").doc(rewardId) : null;
    const snapshotRef = customerId ? db.collection("loyaltySnapshots").doc(customerId) : null;
    const couponRef = couponId ? db.collection("coupons").doc(couponId) : null;
    const claimRef =
      accion === "cancelar" && customerId && rewardId
        ? db.collection("rewardClaims").doc(rewardClaimId(customerId, rewardId))
        : null;
    const rewardSnap = rewardRef ? await transaction.get(rewardRef) : null;
    const snapshotSnap = snapshotRef ? await transaction.get(snapshotRef) : null;
    const couponSnap = couponRef ? await transaction.get(couponRef) : null;
    const claimSnap = claimRef ? await transaction.get(claimRef) : null;
    affectedCustomerId = customerId;

    if (accion === "entregar") {
      if (rewardTipo !== "producto" || estado !== "pendiente") {
        throw new PanelActionError("Solo se puede marcar como entregado un producto pendiente.", 409);
      }

      transaction.update(redemptionRef, { estado: "entregado", updatedAt: FieldValue.serverTimestamp() });
      return;
    }

    if (accion === "aplicar") {
      if (rewardTipo !== "descuento" || estado !== "vigente") {
        throw new PanelActionError("Solo se puede aplicar un cupón vigente.", 409);
      }

      transaction.update(redemptionRef, { estado: "usado", updatedAt: FieldValue.serverTimestamp() });
      if (couponSnap?.exists && couponRef) {
        transaction.update(couponRef, { estado: "usado" });
      }
      return;
    }

    if (estado === "cancelado" || estado === "usado" || estado === "vencido") {
      throw new PanelActionError("Este canje ya no se puede cancelar.", 409);
    }

    if (rewardSnap?.exists && rewardRef) {
      const stock = asRecord(rewardSnap.data()).stock;
      if (typeof stock === "number") {
        transaction.update(rewardRef, { stock: stock + 1, updatedAt: FieldValue.serverTimestamp() });
      }
    }

    if (claimSnap?.exists && claimRef) {
      const count = asInteger(asRecord(claimSnap.data()).count) ?? 0;
      if (count > 0) {
        transaction.update(claimRef, { count: count - 1 });
      }
    }

    const puntos = asInteger(redemption.puntos) ?? 0;
    if (snapshotSnap?.exists && snapshotRef) {
      const available = asInteger(asRecord(snapshotSnap.data()).puntosDisponibles) ?? 0;
      transaction.update(snapshotRef, { puntosDisponibles: available + puntos });
    }

    if (customerId) {
      transaction.set(db.collection("pointMovements").doc(), {
        customerId,
        fecha: mexicoDate(),
        tipo: "devolucion",
        referencia: `canje:${id}`,
        puntos,
        source: "panel",
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    transaction.update(redemptionRef, { estado: "cancelado", updatedAt: FieldValue.serverTimestamp() });
    if (couponSnap?.exists && couponRef) {
      transaction.update(couponRef, { estado: "cancelado" });
    }
  });

  invalidateReads("loyalty:");
  if (affectedCustomerId) {
    invalidateReads(`portal:canjes:${affectedCustomerId}:`);
  }
  if (accion === "cancelar" && affectedCustomerId) {
    invalidateReads(`portal:mov:${affectedCustomerId}:`);
    invalidateReads("portal:catalogo");
    invalidateReads("portal:session:");
  }
}

function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]).join("");
}

export async function grantPortalAccess(customerId: string) {
  const db = getAdminDb();
  const ref = db.collection("customers").doc(customerId);
  let snap = await ref.get();

  if (!snap.exists) {
    const lookups = [db.collection("customers").where("cliente_id", "==", customerId).limit(1).get()];
    if (/^\d+$/.test(customerId)) {
      lookups.push(db.collection("customers").where("cliente_id", "==", Number(customerId)).limit(1).get());
    }
    const found = (await Promise.all(lookups)).flatMap((item) => item.docs)[0];
    if (!found) {
      throw new PanelActionError("Ese cliente no existe.", 404);
    }
    snap = found;
  }

  const data = asRecord(snap.data());
  const email = (asText(data.email) || asText(data.correo)).toLowerCase();
  if (!email || !email.includes("@")) {
    throw new PanelActionError("Este cliente no tiene un correo válido para el portal.", 409);
  }

  const nombre = asText(data.name) || asText(data.nombre);
  const staffSnap = await db.collection("staffUsers").where("email", "==", email).limit(1).get();
  if (!staffSnap.empty) {
    throw new PanelActionError("Ese correo pertenece al equipo interno.", 409);
  }

  const password = temporaryPassword();
  const auth = getAdminAuth();
  let uid = "";

  try {
    const existing = await auth.getUserByEmail(email);
    const staffDoc = await db.collection("staffUsers").doc(existing.uid).get();
    if (staffDoc.exists) {
      throw new PanelActionError("Ese correo pertenece al equipo interno.", 409);
    }

    await auth.updateUser(existing.uid, { password, disabled: false, displayName: nombre || undefined });
    uid = existing.uid;
  } catch (error) {
    if (error instanceof PanelActionError) {
      throw error;
    }

    if (authCode(error) !== "auth/user-not-found") {
      throw new PanelActionError("No se pudo generar el acceso del portal.", 500);
    }

    const created = await auth.createUser({ email, password, displayName: nombre || undefined });
    uid = created.uid;
  }

  const userRecord = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, {
    ...(userRecord.customClaims ?? {}),
    customerId: snap.id,
  });

  await snap.ref.set(
    {
      authUid: uid,
      portalStatus: "temporal",
      mustChangePassword: true,
    },
    { merge: true },
  );
  invalidateReads("loyalty:");
  invalidateReads(`portal:session:${uid}:`);

  return { password, portal: "temporal" as const };
}

async function roleDocs(): Promise<RoleItem[]> {
  const db = getAdminDb();
  const existing = await db.collection("roles").get();
  if (existing.empty) {
    const batch = db.batch();
    for (const role of INITIAL_ROLES) {
      batch.set(db.collection("roles").doc(role.id), {
        name: role.name,
        permissions: [...role.permissions],
      });
    }
    await batch.commit();
  }

  const snap = existing.empty ? await db.collection("roles").get() : existing;
  return snap.docs
    .map((doc) => ({
      id: doc.id,
      name: asText(asRecord(doc.data()).name) || doc.id,
      permissions: sanitizePermissions(asRecord(doc.data()).permissions),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
}

function staffFromDoc(id: string, value: unknown, roles: RoleItem[]): StaffItem {
  const data = asRecord(value);
  const roleId = asText(data.roleId);
  const roleName = asText(data.roleName);
  const role = roles.find((item) => item.id === roleId) ?? roles.find((item) => item.name === roleName);

  return {
    uid: id,
    email: asText(data.email),
    displayName: asText(data.displayName),
    roleId: role?.id || roleId,
    roleName: role?.name || roleName || "Sin rol",
    active: data.active !== false,
  };
}

function permissionsOf(staff: StaffItem, roles: RoleItem[]): PermissionId[] {
  const role = roles.find((item) => item.id === staff.roleId) ?? roles.find((item) => item.name === staff.roleName);
  return role?.permissions ?? [];
}

function assertStillHasAdmin(staff: StaffItem[], roles: RoleItem[]) {
  const admins = staff.filter((person) => person.active && permissionsOf(person, roles).includes("gestionar_usuarios"));
  if (admins.length === 0) {
    throw new PanelActionError("Tiene que quedar al menos un administrador activo.", 409);
  }
}

async function loadStaff(roles: RoleItem[]) {
  const snap = await getAdminDb().collection("staffUsers").get();
  return snap.docs
    .map((doc) => staffFromDoc(doc.id, doc.data(), roles))
    .sort((left, right) => left.email.localeCompare(right.email, "es"));
}

export async function listStaff() {
  const roles = await roleDocs();
  const usuarios = await loadStaff(roles);
  return {
    usuarios,
    roles: roles.map((role) => ({ id: role.id, name: role.name })),
  };
}

function cleanPerson(input: unknown, requirePassword: boolean) {
  const body = asRecord(input);
  const email = asText(body.email).toLowerCase();
  const displayName = asText(body.displayName);
  const roleId = asText(body.roleId);
  const password = asText(body.password);

  if (requirePassword) {
    if (!email || !email.includes("@") || email.length > 160) {
      throw new PanelActionError("Escribe un correo válido.", 400);
    }
  }

  if (displayName.length > 80) {
    throw new PanelActionError("El nombre debe tener hasta 80 caracteres.", 400);
  }

  if ((requirePassword || password) && password.length < 8) {
    throw new PanelActionError("La contraseña debe tener al menos 8 caracteres.", 400);
  }

  if (password.length > 80) {
    throw new PanelActionError("La contraseña es demasiado larga.", 400);
  }

  return { email, displayName, roleId, password, active: body.active !== false };
}

export async function createStaffUser(input: unknown) {
  const draft = cleanPerson(input, true);
  const roles = await roleDocs();
  const role = roles.find((item) => item.id === draft.roleId);
  if (!role) {
    throw new PanelActionError("Elige un rol existente.", 400);
  }

  const auth = getAdminAuth();
  let uid = "";
  try {
    const created = await auth.createUser({
      email: draft.email,
      password: draft.password,
      displayName: draft.displayName || undefined,
      disabled: !draft.active,
    });
    uid = created.uid;
  } catch (error) {
    if (authCode(error) === "auth/email-already-exists") {
      throw new PanelActionError("Ya existe una cuenta con ese correo.", 409);
    }

    throw new PanelActionError("No se pudo crear la cuenta.", 500);
  }

  try {
    await getAdminDb().collection("staffUsers").doc(uid).set({
      email: draft.email,
      displayName: draft.displayName,
      roleId: role.id,
      roleName: role.name,
      active: draft.active,
    });
    invalidateReads("staff:");
  } catch (error) {
    await auth.deleteUser(uid).catch(() => undefined);
    throw error;
  }

  return staffFromDoc(uid, {
    email: draft.email,
    displayName: draft.displayName,
    roleId: role.id,
    roleName: role.name,
    active: draft.active,
  }, roles);
}

export async function updateStaffUser(actorUid: string, id: string, input: unknown) {
  const body = asRecord(input);
  const roles = await roleDocs();
  const staff = await loadStaff(roles);
  const current = staff.find((person) => person.uid === id);
  if (!current) {
    throw new PanelActionError("Esa persona no está en el equipo.", 404);
  }

  const nextRoleId = asText(body.roleId) || current.roleId;
  const role = roles.find((item) => item.id === nextRoleId);
  if (!role) {
    throw new PanelActionError("Elige un rol existente.", 400);
  }

  const displayName = body.displayName === undefined ? current.displayName : asText(body.displayName);
  if (displayName.length > 80) {
    throw new PanelActionError("El nombre debe tener hasta 80 caracteres.", 400);
  }

  const password = asText(body.password);
  if (password && (password.length < 8 || password.length > 80)) {
    throw new PanelActionError("La contraseña debe tener entre 8 y 80 caracteres.", 400);
  }

  const active = typeof body.active === "boolean" ? body.active : current.active;
  if (id === actorUid && !active) {
    throw new PanelActionError("No puedes desactivar tu propia cuenta.", 409);
  }

  const nextStaff = staff.map((person) =>
    person.uid === id ? { ...person, roleId: role.id, roleName: role.name, active, displayName } : person,
  );
  assertStillHasAdmin(nextStaff, roles);

  await getAdminAuth().updateUser(id, {
    displayName: displayName || undefined,
    disabled: !active,
    ...(password ? { password } : {}),
  });
  await getAdminDb().collection("staffUsers").doc(id).set(
    {
      displayName,
      roleId: role.id,
      roleName: role.name,
      active,
    },
    { merge: true },
  );
  invalidateReads("staff:");

  return nextStaff.find((person) => person.uid === id) ?? current;
}

export async function listRoles() {
  return roleDocs();
}

function parseRole(input: unknown) {
  const body = asRecord(input);
  const name = asText(body.name);
  if (!name || name.length > 60) {
    throw new PanelActionError("El nombre del rol es obligatorio y debe tener hasta 60 caracteres.", 400);
  }

  if (!Array.isArray(body.permissions) || body.permissions.some((permission) => typeof permission !== "string" || !isPermissionId(permission))) {
    throw new PanelActionError("Hay permisos que no existen.", 400);
  }

  const permissions = sanitizePermissions(body.permissions);
  if (permissions.length === 0) {
    throw new PanelActionError("El rol necesita al menos un permiso de la lista.", 400);
  }

  return { name, permissions };
}

export async function createRole(input: unknown) {
  const draft = parseRole(input);
  const roles = await roleDocs();
  if (roles.some((role) => role.name.toLowerCase() === draft.name.toLowerCase())) {
    throw new PanelActionError("Ya hay un rol con ese nombre.", 409);
  }

  const ref = getAdminDb().collection("roles").doc();
  await ref.set({ name: draft.name, permissions: draft.permissions });
  return { id: ref.id, ...draft };
}

export async function updateRole(id: string, input: unknown) {
  const draft = parseRole(input);
  const roles = await roleDocs();
  const current = roles.find((role) => role.id === id);
  if (!current) {
    throw new PanelActionError("Ese rol no existe.", 404);
  }

  if (roles.some((role) => role.id !== id && role.name.toLowerCase() === draft.name.toLowerCase())) {
    throw new PanelActionError("Ya hay un rol con ese nombre.", 409);
  }

  const nextRoles = roles.map((role) => (role.id === id ? { ...role, name: draft.name, permissions: draft.permissions } : role));
  const staff = await loadStaff(roles);
  const rebound = staff.map((person) => (person.roleId === id || person.roleName === current.name ? { ...person, roleId: id, roleName: draft.name } : person));
  assertStillHasAdmin(rebound, nextRoles);

  const db = getAdminDb();
  await db.collection("roles").doc(id).set({ name: draft.name, permissions: draft.permissions });
  const batch = db.batch();
  let updates = 0;
  for (const person of staff) {
    if (person.roleId === id || person.roleName === current.name) {
      batch.set(db.collection("staffUsers").doc(person.uid), { roleId: id, roleName: draft.name }, { merge: true });
      updates += 1;
    }
  }
  if (updates > 0) {
    await batch.commit();
  }
  invalidateReads("staff:");
  return { id, ...draft };
}

export async function deleteRole(id: string) {
  if (INITIAL_ROLE_IDS.has(id)) {
    throw new PanelActionError("Los roles iniciales no se eliminan. Puedes editar sus permisos.", 409);
  }

  const roles = await roleDocs();
  const current = roles.find((role) => role.id === id);
  if (!current) {
    throw new PanelActionError("Ese rol no existe.", 404);
  }

  const staff = await loadStaff(roles);
  if (staff.some((person) => person.roleId === id || person.roleName === current.name)) {
    throw new PanelActionError("Hay personas con este rol. Asígneles otro antes de eliminarlo.", 409);
  }

  await getAdminDb().collection("roles").doc(id).delete();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function listTokens() {
  const snap = await getAdminDb().collection("apiTokens").get();
  const tokens: TokenItem[] = snap.docs.map((doc) => {
    const data = asRecord(doc.data());
    return {
      id: doc.id,
      name: asText(data.name) || "Token",
      prefix: asText(data.prefix),
      createdAt: asMexicoDate(data.createdAt),
      revoked: data.revoked === true,
    };
  });

  return tokens.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createToken(nameInput: unknown, createdBy: string) {
  const name = asText(nameInput);
  if (!name || name.length > 60) {
    throw new PanelActionError("El token necesita un nombre de hasta 60 caracteres.", 400);
  }

  const secret = `leal_${randomBytes(24).toString("base64url")}`;
  const ref = getAdminDb().collection("apiTokens").doc();
  await ref.set({
    name,
    prefix: secret.slice(0, 12),
    hash: hashToken(secret),
    createdBy,
    revoked: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  return {
    id: ref.id,
    name,
    prefix: secret.slice(0, 12),
    token: secret,
    createdAt: mexicoDate(),
    revoked: false,
  };
}

export async function revokeToken(id: string) {
  const ref = getAdminDb().collection("apiTokens").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new PanelActionError("Ese token no existe.", 404);
  }

  await ref.set({ revoked: true }, { merge: true });
}

export async function listSyncRuns() {
  const snap = await getAdminDb().collection("syncRuns").get();
  return snap.docs
    .map((doc) => {
      const data = asRecord(doc.data());
      return {
        id: doc.id,
        inicio: asMexicoDate(data.inicio ?? data.startedAt),
        fin: asMexicoDate(data.fin ?? data.finishedAt),
        requests: asInteger(data.requests ?? data.solicitudes) ?? 0,
        resultado: asText(data.resultado ?? data.result ?? data.mensaje) || "Sin detalle",
      };
    })
    .sort((left, right) => right.inicio.localeCompare(left.inicio))
    .slice(0, 20);
}
