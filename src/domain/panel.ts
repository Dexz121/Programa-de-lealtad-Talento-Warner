import type { PermissionId } from "@/domain/permissions";

export const LEVELS = ["Bronce", "Plata", "Oro"] as const;

export type Level = (typeof LEVELS)[number];

export type PortalStatus = "sin acceso" | "temporal" | "activo";

export type PanelSession = {
  email: string;
  displayName: string;
  roleId: string;
  roleName: string;
  permissions: PermissionId[];
};

export type CustomerListItem = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  dob: string;
  portal: PortalStatus;
  nivel: Level | null;
  puntos: number | null;
  puntosDisponibles: number | null;
  enRiesgo: boolean | null;
  diasSinActividad: number | null;
  gasto12m?: number;
};

export type MovementItem = {
  fecha: string;
  tipo: string;
  referencia: string;
  puntos: number;
};

export type OrderItem = {
  id: string;
  fecha: string;
  estado: string;
  pago: string;
  total: number | null;
  moneda: string;
};

export type PaymentItem = {
  id: string;
  fecha: string;
  estado: string;
  monto: number | null;
  moneda: string;
};

export type RewardItem = {
  id: string;
  tipo: "producto" | "descuento";
  nombre: string;
  descripcion: string;
  puntosRequeridos: number;
  stock: number | null;
  nivelMinimo: Level;
  limitePorCliente: number | null;
  activo: boolean;
  fotoUrl: string | null;
  descuentoTipo: "porcentaje" | "monto" | null;
  descuentoValor: number | null;
  compraMinima: number | null;
  vigenciaDias: number | null;
};

export type RedemptionItem = {
  id: string;
  customerId: string;
  cliente: string;
  rewardId: string;
  recompensa: string;
  rewardTipo: "producto" | "descuento";
  puntos: number;
  estado: string;
  couponCode: string | null;
  vence: string | null;
  fecha: string;
};

export type StaffItem = {
  uid: string;
  email: string;
  displayName: string;
  roleId: string;
  roleName: string;
  active: boolean;
};

export type RoleItem = {
  id: string;
  name: string;
  permissions: PermissionId[];
};

export type TokenItem = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  revoked: boolean;
};

export type SyncRunItem = {
  id: string;
  inicio: string;
  fin: string;
  requests: number;
  resultado: string;
};

export type PortalSession = {
  uid: string;
  customerId: string;
  nombre: string;
  email: string;
  portal: PortalStatus;
  mustChangePassword: boolean;
  nivel: Level | null;
  puntos: number | null;
  puntosDisponibles: number | null;
};

export function isLevel(value: string): value is Level {
  return (LEVELS as readonly string[]).includes(value);
}
