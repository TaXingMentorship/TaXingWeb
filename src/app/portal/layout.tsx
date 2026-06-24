"use client";

import * as React from "react";
import { PortalSessionProvider } from "@/components/portal/PortalSessionProvider";
import PortalShell from "@/components/portal/PortalShell";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalSessionProvider>
      <PortalShell>{children}</PortalShell>
    </PortalSessionProvider>
  );
}
