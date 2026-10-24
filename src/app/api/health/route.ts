import { connection } from "next/server";

const SERVER_ENV = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "CRON_SECRET",
  "FAKEAPI_KEY",
] as const;

export async function GET() {
  await connection();

  const missing = SERVER_ENV.filter((name) => !process.env[name]);

  return Response.json({
    ok: missing.length === 0,
    missing,
  });
}
