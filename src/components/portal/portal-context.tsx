"use client";

import { createContext, useContext } from "react";
import type { PortalSession } from "@/domain/panel";

type PortalState = {
  session: PortalSession;
  refresh: () => Promise<PortalSession>;
};

const PortalContext = createContext<PortalState | null>(null);

export function PortalProvider({ value, children }: { value: PortalState; children: React.ReactNode }) {
  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal() {
  const value = useContext(PortalContext);
  if (!value) {
    throw new Error("El portal no tiene sesión.");
  }

  return value;
}
