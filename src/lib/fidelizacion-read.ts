import "server-only";

import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { birthdayOnCutoff } from "@/domain/cutoff";
import { getAdminDb } from "@/lib/firebase-admin";

function asRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function clienteId(docId: string, value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (/^\d+$/.test(docId)) {
    return Number(docId);
  }

  return docId;
}

function movementRows(docs: QueryDocumentSnapshot[]) {
  return docs
    .map((doc) => {
      const data = asRecord(doc.data());
      return {
        fecha: typeof data.fecha === "string" ? data.fecha : "",
        tipo: typeof data.tipo === "string" ? data.tipo : "movimiento",
        referencia: typeof data.referencia === "string" ? data.referencia : "",
        puntos: typeof data.puntos === "number" ? data.puntos : 0,
      };
    })
    .sort((left, right) => left.fecha.localeCompare(right.fecha) || left.referencia.localeCompare(right.referencia));
}

export async function fidelizacionCliente(id: string) {
  const db = getAdminDb();
  const [customer, snapshot, movements] = await Promise.all([
    db.collection("customers").doc(id).get(),
    db.collection("loyaltySnapshots").doc(id).get(),
    db.collection("pointMovements").where("customerId", "==", id).get(),
  ]);

  if (!customer.exists || !snapshot.exists) {
    return null;
  }

  const profile = asRecord(customer.data());
  const score = asRecord(snapshot.data());

  return {
    cliente_id: clienteId(id, profile.cliente_id),
    puntos: typeof score.puntos === "number" ? score.puntos : 0,
    puntos_disponibles: typeof score.puntosDisponibles === "number" ? score.puntosDisponibles : 0,
    nivel: score.nivel === "Plata" || score.nivel === "Oro" ? score.nivel : "Bronce",
    gasto_12m: typeof score.gasto12m === "number" ? score.gasto12m : 0,
    en_riesgo: score.enRiesgo === true,
    dias_sin_actividad: typeof score.diasSinActividad === "number" ? score.diasSinActividad : null,
    movimientos: movementRows(movements.docs),
  };
}

export async function fidelizacionRiesgo() {
  const snap = await getAdminDb().collection("loyaltySnapshots").get();

  return snap.docs
    .filter((doc) => doc.data().enRiesgo === true)
    .map((doc) => ({
      cliente_id: clienteId(doc.id, doc.data().customerId),
      dias_sin_actividad: typeof doc.data().diasSinActividad === "number" ? doc.data().diasSinActividad : null,
    }))
    .sort((left, right) => Number(left.cliente_id) - Number(right.cliente_id));
}

export async function fidelizacionCumpleanos() {
  const snap = await getAdminDb().collection("customers").get();

  return snap.docs
    .map((doc) => {
      const data = asRecord(doc.data());
      const dob = typeof data.dob === "string" ? data.dob : "";
      return {
        cliente_id: clienteId(doc.id, data.cliente_id),
        fecha_cumpleanos: birthdayOnCutoff(dob),
      };
    })
    .filter((row): row is { cliente_id: number | string; fecha_cumpleanos: string } => row.fecha_cumpleanos != null)
    .sort((left, right) => left.fecha_cumpleanos.localeCompare(right.fecha_cumpleanos) || Number(left.cliente_id) - Number(right.cliente_id));
}
