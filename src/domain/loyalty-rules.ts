import { CUTOFF, mexicoDate } from "@/domain/cutoff";
import type { Level } from "@/domain/panel";

const RATES: Record<string, number> = {
  MXN: 1,
  USD: 18.5,
  EUR: 20,
  GBP: 23.5,
  CAD: 13.5,
  AUD: 12,
};

function shiftDate(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export const SPEND_AFTER = shiftDate(CUTOFF, -365);

export type RulePayment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  fecha: string | null;
};

export type RuleOrder = {
  id: string;
  status: string;
  paymentStatus: string;
  fecha: string | null;
};

export type EarnedMovement = {
  id: string;
  fecha: string;
  tipo: "pago" | "reembolso" | "bono_orden_entregada";
  referencia: string;
  puntos: number;
};

export type CustomerScore = {
  puntos: number;
  gasto12m: number;
  nivel: Level;
  enRiesgo: boolean;
  diasSinActividad: number | null;
  movements: EarnedMovement[];
};

export function localDateFromApi(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return mexicoDate(parsed);
}

export function mxnCents(amount: number, currency: string) {
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  const rate = RATES[currency.trim().toUpperCase()];
  if (rate == null) {
    return null;
  }

  return Math.round(amount * rate * 100);
}

export function levelFor(gasto12m: number): Level {
  if (gasto12m > 400_000) {
    return "Oro";
  }

  if (gasto12m >= 150_000) {
    return "Plata";
  }

  return "Bronce";
}

export function daysUntilCutoff(activity: string) {
  const start = Date.parse(`${activity}T00:00:00Z`);
  const end = Date.parse(`${CUTOFF}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

function onOrBeforeCutoff(fecha: string | null): fecha is string {
  return fecha != null && fecha <= CUTOFF;
}

export function scoreCustomer(payments: RulePayment[], orders: RuleOrder[]): CustomerScore {
  const movements: EarnedMovement[] = [];
  const activity: string[] = [];
  let spendCents = 0;
  let hasSucceeded = false;

  for (const payment of payments) {
    if (!onOrBeforeCutoff(payment.fecha)) {
      continue;
    }

    const cents = mxnCents(payment.amount, payment.currency);
    if (cents == null) {
      continue;
    }

    const status = payment.status.toLowerCase();
    if (status === "succeeded") {
      hasSucceeded = true;
      activity.push(payment.fecha);
      if (payment.fecha > SPEND_AFTER) {
        spendCents += cents;
      }

      const puntos = Math.floor(cents / 1000);
      if (puntos > 0) {
        movements.push({
          id: `pago_${payment.id}`,
          fecha: payment.fecha,
          tipo: "pago",
          referencia: `pago:${payment.id}`,
          puntos,
        });
      }
      continue;
    }

    if (status === "refunded") {
      const puntos = Math.floor(cents / 1000);
      if (puntos > 0) {
        movements.push({
          id: `pago_${payment.id}`,
          fecha: payment.fecha,
          tipo: "pago",
          referencia: `pago:${payment.id}`,
          puntos,
        });
        movements.push({
          id: `reembolso_${payment.id}`,
          fecha: payment.fecha,
          tipo: "reembolso",
          referencia: `pago:${payment.id}`,
          puntos: -puntos,
        });
      }
    }
  }

  for (const order of orders) {
    if (!onOrBeforeCutoff(order.fecha)) {
      continue;
    }

    const status = order.status.toLowerCase();
    if (status !== "cancelled") {
      activity.push(order.fecha);
    }

    if (status === "delivered" && order.paymentStatus.toLowerCase() === "paid") {
      movements.push({
        id: `bono_${order.id}`,
        fecha: order.fecha,
        tipo: "bono_orden_entregada",
        referencia: `orden:${order.id}`,
        puntos: 250,
      });
    }
  }

  const lastActivity = activity.sort((left, right) => left.localeCompare(right)).at(-1) ?? null;
  const diasSinActividad = lastActivity ? daysUntilCutoff(lastActivity) : null;
  const gasto12m = spendCents / 100;

  return {
    puntos: movements.reduce((total, movement) => total + movement.puntos, 0),
    gasto12m,
    nivel: levelFor(gasto12m),
    enRiesgo: hasSucceeded && diasSinActividad != null && diasSinActividad >= 90,
    diasSinActividad,
    movements,
  };
}
