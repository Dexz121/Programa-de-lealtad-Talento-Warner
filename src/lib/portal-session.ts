import "server-only";

import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { PortalSession } from "@/domain/panel";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { asInteger, asLevel, asPortal, asRecord, asText } from "@/lib/panel-values";

function sessionFromDocs(
  uid: string,
  customerId: string,
  customerSnap: DocumentSnapshot,
  snapshotSnap: DocumentSnapshot,
): PortalSession {
  const customer = asRecord(customerSnap.data());
  const score = snapshotSnap.exists ? asRecord(snapshotSnap.data()) : {};

  return {
    uid,
    customerId,
    nombre: asText(customer.name) || asText(customer.nombre) || "Cliente",
    email: (asText(customer.email) || asText(customer.correo)).toLowerCase(),
    portal: asPortal(customer.portalStatus ?? customer.portal),
    mustChangePassword: customer.mustChangePassword === true,
    nivel: asLevel(score.nivel),
    puntos: asInteger(score.puntos),
    puntosDisponibles: asInteger(score.puntosDisponibles ?? score.puntos_disponibles),
  };
}

async function rememberCustomerClaim(uid: string, customerId: string) {
  const auth = getAdminAuth();
  const user = await auth.getUser(uid);
  const current = user.customClaims ?? {};
  if (current.customerId === customerId) {
    return;
  }

  await auth.setCustomUserClaims(uid, { ...current, customerId });
}

export async function loadPortalAccount(uid: string, claimCustomerId: string) {
  const db = getAdminDb();
  let customerId = claimCustomerId;
  let customerSnap: DocumentSnapshot | null = null;

  if (!customerId) {
    const found = await db.collection("customers").where("authUid", "==", uid).limit(1).get();
    const match = found.docs[0];
    if (!match) {
      return { kind: "missing" as const };
    }

    customerId = match.id;
    customerSnap = match;
    await rememberCustomerClaim(uid, customerId);
  }

  const snapshotPromise = db.collection("loyaltySnapshots").doc(customerId).get();
  const customerPromise = customerSnap
    ? Promise.resolve(customerSnap)
    : db.collection("customers").doc(customerId).get();
  const [resolvedCustomer, snapshotSnap] = await Promise.all([customerPromise, snapshotPromise]);

  if (!resolvedCustomer.exists) {
    return { kind: "missing" as const };
  }

  const data = asRecord(resolvedCustomer.data());
  if (asText(data.authUid) !== uid) {
    return { kind: "missing" as const };
  }

  return {
    kind: "ok" as const,
    session: sessionFromDocs(uid, customerId, resolvedCustomer, snapshotSnap),
  };
}
