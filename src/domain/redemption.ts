import type { Level } from "@/domain/panel";

const LEVEL_RANK: Record<Level, number> = {
  Bronce: 0,
  Plata: 1,
  Oro: 2,
};

export type RedemptionReward = {
  tipo: "producto" | "descuento";
  activo: boolean;
  puntosRequeridos: number;
  stock: number | null;
  nivelMinimo: Level;
  limitePorCliente: number | null;
};

export type RedemptionPlanInput = {
  reward: RedemptionReward | null;
  nivel: Level | null;
  puntosDisponibles: number;
  claims: number;
};

export type RedemptionPlan =
  | { ok: false; reason: string }
  | {
      ok: true;
      puntos: number;
      touchStock: boolean;
      nextStock: number | null;
      nextPuntosDisponibles: number;
      nextClaims: number;
      estado: "pendiente" | "vigente";
      crearCupon: boolean;
    };

export function rewardClaimId(customerId: string, rewardId: string) {
  return `${customerId}__${rewardId}`.replaceAll("/", "_");
}

export function planRedemption(input: RedemptionPlanInput): RedemptionPlan {
  const reward = input.reward;
  if (!reward) {
    return { ok: false, reason: "Esa recompensa no existe." };
  }

  if (!reward.activo) {
    return { ok: false, reason: "Esa recompensa no está disponible." };
  }

  if (input.nivel == null || LEVEL_RANK[input.nivel] < LEVEL_RANK[reward.nivelMinimo]) {
    return { ok: false, reason: "Tu nivel no alcanza para esta recompensa." };
  }

  if (input.puntosDisponibles < reward.puntosRequeridos) {
    return { ok: false, reason: "No tienes puntos suficientes." };
  }

  if (typeof reward.stock === "number" && reward.stock < 1) {
    return { ok: false, reason: "Ya no hay stock." };
  }

  if (reward.limitePorCliente != null && input.claims >= reward.limitePorCliente) {
    return { ok: false, reason: "Ya alcanzaste el límite de canjes de esta recompensa." };
  }

  const shared = {
    ok: true as const,
    puntos: reward.puntosRequeridos,
    nextPuntosDisponibles: input.puntosDisponibles - reward.puntosRequeridos,
    nextClaims: input.claims + 1,
    estado: reward.tipo === "descuento" ? ("vigente" as const) : ("pendiente" as const),
    crearCupon: reward.tipo === "descuento",
  };

  if (typeof reward.stock === "number") {
    return { ...shared, touchStock: true, nextStock: reward.stock - 1 };
  }

  return { ...shared, touchStock: false, nextStock: null };
}

export function redeemPreview(input: {
  activo: boolean;
  nivelMinimo: Level;
  nivel: Level | null;
  puntosRequeridos: number;
  puntosDisponibles: number | null;
  stock: number | null;
}) {
  const decision = planRedemption({
    reward: {
      tipo: "producto",
      activo: input.activo,
      puntosRequeridos: input.puntosRequeridos,
      stock: input.stock,
      nivelMinimo: input.nivelMinimo,
      limitePorCliente: null,
    },
    nivel: input.nivel,
    puntosDisponibles: input.puntosDisponibles ?? 0,
    claims: 0,
  });

  return decision.ok ? null : decision.reason;
}
