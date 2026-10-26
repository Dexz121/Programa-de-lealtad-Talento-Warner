import "server-only";

import { birthdayOnCutoff } from "@/domain/cutoff";
import { toCsv } from "@/domain/csv";
import type {
  CustomerListItem,
  Level,
  MovementItem,
  OrderItem,
  PaymentItem,
} from "@/domain/panel";
import type { PermissionId } from "@/domain/permissions";
import { getAdminDb } from "@/lib/firebase-admin";
import { PanelActionError } from "@/lib/panel-auth";
import {
  asDob,
  asLevel,
  asMexicoDate,
  asNumber,
  asPortal,
  asRecord,
  asText,
  ownerId,
  sameId,
} from "@/lib/panel-values";

type SnapshotFields = {
  customerId: string;
  nivel: Level | null;
  puntos: number | null;
  puntosDisponibles: number | null;
  gasto12m: number | null;
  enRiesgo: boolean | null;
  diasSinActividad: number | null;
};

function customerFromDoc(id: string, value: unknown): CustomerListItem {
  const data = asRecord(value);
  const sourceId = asText(data.cliente_id) || asText(data.id) || id;

  return {
    id: sourceId,
    nombre: asText(data.name) || asText(data.nombre) || "Sin nombre",
    email: asText(data.email) || asText(data.correo),
    telefono: asText(data.phone) || asText(data.telefono),
    dob: asDob(data.dob),
    portal: asPortal(data.portalStatus ?? data.portal),
    nivel: null,
    puntos: null,
    puntosDisponibles: null,
    enRiesgo: null,
    diasSinActividad: null,
  };
}

function snapshotFromDoc(id: string, value: unknown): SnapshotFields {
  const data = asRecord(value);
  const riesgo = data.enRiesgo ?? data.en_riesgo;

  return {
    customerId: ownerId(data) || id,
    nivel: asLevel(data.nivel),
    puntos: asNumber(data.puntos),
    puntosDisponibles: asNumber(data.puntosDisponibles ?? data.puntos_disponibles),
    gasto12m: asNumber(data.gasto12m ?? data.gasto_12m),
    enRiesgo: typeof riesgo === "boolean" ? riesgo : null,
    diasSinActividad: asNumber(data.diasSinActividad ?? data.dias_sin_actividad),
  };
}

function applySnapshot(customer: CustomerListItem, snapshot: SnapshotFields | undefined, canSeeAmounts: boolean) {
  if (!snapshot) {
    return customer;
  }

  const next: CustomerListItem = {
    ...customer,
    nivel: snapshot.nivel,
    puntos: snapshot.puntos,
    puntosDisponibles: snapshot.puntosDisponibles,
    enRiesgo: snapshot.enRiesgo,
    diasSinActividad: snapshot.diasSinActividad,
  };

  if (canSeeAmounts && snapshot.gasto12m != null) {
    next.gasto12m = snapshot.gasto12m;
  }

  return next;
}

async function loadCustomers() {
  const snap = await getAdminDb().collection("customers").get();
  return snap.docs.map((doc) => customerFromDoc(doc.id, doc.data()));
}

async function loadSnapshots() {
  const snap = await getAdminDb().collection("loyaltySnapshots").get();
  const byCustomer = new Map<string, SnapshotFields>();

  for (const doc of snap.docs) {
    const snapshot = snapshotFromDoc(doc.id, doc.data());
    byCustomer.set(doc.id, snapshot);
    if (snapshot.customerId) {
      byCustomer.set(snapshot.customerId, snapshot);
    }
  }

  return byCustomer;
}

function snapshotFor(customerId: string, snapshots: Map<string, SnapshotFields>) {
  return snapshots.get(customerId);
}

function withLoyalty(
  customers: CustomerListItem[],
  snapshots: Map<string, SnapshotFields>,
  canSeeAmounts: boolean,
) {
  return customers.map((customer) => applySnapshot(customer, snapshotFor(customer.id, snapshots), canSeeAmounts));
}

export async function buildSummary(permissions: PermissionId[]) {
  const canSeeAmounts = permissions.includes("ver_montos");
  const canSeeRisk = permissions.includes("ver_riesgo_cumpleanos");
  const [customers, snapshots] = await Promise.all([loadCustomers(), loadSnapshots()]);
  const rows = withLoyalty(customers, snapshots, canSeeAmounts);
  const niveles = { Bronce: 0, Plata: 0, Oro: 0, "Sin calcular": 0 };

  for (const row of rows) {
    if (row.nivel) {
      niveles[row.nivel] += 1;
    } else {
      niveles["Sin calcular"] += 1;
    }
  }

  const top = rows
    .filter((row) => row.puntos != null)
    .sort((left, right) => (right.puntos ?? 0) - (left.puntos ?? 0) || left.nombre.localeCompare(right.nombre, "es"))
    .slice(0, 10)
    .map((row) => ({
      id: row.id,
      nombre: row.nombre,
      nivel: row.nivel,
      puntos: row.puntos,
      ...(canSeeAmounts ? { gasto12m: row.gasto12m ?? null } : {}),
    }));

  return {
    totalClientes: rows.length,
    niveles,
    top,
    enRiesgo: canSeeRisk ? rows.filter((row) => row.enRiesgo).length : null,
    cumpleanos: canSeeRisk ? rows.filter((row) => birthdayOnCutoff(row.dob)).length : null,
  };
}

export async function searchCustomers(query: string, permissions: PermissionId[]) {
  const canSeeAmounts = permissions.includes("ver_montos");
  const [customers, snapshots] = await Promise.all([loadCustomers(), loadSnapshots()]);
  const needle = query.trim().toLowerCase();
  const rows = withLoyalty(customers, snapshots, canSeeAmounts)
    .filter((customer) => {
      if (!needle) {
        return true;
      }

      return (
        customer.nombre.toLowerCase().includes(needle) ||
        customer.email.toLowerCase().includes(needle) ||
        customer.id.toLowerCase().includes(needle)
      );
    })
    .sort((left, right) => left.nombre.localeCompare(right.nombre, "es"));

  return {
    total: rows.length,
    clientes: rows.slice(0, 30),
  };
}

async function docsForCustomer(collection: string, customerIds: string[]) {
  const db = getAdminDb();
  const fields = ["customerId", "clienteId", "cliente_id"] as const;
  const values: Array<string | number> = [];

  for (const customerId of new Set(customerIds.filter(Boolean))) {
    values.push(customerId);
    if (/^\d+$/.test(customerId)) {
      values.push(Number(customerId));
    }
  }

  const snaps = await Promise.all(
    fields.flatMap((field) => values.map((value) => db.collection(collection).where(field, "==", value).get())),
  );
  const docs = new Map<string, Record<string, unknown>>();

  for (const snap of snaps) {
    for (const doc of snap.docs) {
      docs.set(doc.id, asRecord(doc.data()));
    }
  }

  return [...docs.entries()];
}

export async function customerDetail(customerId: string, permissions: PermissionId[]) {
  const canSeeAmounts = permissions.includes("ver_montos");
  const db = getAdminDb();
  const direct = await db.collection("customers").doc(customerId).get();
  let customer = direct.exists ? customerFromDoc(direct.id, direct.data()) : null;

  if (!customer) {
    const customers = await loadCustomers();
    customer = customers.find((item) => sameId(item.id, customerId)) ?? null;
  }

  if (!customer) {
    throw new PanelActionError("Ese cliente no existe.", 404);
  }

  const lookupIds = [customer.id, direct.id].filter(Boolean);
  const snapshots = await loadSnapshots();
  const row = applySnapshot(customer, snapshotFor(customer.id, snapshots), canSeeAmounts);
  const movementDocs = await docsForCustomer("pointMovements", lookupIds);
  const movimientos: MovementItem[] = movementDocs
    .map(([, data]) => ({
      fecha: asMexicoDate(data.fecha) || asDob(data.fecha),
      tipo: asText(data.tipo) || "movimiento",
      referencia: asText(data.referencia),
      puntos: asNumber(data.puntos) ?? 0,
    }))
    .sort((left, right) => right.fecha.localeCompare(left.fecha) || right.referencia.localeCompare(left.referencia));

  let pedidos: OrderItem[] | null = null;
  let pagos: PaymentItem[] | null = null;

  if (canSeeAmounts) {
    const orderDocs = await docsForCustomer("orders", lookupIds);
    pedidos = orderDocs
      .map(([id, data]) => ({
        id,
        fecha: asMexicoDate(data.createdAt ?? data.created_at ?? data.fecha),
        estado: asText(data.status ?? data.estado),
        pago: asText(data.paymentStatus ?? data.payment_status ?? data.pago),
        total: asNumber(data.total),
        moneda: asText(data.currency ?? data.moneda),
      }))
      .sort((left, right) => right.fecha.localeCompare(left.fecha));

    const paymentDocs = await docsForCustomer("payments", lookupIds);
    pagos = paymentDocs
      .map(([id, data]) => ({
        id,
        fecha: asMexicoDate(data.paidAt ?? data.paid_at ?? data.createdAt ?? data.created_at ?? data.fecha),
        estado: asText(data.status ?? data.estado),
        monto: asNumber(data.amount ?? data.monto),
        moneda: asText(data.currency ?? data.moneda),
      }))
      .sort((left, right) => right.fecha.localeCompare(left.fecha));
  }

  return {
    cliente: row,
    movimientos,
    pedidos,
    pagos,
  };
}

export async function riskList() {
  const [customers, snapshots] = await Promise.all([loadCustomers(), loadSnapshots()]);
  return withLoyalty(customers, snapshots, false)
    .filter((customer) => customer.enRiesgo)
    .map((customer) => ({
      id: customer.id,
      nombre: customer.nombre,
      email: customer.email,
      diasSinActividad: customer.diasSinActividad,
    }))
    .sort((left, right) => (right.diasSinActividad ?? 0) - (left.diasSinActividad ?? 0));
}

export async function birthdayList() {
  const customers = await loadCustomers();
  return customers
    .map((customer) => ({
      id: customer.id,
      nombre: customer.nombre,
      email: customer.email,
      fechaCumpleanos: birthdayOnCutoff(customer.dob),
    }))
    .filter((customer): customer is { id: string; nombre: string; email: string; fechaCumpleanos: string } =>
      customer.fechaCumpleanos != null,
    )
    .sort((left, right) => left.fechaCumpleanos.localeCompare(right.fechaCumpleanos) || left.nombre.localeCompare(right.nombre, "es"));
}

export async function customersCsv(permissions: PermissionId[]) {
  const canSeeAmounts = permissions.includes("ver_montos");
  const [customers, snapshots] = await Promise.all([loadCustomers(), loadSnapshots()]);
  const rows = withLoyalty(customers, snapshots, canSeeAmounts).sort((left, right) =>
    left.nombre.localeCompare(right.nombre, "es"),
  );
  const headers = [
    "cliente_id",
    "nombre",
    "correo",
    "nivel",
    "puntos",
    "puntos_disponibles",
    "en_riesgo",
    "dias_sin_actividad",
  ];

  if (canSeeAmounts) {
    headers.splice(6, 0, "gasto_12m");
  }

  return toCsv(
    headers,
    rows.map((row) => {
      const base = [
        row.id,
        row.nombre,
        row.email,
        row.nivel,
        row.puntos,
        row.puntosDisponibles,
        row.enRiesgo,
        row.diasSinActividad,
      ];

      if (canSeeAmounts) {
        base.splice(6, 0, row.gasto12m ?? null);
      }

      return base;
    }),
  );
}

export async function riskCsv() {
  const rows = await riskList();
  return toCsv(
    ["cliente_id", "nombre", "correo", "dias_sin_actividad"],
    rows.map((row) => [row.id, row.nombre, row.email, row.diasSinActividad]),
  );
}

export async function birthdayCsv() {
  const rows = await birthdayList();
  return toCsv(
    ["cliente_id", "nombre", "correo", "fecha_cumpleanos"],
    rows.map((row) => [row.id, row.nombre, row.email, row.fechaCumpleanos]),
  );
}
