import "server-only";

import type { MovementItem, RedemptionItem, RewardItem } from "@/domain/panel";
import { isLevel } from "@/domain/panel";
import { getAdminDb } from "@/lib/firebase-admin";
import { asInteger, asMexicoDate, asNumber, asRecord, asText } from "@/lib/panel-values";
import { cachedRead } from "@/lib/read-cache";

const CATALOG_TTL_MS = 60_000;
const LIST_TTL_MS = 20_000;

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

export function listPortalCatalog() {
  return cachedRead("portal:catalogo", CATALOG_TTL_MS, async () => {
    const snap = await getAdminDb().collection("rewards").where("activo", "==", true).get();
    return snap.docs
      .map((doc) => rewardFromDoc(doc.id, doc.data()))
      .sort((left, right) => left.nombre.localeCompare(right.nombre, "es"));
  });
}

export function listPortalMovements(customerId: string, limit: number) {
  return cachedRead(`portal:mov:${customerId}:${limit}:`, LIST_TTL_MS, async () => {
    const snap = await getAdminDb()
      .collection("pointMovements")
      .where("customerId", "==", customerId)
      .orderBy("fecha", "desc")
      .limit(limit)
      .get();

    const rows: MovementItem[] = snap.docs.map((doc) => {
      const data = asRecord(doc.data());
      return {
        fecha: asMexicoDate(data.fecha ?? data.createdAt),
        tipo: asText(data.tipo),
        referencia: asText(data.referencia),
        puntos: asInteger(data.puntos) ?? 0,
      };
    });

    return rows;
  });
}

export function listPortalRedemptions(customerId: string) {
  return cachedRead(`portal:canjes:${customerId}:`, LIST_TTL_MS, async () => {
    const snap = await getAdminDb()
      .collection("redemptions")
      .where("customerId", "==", customerId)
      .orderBy("fecha", "desc")
      .limit(30)
      .get();

    const rows: RedemptionItem[] = snap.docs.map((doc) => {
      const data = asRecord(doc.data());
      const rewardTipo = data.rewardTipo === "descuento" || data.tipo === "descuento" ? "descuento" : "producto";

      return {
        id: doc.id,
        customerId,
        cliente: asText(data.cliente) || customerId,
        rewardId: asText(data.rewardId),
        recompensa: asText(data.rewardNombre) || asText(data.recompensa) || "Recompensa",
        rewardTipo,
        puntos: asInteger(data.puntos) ?? 0,
        estado: asText(data.estado) || "pendiente",
        couponCode: asText(data.couponCode) || null,
        vence: asMexicoDate(data.vence) || null,
        fecha: asMexicoDate(data.fecha ?? data.createdAt),
      };
    });

    return rows;
  });
}
