import "server-only";

import { randomInt } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { mexicoDate } from "@/domain/cutoff";
import type { PortalSession } from "@/domain/panel";
import { planRedemption, rewardClaimId } from "@/domain/redemption";
import { getAdminDb } from "@/lib/firebase-admin";
import { PanelActionError } from "@/lib/panel-auth";
import { asInteger, asLevel, asRecord, asText } from "@/lib/panel-values";
import { invalidateReads } from "@/lib/read-cache";

function addDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function couponCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 8; index += 1) {
    code += alphabet[randomInt(alphabet.length)];
  }

  return code;
}

export async function redeemReward(portal: PortalSession, rewardId: string) {
  const db = getAdminDb();
  const rewardRef = db.collection("rewards").doc(rewardId);
  const snapshotRef = db.collection("loyaltySnapshots").doc(portal.customerId);
  const claimRef = db.collection("rewardClaims").doc(rewardClaimId(portal.customerId, rewardId));
  const redemptionRef = db.collection("redemptions").doc();
  const movementRef = db.collection("pointMovements").doc();
  const couponRef = db.collection("coupons").doc();
  const today = mexicoDate();

  const result = await db.runTransaction(async (transaction) => {
    const rewardSnap = await transaction.get(rewardRef);
    const snapshotSnap = await transaction.get(snapshotRef);
    const claimSnap = await transaction.get(claimRef);
    const reward = asRecord(rewardSnap.data());
    const snapshot = snapshotSnap.exists ? asRecord(snapshotSnap.data()) : {};
    const tipo = reward.tipo === "descuento" ? "descuento" : "producto";
    const nivelMinimo = asLevel(reward.nivelMinimo) ?? "Bronce";
    const decision = planRedemption({
      reward: rewardSnap.exists
        ? {
            tipo,
            activo: reward.activo !== false,
            puntosRequeridos: asInteger(reward.puntosRequeridos) ?? 0,
            stock: reward.stock == null ? null : asInteger(reward.stock),
            nivelMinimo,
            limitePorCliente: asInteger(reward.limitePorCliente),
          }
        : null,
      nivel: asLevel(snapshot.nivel),
      puntosDisponibles: asInteger(snapshot.puntosDisponibles ?? snapshot.puntos_disponibles) ?? 0,
      claims: claimSnap.exists ? (asInteger(asRecord(claimSnap.data()).count) ?? 0) : 0,
    });

    if (!decision.ok) {
      throw new PanelActionError(decision.reason, decision.reason === "Esa recompensa no existe." ? 404 : 409);
    }

    const code = decision.crearCupon ? couponCode() : null;
    const vigencia = asInteger(reward.vigenciaDias);
    const vence = code && vigencia != null && vigencia > 0 ? addDays(today, vigencia) : null;

    if (decision.touchStock) {
      transaction.update(rewardRef, {
        stock: decision.nextStock,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    transaction.set(
      snapshotRef,
      { customerId: portal.customerId, puntosDisponibles: decision.nextPuntosDisponibles },
      { merge: true },
    );
    transaction.set(claimRef, {
      customerId: portal.customerId,
      rewardId,
      count: decision.nextClaims,
    });
    transaction.set(movementRef, {
      customerId: portal.customerId,
      fecha: today,
      tipo: "canje",
      referencia: `canje:${redemptionRef.id}`,
      puntos: -decision.puntos,
      source: "portal",
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.set(redemptionRef, {
      customerId: portal.customerId,
      rewardId,
      rewardNombre: asText(reward.nombre) || "Recompensa",
      rewardTipo: tipo,
      puntos: decision.puntos,
      estado: decision.estado,
      couponId: code ? couponRef.id : null,
      couponCode: code,
      vence,
      fecha: today,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (code) {
      transaction.set(couponRef, {
        customerId: portal.customerId,
        redemptionId: redemptionRef.id,
        rewardId,
        code,
        estado: "vigente",
        vence,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      id: redemptionRef.id,
      estado: decision.estado,
      couponCode: code,
      vence,
      puntosDisponibles: decision.nextPuntosDisponibles,
      stock: decision.touchStock ? decision.nextStock : null,
    };
  });

  invalidatePortal(portal);
  return result;
}

export function invalidatePortal(portal: Pick<PortalSession, "uid" | "customerId">) {
  invalidateReads(`portal:session:${portal.uid}:`);
  invalidateReads(`portal:mov:${portal.customerId}:`);
  invalidateReads(`portal:canjes:${portal.customerId}:`);
  invalidateReads("portal:catalogo");
}
