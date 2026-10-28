import type { Level } from "@/domain/panel";

const LEVEL_TONE: Record<Level, string> = {
  Bronce: "bg-orange-100 text-orange-950",
  Plata: "bg-zinc-200 text-zinc-800",
  Oro: "bg-amber-100 text-amber-950",
};

export function LevelBadge({ level }: { level: Level }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_TONE[level]}`}>
      {level}
    </span>
  );
}
