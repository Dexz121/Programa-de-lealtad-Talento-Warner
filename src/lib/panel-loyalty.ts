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
} from "@/lib/panel-values";
import { cachedRead } from "@/lib/read-cache";

const FRESH_MS = 60_000;
const BIRTHDAY_FROM_YEAR = 1920;
const BIRTHDAY_TO_YEAR = 2026;

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
  return cachedRead("loyalty:customers", FRESH_MS, async () => {
    const snap = await getAdminDb().collection("customers").get();
    return snap.docs.map((doc) => customerFromDoc(doc.id, doc.data()));
  });
}

async function loadSnapshots() {
  return cachedRead("loyalty:snapshots", FRESH_MS, async () => {
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
  });
}

type CustomerDoc = { id: string; data: () => unknown };

async function hydrate(docs: CustomerDoc[], canSeeAmounts: boolean) {
  if (docs.length === 0) {
    return [];
  }

  const db = getAdminDb();
  const snaps = await db.getAll(...docs.map((doc) => db.collection("loyaltySnapshots").doc(doc.id)));
  const snapshots = new Map<string, SnapshotFields>();
  for (const snap of snaps) {
    if (snap.exists) {
      snapshots.set(snap.id, snapshotFromDoc(snap.id, snap.data()));
    }
  }

  return docs.map((doc) => applySnapshot(customerFromDoc(doc.id, doc.data()), snapshots.get(doc.id), canSeeAmounts));
}

function nameVariants(needle: string) {
  const trimmed = needle.trim();
  const variants = new Set<string>([trimmed, trimmed.toLowerCase()]);
  if (trimmed) {
    variants.add(trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase());
  }
  return [...variants];
}

async function prefixCustomers(field: "name" | "email", prefix: string) {
  const snap = await getAdminDb()
    .collection("customers")
    .where(field, ">=", prefix)
    .where(field, "<=", `${prefix}\uf8ff`)
    .limit(30)
    .get();
  return snap.docs;
}

async function locateCustomer(customerId: string) {
  const db = getAdminDb();
  const direct = await db.collection("customers").doc(customerId).get();
  if (direct.exists) {
    return direct;
  }

  const lookups = [db.collection("customers").where("cliente_id", "==", customerId).limit(1).get()];
  if (/^\d+$/.test(customerId)) {
    lookups.push(db.collection("customers").where("cliente_id", "==", Number(customerId)).limit(1).get());
  }

  const snaps = await Promise.all(lookups);
  for (const snap of snaps) {
    const match = snap.docs[0];
    if (match) {
      return match;
    }
  }

  return null;
}

async function relatedDocs(collection: string, ids: string[]) {
  const db = getAdminDb();
  const unique = [...new Set(ids.filter(Boolean))];
  const snaps = await Promise.all(unique.map((id) => db.collection(collection).where("customerId", "==", id).get()));
  const docs = new Map<string, Record<string, unknown>>();

  for (const snap of snaps) {
    for (const doc of snap.docs) {
      docs.set(doc.id, asRecord(doc.data()));
    }
  }

  return [...docs.entries()];
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

  return cachedRead(`loyalty:summary:${canSeeAmounts}:${canSeeRisk}`, 30_000, async () => {
    const db = getAdminDb();
    const snapshots = db.collection("loyaltySnapshots");
    const [totalSnap, bronceSnap, plataSnap, oroSnap, riesgoSnap, topSnap, birthdays] = await Promise.all([
      db.collection("customers").count().get(),
      snapshots.where("nivel", "==", "Bronce").count().get(),
      snapshots.where("nivel", "==", "Plata").count().get(),
      snapshots.where("nivel", "==", "Oro").count().get(),
      canSeeRisk ? snapshots.where("enRiesgo", "==", true).count().get() : Promise.resolve(null),
      snapshots.orderBy("puntos", "desc").limit(10).get(),
      canSeeRisk ? birthdayList() : Promise.resolve(null),
    ]);

    const bronce = bronceSnap.data().count;
    const plata = plataSnap.data().count;
    const oro = oroSnap.data().count;
    const totalClientes = totalSnap.data().count;
    const topDocs = topSnap.docs;
    const customerSnaps = topDocs.length
      ? await db.getAll(...topDocs.map((doc) => db.collection("customers").doc(doc.id)))
      : [];
    const customers = new Map(customerSnaps.filter((doc) => doc.exists).map((doc) => [doc.id, customerFromDoc(doc.id, doc.data())]));
    const top = topDocs
      .map((doc) => {
        const snapshot = snapshotFromDoc(doc.id, doc.data());
        const customer = customers.get(doc.id);
        return {
          id: customer?.id || snapshot.customerId || doc.id,
          nombre: customer?.nombre || "Sin nombre",
          nivel: snapshot.nivel,
          puntos: snapshot.puntos,
          ...(canSeeAmounts ? { gasto12m: snapshot.gasto12m } : {}),
        };
      })
      .sort((left, right) => (right.puntos ?? 0) - (left.puntos ?? 0) || left.nombre.localeCompare(right.nombre, "es"));

    return {
      totalClientes,
      niveles: {
        Bronce: bronce,
        Plata: plata,
        Oro: oro,
        "Sin calcular": Math.max(0, totalClientes - bronce - plata - oro),
      },
      top,
      enRiesgo: riesgoSnap ? riesgoSnap.data().count : null,
      cumpleanos: birthdays ? birthdays.length : null,
    };
  });
}

export async function searchCustomers(query: string, permissions: PermissionId[]) {
  const canSeeAmounts = permissions.includes("ver_montos");
  const needle = query.trim().toLowerCase();

  return cachedRead(`loyalty:search:${canSeeAmounts}:${needle}`, 20_000, async () => {
    const db = getAdminDb();

    if (!needle) {
      const [totalSnap, page] = await Promise.all([
        db.collection("customers").count().get(),
        db.collection("customers").orderBy("name").limit(30).get(),
      ]);
      return {
        total: totalSnap.data().count,
        clientes: await hydrate(page.docs, canSeeAmounts),
      };
    }

    const found = new Map<string, CustomerDoc>();
    const tasks: Array<Promise<CustomerDoc[]>> = [];

    if (/^\d+$/.test(needle)) {
      tasks.push(
        locateCustomer(needle).then((doc) => (doc ? [doc] : [])),
      );
    }

    const field = needle.includes("@") ? "email" : "name";
    for (const prefix of nameVariants(needle)) {
      tasks.push(prefixCustomers(field, prefix));
    }

    const groups = await Promise.all(tasks);
    for (const group of groups) {
      for (const doc of group) {
        found.set(doc.id, doc);
      }
    }

    const clientes = (await hydrate([...found.values()], canSeeAmounts))
      .filter(
        (customer) =>
          customer.nombre.toLowerCase().includes(needle) ||
          customer.email.toLowerCase().includes(needle) ||
          customer.id.toLowerCase().includes(needle),
      )
      .sort((left, right) => left.nombre.localeCompare(right.nombre, "es"))
      .slice(0, 30);

    return { total: clientes.length, clientes };
  });
}

export async function customerDetail(customerId: string, permissions: PermissionId[]) {
  const canSeeAmounts = permissions.includes("ver_montos");

  return cachedRead(`loyalty:detail:${canSeeAmounts}:${customerId}`, 15_000, async () => {
    const located = await locateCustomer(customerId);
    if (!located) {
      throw new PanelActionError("Ese cliente no existe.", 404);
    }

    const customer = customerFromDoc(located.id, located.data());
    const db = getAdminDb();
    let snapshotSnap = await db.collection("loyaltySnapshots").doc(located.id).get();
    if (!snapshotSnap.exists && customer.id !== located.id) {
      snapshotSnap = await db.collection("loyaltySnapshots").doc(customer.id).get();
    }

    const snapshot = snapshotSnap.exists ? snapshotFromDoc(snapshotSnap.id, snapshotSnap.data()) : undefined;
    const row = applySnapshot(customer, snapshot, canSeeAmounts);
    const lookupIds = [located.id, customer.id];
    const movementDocs = await relatedDocs("pointMovements", lookupIds);
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
      const orderDocs = await relatedDocs("orders", lookupIds);
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

      const paymentDocs = await relatedDocs("payments", lookupIds);
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
  });
}

export async function riskSnapshotDocs() {
  return cachedRead("loyalty:risk-docs", FRESH_MS, async () => {
    const snap = await getAdminDb().collection("loyaltySnapshots").where("enRiesgo", "==", true).get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      const dias = data.diasSinActividad;
      return {
        id: doc.id,
        customerId: data.customerId,
        diasSinActividad: typeof dias === "number" ? dias : null,
      };
    });
  });
}

export async function riskList() {
  return cachedRead("loyalty:risk-list", FRESH_MS, async () => {
    const docs = await riskSnapshotDocs();
    const db = getAdminDb();
    const customers = new Map<string, CustomerListItem>();

    for (let index = 0; index < docs.length; index += 50) {
      const chunk = docs.slice(index, index + 50);
      const snaps = await db.getAll(...chunk.map((doc) => db.collection("customers").doc(doc.id)));
      for (const snap of snaps) {
        if (snap.exists) {
          customers.set(snap.id, customerFromDoc(snap.id, snap.data()));
        }
      }
    }

    return docs
      .flatMap((doc) => {
        const customer = customers.get(doc.id);
        if (!customer) {
          return [];
        }

        return [
          {
            id: customer.id,
            nombre: customer.nombre,
            email: customer.email,
            diasSinActividad: doc.diasSinActividad,
          },
        ];
      })
      .sort((left, right) => (right.diasSinActividad ?? 0) - (left.diasSinActividad ?? 0) || left.nombre.localeCompare(right.nombre, "es"));
  });
}

export async function birthdayList() {
  return cachedRead("loyalty:birthdays", FRESH_MS, async () => {
    const years = Array.from({ length: BIRTHDAY_TO_YEAR - BIRTHDAY_FROM_YEAR + 1 }, (_, index) => BIRTHDAY_FROM_YEAR + index);
    const docs: CustomerDoc[] = [];

    for (let index = 0; index < years.length; index += 8) {
      const chunk = years.slice(index, index + 8);
      const snaps = await Promise.all(
        chunk.map((year) =>
          getAdminDb()
            .collection("customers")
            .where("dob", ">=", `${year}-04-30`)
            .where("dob", "<=", `${year}-05-07\uf8ff`)
            .get(),
        ),
      );
      for (const snap of snaps) {
        docs.push(...snap.docs);
      }
    }

    return docs
      .map((doc) => {
        const customer = customerFromDoc(doc.id, doc.data());
        return {
          id: customer.id,
          nombre: customer.nombre,
          email: customer.email,
          fechaCumpleanos: birthdayOnCutoff(customer.dob),
        };
      })
      .filter((customer): customer is { id: string; nombre: string; email: string; fechaCumpleanos: string } =>
        customer.fechaCumpleanos != null,
      )
      .sort((left, right) => left.fechaCumpleanos.localeCompare(right.fechaCumpleanos) || left.nombre.localeCompare(right.nombre, "es"));
  });
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
