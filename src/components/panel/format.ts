const MOVEMENTS: Record<string, string> = {
  pago: "Pago",
  reembolso: "Reembolso",
  bono_orden_entregada: "Bono por pedido entregado",
  canje: "Canje",
  devolucion: "Devolución de canje",
};

export function points(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  return new Intl.NumberFormat("es-MX").format(value);
}

export function money(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

export function movementLabel(tipo: string) {
  return MOVEMENTS[tipo] ?? tipo;
}

export function signedPoints(value: number) {
  const formatted = points(Math.abs(value));
  if (value > 0) {
    return `+${formatted}`;
  }

  if (value < 0) {
    return `-${formatted}`;
  }

  return formatted;
}
