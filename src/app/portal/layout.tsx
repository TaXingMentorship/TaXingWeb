import * as React from "react";
import {
  PortalSessionProvider,
  type PortalSession,
} from "@/components/portal/PortalSessionProvider";
import PortalShell from "@/components/portal/PortalShell";
import { getCurrentUser } from "@/lib/auth";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentUser();
  const initialSession: PortalSession = {
    user: currentUser
      ? { id: currentUser.id, email: currentUser.email }
      : null,
    profile: currentUser?.profile ?? null,
  };

  return (
    <PortalSessionProvider initialSession={initialSession}>
      <PortalShell>{children}</PortalShell>
    </PortalSessionProvider>
  );
}
