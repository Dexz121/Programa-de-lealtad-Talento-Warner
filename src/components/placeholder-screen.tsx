import Link from "next/link";

type PlaceholderScreenProps = {
  title: string;
  description: string;
};

export function PlaceholderScreen({ title, description }: PlaceholderScreenProps) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-zinc-500">Programa de lealtad</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-zinc-600">{description}</p>
      <nav className="mt-8 text-sm">
        <Link className="underline" href="/login">
          Iniciar sesión
        </Link>
      </nav>
    </main>
  );
}
