import { GoogleAuth } from "google-auth-library";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const ROLES = [
  {
    id: "administrador",
    name: "Administrador",
    permissions: [
      "ver_resumen",
      "buscar_cliente",
      "ver_montos",
      "ver_riesgo_cumpleanos",
      "exportar_reportes",
      "gestionar_catalogo",
      "gestionar_canjes",
      "generar_acceso_portal",
      "ejecutar_sincronizacion",
      "gestionar_usuarios",
      "gestionar_roles",
      "gestionar_tokens",
    ],
  },
  {
    id: "gerente",
    name: "Gerente",
    permissions: [
      "ver_resumen",
      "buscar_cliente",
      "ver_montos",
      "ver_riesgo_cumpleanos",
      "exportar_reportes",
      "gestionar_catalogo",
      "gestionar_canjes",
      "generar_acceso_portal",
    ],
  },
  {
    id: "atencion_a_clientes",
    name: "Atención a clientes",
    permissions: [
      "ver_resumen",
      "buscar_cliente",
      "ver_riesgo_cumpleanos",
      "gestionar_canjes",
      "generar_acceso_portal",
    ],
  },
];

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;

if (!projectId || !clientEmail || !privateKey || !email || !password) {
  console.error(
    "Faltan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, SEED_ADMIN_EMAIL o SEED_ADMIN_PASSWORD.",
  );
  process.exit(1);
}

const AUTHORIZED_DOMAINS = [
  "localhost",
  `${projectId}.firebaseapp.com`,
  `${projectId}.web.app`,
  "programa-de-lealtad-talento-warner.vercel.app",
];

async function accessToken() {
  const googleAuth = new GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await googleAuth.getClient();
  const token = await client.getAccessToken();

  if (!token.token) {
    throw new Error("No se pudo obtener un token para configurar Firebase Auth.");
  }

  return token.token;
}

async function identityToolkit(token, url, { method = "GET", body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();

  if (!response.ok) {
    const error = new Error(`Identity Toolkit respondió ${response.status}.`);
    error.status = response.status;
    error.body = text;
    throw error;
  }

  return text ? JSON.parse(text) : null;
}

async function ensureEmailPasswordAuth() {
  const token = await accessToken();
  const configUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;

  await identityToolkit(
    token,
    `https://serviceusage.googleapis.com/v1/projects/${projectId}/services/identitytoolkit.googleapis.com:enable`,
    { method: "POST", body: {} },
  ).catch(() => {});

  let config;

  try {
    config = await identityToolkit(token, configUrl);
  } catch (error) {
    const missing =
      error.status === 404 || error.body?.includes("CONFIGURATION_NOT_FOUND");

    if (!missing) {
      throw error;
    }

    throw new Error(
      "Firebase Authentication no está activado. Entra a la consola con la cuenta dueña del proyecto, abre Authentication y pulsa Comenzar. Después vuelve a correr: node --env-file=.env.local scripts/seed-admin.mjs",
    );
  }

  const domains = new Set([...(config.authorizedDomains ?? []), ...AUTHORIZED_DOMAINS]);

  await identityToolkit(
    token,
    `${configUrl}?updateMask=signIn.email.enabled,signIn.email.passwordRequired,authorizedDomains`,
    {
      method: "PATCH",
      body: {
        signIn: {
          email: {
            enabled: true,
            passwordRequired: true,
          },
        },
        authorizedDomains: [...domains],
      },
    },
  );
}

await ensureEmailPasswordAuth();

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });

const auth = getAuth(app);
const db = getFirestore(app);

let user;

try {
  user = await auth.getUserByEmail(email);
  await auth.updateUser(user.uid, {
    password,
    emailVerified: true,
    displayName: "Administrador",
  });
} catch (error) {
  if (error?.code !== "auth/user-not-found") {
    throw error;
  }

  user = await auth.createUser({
    email,
    password,
    emailVerified: true,
    displayName: "Administrador",
  });
}

for (const role of ROLES) {
  await db.collection("roles").doc(role.id).set(
    {
      name: role.name,
      permissions: role.permissions,
    },
    { merge: true },
  );
}

await db.collection("staffUsers").doc(user.uid).set(
  {
    email,
    roleId: "administrador",
    roleName: "Administrador",
  },
  { merge: true },
);

console.log(`Cuenta lista: ${email} (${user.uid})`);
