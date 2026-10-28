import type { Level, MovementItem, PortalStatus, RedemptionItem, RewardItem } from "@/domain/panel";

export type PortalCustomer = {
  nombre: string;
  email: string;
  nivel: Level;
  puntos: number;
  puntosDisponibles: number;
  portal: PortalStatus;
};

export const portalCustomer: PortalCustomer = {
  nombre: "Ana López",
  email: "ana.lopez@ejemplo.com",
  nivel: "Plata",
  puntos: 2480,
  puntosDisponibles: 1800,
  portal: "activo",
};

export const portalRewards: RewardItem[] = [
  {
    id: "taza",
    tipo: "producto",
    nombre: "Taza de cerámica",
    descripcion: "Taza de 350 ml con el sello de la tienda.",
    puntosRequeridos: 800,
    stock: 12,
    nivelMinimo: "Bronce",
    limitePorCliente: 2,
    activo: true,
    fotoUrl: null,
    descuentoTipo: null,
    descuentoValor: null,
    compraMinima: null,
    vigenciaDias: null,
  },
  {
    id: "envio",
    tipo: "descuento",
    nombre: "15% en tu siguiente compra",
    descripcion: "Cupón de un solo uso sobre el subtotal.",
    puntosRequeridos: 500,
    stock: null,
    nivelMinimo: "Plata",
    limitePorCliente: 1,
    activo: true,
    fotoUrl: null,
    descuentoTipo: "porcentaje",
    descuentoValor: 15,
    compraMinima: 400,
    vigenciaDias: 30,
  },
  {
    id: "audifonos",
    tipo: "producto",
    nombre: "Audífonos inalámbricos",
    descripcion: "Entrega en tienda cuando el equipo marque el canje.",
    puntosRequeridos: 2200,
    stock: 0,
    nivelMinimo: "Oro",
    limitePorCliente: 1,
    activo: true,
    fotoUrl: null,
    descuentoTipo: null,
    descuentoValor: null,
    compraMinima: null,
    vigenciaDias: null,
  },
];

export const portalRedemptions: RedemptionItem[] = [
  {
    id: "canje-1001",
    customerId: "241",
    cliente: portalCustomer.nombre,
    rewardId: "taza",
    recompensa: "Taza de cerámica",
    rewardTipo: "producto",
    puntos: 800,
    estado: "pendiente",
    couponCode: null,
    vence: null,
    fecha: "2026-10-21",
  },
  {
    id: "canje-1002",
    customerId: "241",
    cliente: portalCustomer.nombre,
    rewardId: "envio",
    recompensa: "15% en tu siguiente compra",
    rewardTipo: "descuento",
    puntos: 500,
    estado: "vigente",
    couponCode: "ANA15-OCT",
    vence: "2026-11-20",
    fecha: "2026-10-18",
  },
  {
    id: "canje-1003",
    customerId: "241",
    cliente: portalCustomer.nombre,
    rewardId: "taza",
    recompensa: "Taza de cerámica",
    rewardTipo: "producto",
    puntos: 800,
    estado: "entregado",
    couponCode: null,
    vence: null,
    fecha: "2026-09-02",
  },
  {
    id: "canje-1004",
    customerId: "241",
    cliente: portalCustomer.nombre,
    rewardId: "envio",
    recompensa: "15% en tu siguiente compra",
    rewardTipo: "descuento",
    puntos: 500,
    estado: "usado",
    couponCode: "ANA15-SEP",
    vence: "2026-10-01",
    fecha: "2026-09-01",
  },
  {
    id: "canje-1005",
    customerId: "241",
    cliente: portalCustomer.nombre,
    rewardId: "taza",
    recompensa: "Taza de cerámica",
    rewardTipo: "producto",
    puntos: 800,
    estado: "cancelado",
    couponCode: null,
    vence: null,
    fecha: "2026-08-12",
  },
  {
    id: "canje-1006",
    customerId: "241",
    cliente: portalCustomer.nombre,
    rewardId: "envio",
    recompensa: "15% en tu siguiente compra",
    rewardTipo: "descuento",
    puntos: 500,
    estado: "vencido",
    couponCode: "ANA15-JUL",
    vence: "2026-08-01",
    fecha: "2026-07-02",
  },
];

export const portalMovements: MovementItem[] = [
  { fecha: "2026-10-20", tipo: "pago", referencia: "pago-8841", puntos: 320 },
  { fecha: "2026-10-18", tipo: "bono_orden_entregada", referencia: "pedido-5520", puntos: 50 },
  { fecha: "2026-10-02", tipo: "canje", referencia: "canje-1002", puntos: -500 },
  { fecha: "2026-09-28", tipo: "pago", referencia: "pago-8702", puntos: 180 },
  { fecha: "2026-09-15", tipo: "reembolso", referencia: "pago-8610", puntos: -40 },
];
