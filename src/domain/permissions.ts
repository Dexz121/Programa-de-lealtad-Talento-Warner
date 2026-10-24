export const PERMISSIONS = [
  { id: "ver_resumen", label: "Ver resumen del panel" },
  { id: "buscar_cliente", label: "Buscar cliente y ver puntos, nivel e historial" },
  { id: "ver_montos", label: "Ver montos (gasto en MXN, pedidos y pagos)" },
  { id: "ver_riesgo_cumpleanos", label: "Ver listas de riesgo y cumpleaños" },
  { id: "exportar_reportes", label: "Exportar reportes (CSV)" },
  { id: "gestionar_catalogo", label: "Gestionar catálogo de recompensas" },
  { id: "gestionar_canjes", label: "Gestionar canjes (entregar, aplicar cupón, cancelar)" },
  { id: "generar_acceso_portal", label: "Generar o restablecer acceso al portal de un cliente" },
  { id: "ejecutar_sincronizacion", label: "Ejecutar sincronización" },
  { id: "gestionar_usuarios", label: "Gestionar usuarios" },
  { id: "gestionar_roles", label: "Gestionar roles y permisos" },
  { id: "gestionar_tokens", label: "Gestionar tokens de API" },
] as const;

export type PermissionId = (typeof PERMISSIONS)[number]["id"];

const ALL_PERMISSIONS: PermissionId[] = PERMISSIONS.map((permission) => permission.id);

const STAFF_SHARED: PermissionId[] = [
  "ver_resumen",
  "buscar_cliente",
  "ver_montos",
  "ver_riesgo_cumpleanos",
  "exportar_reportes",
  "gestionar_catalogo",
  "gestionar_canjes",
  "generar_acceso_portal",
];

const ATENCION: PermissionId[] = [
  "ver_resumen",
  "buscar_cliente",
  "ver_riesgo_cumpleanos",
  "gestionar_canjes",
  "generar_acceso_portal",
];

export const INITIAL_ROLES = [
  {
    id: "administrador",
    name: "Administrador",
    permissions: ALL_PERMISSIONS,
  },
  {
    id: "gerente",
    name: "Gerente",
    permissions: STAFF_SHARED,
  },
  {
    id: "atencion_a_clientes",
    name: "Atención a clientes",
    permissions: ATENCION,
  },
] as const;
