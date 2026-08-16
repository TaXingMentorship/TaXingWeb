"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ParticipantRole, Profile } from "@/types/portal";
import { createClient } from "@/lib/supabase/client";

export type PortalAuthUser = {
  id: string;
  email: string | null;
};

export type PortalSession = {
  user: PortalAuthUser | null;
  profile: Profile | null;
};

type PortalSessionContextValue = {
  currentUser: Profile | null;
  authUser: PortalAuthUser | null;
  role: ParticipantRole | null;
  isAdmin: boolean;
  isVolunteer: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const PortalSessionContext =
  React.createContext<PortalSessionContextValue | null>(null);

export function PortalSessionProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession?: PortalSession;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const router = useRouter();

  React.useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;

      setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: ["portal", "currentUser"],
        });
        router.refresh();
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, [queryClient, router, supabase]);

  const { data: session, isLoading } = useQuery({
    queryKey: ["portal", "currentUser"],
    initialData: initialSession,
    queryFn: async (): Promise<PortalSession> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return { user: null, profile: null };

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      return {
        user: { id: user.id, email: user.email ?? null },
        profile: (profile as Profile | null) ?? null,
      };
    },
  });

  const value = React.useMemo<PortalSessionContextValue>(
    () => ({
      currentUser: session?.profile ?? null,
      authUser: session?.user ?? null,
      role: session?.profile?.participant_role ?? null,
      isAdmin: session?.profile?.is_admin ?? false,
      isVolunteer: session?.profile?.is_volunteer ?? false,
      loading: isLoading,
      refresh: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["portal", "currentUser"],
        });
      },
      signOut: async () => {
        const response = await fetch("/api/auth/signout", {
          method: "POST",
          credentials: "same-origin",
        });
        if (!response.ok) {
          throw new Error("退出登录失败，请重试。");
        }
        queryClient.removeQueries({ queryKey: ["portal"] });
        window.location.assign(response.url || "/portal/login");
      },
    }),
    [isLoading, queryClient, session],
  );

  return (
    <PortalSessionContext.Provider value={value}>
      {children}
    </PortalSessionContext.Provider>
  );
}

export function usePortalSession(): PortalSessionContextValue {
  const ctx = React.useContext(PortalSessionContext);
  if (!ctx) {
    throw new Error("usePortalSession 必须在 PortalSessionProvider 内使用");
  }
  return ctx;
}
