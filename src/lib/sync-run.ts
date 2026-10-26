import "server-only";

import { connection } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { localDateFromApi, scoreCustomer, type RuleOrder, type RulePayment } from "@/domain/loyalty-rules";
import { getAdminDb } from "@/lib/firebase-admin";
import { invalidateReads } from "@/lib/read-cache";

const SOURCE = "https://fakeapi.dev/api/v1";
const LOCK_MS = 8 * 60 * 1000;

type Counter = { requests: number };

export class SyncBusyError extends Error {
  constructor() {
    super("Ya hay una sincronización en curso.");
  }
}

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as RawRecord;
  }

  return {};
}

function asText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function asAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function userIdOf(row: RawRecord) {
  const direct = row.user_id ?? row.userId;
  if (typeof direct === "number" || (typeof direct === "string" && direct.trim())) {
    return String(direct).trim();
  }

  const user = asRecord(row.user);
  const id = user.id;
  if (typeof id === "number" || (typeof id === "string" && id.trim())) {
    return String(id).trim();
  }

  return "";
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url: URL, key: string, counter: Counter) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    counter.requests += 1;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    });

    if (response.status === 429 || response.status >= 500) {
      const reset = Number(response.headers.get("x-ratelimit-reset"));
      const retryAfter = Number(response.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Number.isFinite(reset)
          ? Math.max(0, reset * 1000 - Date.now())
          : 1000 * (attempt + 1);

      if (waitMs > 15_000 || attempt === 3) {
        throw new Error(`La tienda respondió ${response.status} y no se pudo continuar.`);
      }

      await sleep(waitMs || 1000);
      continue;
    }

    if (!response.ok) {
      throw new Error(`La tienda respondió ${response.status} al descargar datos.`);
    }

    return asRecord(await response.json());
  }

  throw new Error("La tienda no respondió a tiempo.");
}

async function fetchAll(resource: string, key: string, counter: Counter) {
  const rows: RawRecord[] = [];
  let page = 1;

  for (;;) {
    const url = new URL(`${SOURCE}/${resource}`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "100");
    const body = await fetchJson(url, key, counter);
    const data = Array.isArray(body.data) ? body.data : [];

    for (const row of data) {
      rows.push(asRecord(row));
    }

    const meta = asRecord(body.meta);
    if (meta.has_more !== true) {
      break;
    }

    page += 1;
    if (page > 200) {
      throw new Error(`La paginación de ${resource} no terminó.`);
    }
  }

  return rows;
}

type SyncUser = {
  id: string;
  clienteId: number;
  name: string;
  email: string;
  phone: string;
  dob: string;
};

function mapUser(row: RawRecord): SyncUser | null {
  const id = asText(row.id);
  if (!id) {
    return null;
  }

  const name = asText(row.name) || [asText(row.first_name), asText(row.last_name)].filter(Boolean).join(" ");
  const dob = asText(row.dob).slice(0, 10);

  return {
    id,
    clienteId: Number(id),
    name: name || "Sin nombre",
    email: asText(row.email),
    phone: asText(row.phone),
    dob: /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : "",
  };
}

function mapOrder(row: RawRecord): RuleOrder & { customerId: string; total: number | null } | null {
  const id = asText(row.id);
  const customerId = userIdOf(row);
  if (!id || !customerId) {
    return null;
  }

  const fecha = localDateFromApi(row.created_at ?? row.createdAt);

  return {
    id,
    customerId,
    status: asText(row.status).toLowerCase(),
    paymentStatus: asText(row.payment_status ?? row.paymentStatus).toLowerCase(),
    fecha,
    total: asAmount(row.total),
  };
}

function mapPayment(row: RawRecord): RulePayment & { customerId: string; orderId: string } | null {
  const id = asText(row.id);
  const customerId = userIdOf(row);
  const amount = asAmount(row.amount);
  if (!id || !customerId || amount == null) {
    return null;
  }

  const paidAt = row.paid_at ?? row.paidAt;
  const fecha = localDateFromApi(paidAt == null ? row.created_at ?? row.createdAt : paidAt);

  return {
    id,
    customerId,
    amount,
    currency: asText(row.currency).toUpperCase(),
    status: asText(row.status).toLowerCase(),
    fecha,
    orderId: asText(asRecord(row.metadata).order_id),
  };
}

async function acquireLock() {
  const db = getAdminDb();
  const ref = db.collection("syncLock").doc("current");
  const acquired = await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const data = snap.data();
    const started = typeof data?.startedAtMs === "number" ? data.startedAtMs : 0;
    if (data?.running === true && Date.now() - started < LOCK_MS) {
      return false;
    }

    transaction.set(ref, { running: true, startedAtMs: Date.now() });
    return true;
  });

  if (!acquired) {
    throw new SyncBusyError();
  }
}

async function releaseLock() {
  await getAdminDb().collection("syncLock").doc("current").set({ running: false, startedAtMs: Date.now() }, { merge: true });
}

export async function runSync(origin: { origen: "manual" | "cron"; actor?: string }) {
  await connection();
  const key = process.env.FAKEAPI_KEY;
  if (!key) {
    throw new Error("Falta FAKEAPI_KEY.");
  }

  await acquireLock();
  const started = new Date();
  const counter: Counter = { requests: 0 };

  try {
    const [userRows, orderRows, paymentRows] = await Promise.all([
      fetchAll("users", key, counter),
      fetchAll("orders", key, counter),
      fetchAll("payments", key, counter),
    ]);

    const users = userRows.map(mapUser).filter((user): user is SyncUser => user != null);
    const userIds = new Set(users.map((user) => user.id));
    const orders = orderRows
      .map(mapOrder)
      .filter((order): order is NonNullable<ReturnType<typeof mapOrder>> => order != null && userIds.has(order.customerId));
    const payments = paymentRows
      .map(mapPayment)
      .filter((payment): payment is NonNullable<ReturnType<typeof mapPayment>> => payment != null && userIds.has(payment.customerId));

    const ordersByCustomer = new Map<string, RuleOrder[]>();
    for (const order of orders) {
      const list = ordersByCustomer.get(order.customerId) ?? [];
      list.push(order);
      ordersByCustomer.set(order.customerId, list);
    }

    const paymentsByCustomer = new Map<string, RulePayment[]>();
    for (const payment of payments) {
      const list = paymentsByCustomer.get(payment.customerId) ?? [];
      list.push(payment);
      paymentsByCustomer.set(payment.customerId, list);
    }

    const db = getAdminDb();
    const [existingCustomers, existingOrders, existingPayments, existingMovements] = await Promise.all([
      db.collection("customers").get(),
      db.collection("orders").select("customerId").get(),
      db.collection("payments").select("customerId").get(),
      db.collection("pointMovements").select("customerId", "puntos", "tipo", "source").get(),
    ]);

    const redeemedByCustomer = new Map<string, number>();
    const syncMovementDocs = [];
    for (const doc of existingMovements.docs) {
      const data = doc.data();
      const tipo = typeof data.tipo === "string" ? data.tipo : "";
      const fromSync = data.source === "sync" || tipo === "pago" || tipo === "reembolso" || tipo === "bono_orden_entregada";
      if (fromSync) {
        syncMovementDocs.push(doc);
        continue;
      }

      const customerId = typeof data.customerId === "string" ? data.customerId : "";
      const puntos = typeof data.puntos === "number" ? data.puntos : 0;
      if (customerId) {
        redeemedByCustomer.set(customerId, (redeemedByCustomer.get(customerId) ?? 0) + puntos);
      }
    }

    const writer = db.bulkWriter();
    writer.onWriteError((error) => error.failedAttempts < 5);

    const previousCustomers = new Set(existingCustomers.docs.map((doc) => doc.id));
    for (const user of users) {
      const payload: Record<string, unknown> = {
        cliente_id: user.clienteId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        dob: user.dob,
      };
      if (!previousCustomers.has(user.id)) {
        payload.portalStatus = "sin acceso";
        payload.mustChangePassword = false;
      }
      writer.set(db.collection("customers").doc(user.id), payload, { merge: true });
    }

    const orderIds = new Set(orders.map((order) => order.id));
    for (const doc of existingOrders.docs) {
      if (!orderIds.has(doc.id)) {
        writer.delete(doc.ref);
      }
    }
    for (const order of orders) {
      writer.set(db.collection("orders").doc(order.id), {
        customerId: order.customerId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        fecha: order.fecha,
      });
    }

    const paymentIds = new Set(payments.map((payment) => payment.id));
    for (const doc of existingPayments.docs) {
      if (!paymentIds.has(doc.id)) {
        writer.delete(doc.ref);
      }
    }
    for (const payment of payments) {
      writer.set(db.collection("payments").doc(payment.id), {
        customerId: payment.customerId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        fecha: payment.fecha,
        orderId: payment.orderId || null,
      });
    }

    const movementIds = new Set<string>();
    for (const user of users) {
      const score = scoreCustomer(paymentsByCustomer.get(user.id) ?? [], ordersByCustomer.get(user.id) ?? []);
      const redeemed = redeemedByCustomer.get(user.id) ?? 0;

      for (const movement of score.movements) {
        movementIds.add(movement.id);
        writer.set(db.collection("pointMovements").doc(movement.id), {
          customerId: user.id,
          fecha: movement.fecha,
          tipo: movement.tipo,
          referencia: movement.referencia,
          puntos: movement.puntos,
          source: "sync",
        });
      }

      writer.set(db.collection("loyaltySnapshots").doc(user.id), {
        customerId: user.id,
        puntos: score.puntos,
        puntosDisponibles: score.puntos + redeemed,
        nivel: score.nivel,
        gasto12m: score.gasto12m,
        enRiesgo: score.enRiesgo,
        diasSinActividad: score.diasSinActividad,
      });
    }

    for (const doc of syncMovementDocs) {
      if (!movementIds.has(doc.id)) {
        writer.delete(doc.ref);
      }
    }

    const resultado = `Sincronizados ${users.length} clientes, ${orders.length} pedidos y ${payments.length} pagos. Puntos recalculados al 2026-04-30.`;
    writer.set(db.collection("syncRuns").doc(), {
      inicio: Timestamp.fromDate(started),
      fin: Timestamp.fromDate(new Date()),
      requests: counter.requests,
      resultado,
      origen: origin.origen,
      actor: origin.actor ?? null,
    });

    await writer.close();
    invalidateReads("loyalty:");

    return {
      ok: true,
      mensaje: resultado,
      requests: counter.requests,
      clientes: users.length,
      pedidos: orders.length,
      pagos: payments.length,
    };
  } catch (error) {
    if (!(error instanceof SyncBusyError)) {
      await getAdminDb()
        .collection("syncRuns")
        .doc()
        .set({
          inicio: Timestamp.fromDate(started),
          fin: Timestamp.fromDate(new Date()),
          requests: counter.requests,
          resultado: error instanceof Error ? error.message : "La sincronización falló.",
          origen: origin.origen,
          actor: origin.actor ?? null,
        })
        .catch(() => undefined);
    }

    throw error;
  } finally {
    await releaseLock().catch(() => undefined);
  }
}
