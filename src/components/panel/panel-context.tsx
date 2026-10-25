"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PanelSession } from "@/domain/panel";

type PanelContextValue = {
  staff: PanelSession;
  onUnauthorized: () => void;
};

const PanelContext = createContext<PanelContextValue | null>(null);

export function PanelProvider({
  value,
  children,
}: {
  value: PanelContextValue;
  children: ReactNode;
}) {
  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}

export function usePanelContext() {
  const value = useContext(PanelContext);
  if (!value) {
    throw new Error("El panel no está listo.");
  }

  return value;
}
