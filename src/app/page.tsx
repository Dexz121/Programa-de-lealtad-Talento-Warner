import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

async function RedirectToLogin() {
  await connection();
  redirect("/login");
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <RedirectToLogin />
    </Suspense>
  );
}
