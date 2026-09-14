"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ParticipantRole, Persona, Profile } from "@/types/portal";
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
  /**
   * The signed-in profile **as projected through the active persona**. Pages
   * read this and get persona filtering for free: an admin previewing as a
   * mentee sees `is_admin: false` here, so every `if (!currentUser?.is_admin)`
   * guard and every `canAccessPortalNav` call follows along with no changes.
   */
  currentUser: Profile | null;
  /** The real profile, unprojected. For the avatar, the name, and the switcher. */
  realUser: Profile | null;
  authUser: PortalAuthUser | null;
  role: ParticipantRole | null;
  isAdmin: boolean;
  isVolunteer: boolean;
  persona: Persona | null;
  /** Personas this user may preview; length <= 1 hides the switcher. */
  availablePersonas: Persona[];
  setPersona: (persona: Persona) => void;
  /** True when the active persona is not the user's primary identity. */
  isViewingAs: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const PERSONA_STORAGE_KEY = "taxing.portal.persona";

/**
 * Admins may preview every persona — that is the point of the feature. Everyone
 * else may only select an identity they actually hold, which for most people is
 * exactly one, and the switcher hides itself.
 */
export function availablePersonasFor(profile: Profile | null): Persona[] {
  if (!profile) return [];
  if (profile.is_admin) return ["admin", "mentor", "mentee", "volunteer"];

  const personas: Persona[] = [];
  if (profile.participant_role) personas.push(profile.participant_role);
  if (profile.is_volunteer) personas.push("volunteer");
  return personas;
}

/** The persona a user lands on before choosing anything. */
export function primaryPersonaFor(profile: Profile | null): Persona | null {
  if (!profile) return null;
  if (profile.is_admin) return "admin";
  if (profile.participant_role) return profile.participant_role;
  if (profile.is_volunteer) return "volunteer";
  return null;
}

/**
 * Rewrites the identity flags to match the persona, leaving everything else
 * (name, avatar, cohorts, bio) untouched — the person is the same, only the
 * lens changes.
 */
function projectProfile(profile: Profile, persona: Persona): Profile {
  return {
    ...profile,
    is_admin: persona === "admin",
    is_volunteer: persona === "volunteer",
    participant_role:
      persona === "mentor" || persona === "mentee" ? persona : null,
  };
}

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

  const realUser = session?.profile ?? null;
  const availablePersonas = React.useMemo(
    () => availablePersonasFor(realUser),
    [realUser],
  );
  const primaryPersona = primaryPersonaFor(realUser);

  // sessionStorage, not localStorage: a preview lens should not silently
  // survive into next week's visit. Reading it can throw in a private window,
  // so a failure just means "use the primary persona".
  const [storedPersona, setStoredPersona] = React.useState<Persona | null>(null);
  React.useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(PERSONA_STORAGE_KEY);
      if (saved) setStoredPersona(saved as Persona);
    } catch {
      // Storage unavailable — stay on the primary persona.
    }
  }, []);

  const persona =
    storedPersona && availablePersonas.includes(storedPersona)
      ? storedPersona
      : primaryPersona;

  const setPersona = React.useCallback((next: Persona) => {
    setStoredPersona(next);
    try {
      window.sessionStorage.setItem(PERSONA_STORAGE_KEY, next);
    } catch {
      // Remembering the lens is a convenience; failing to is not an error.
    }
  }, []);

  const projected = React.useMemo(
    () => (realUser && persona ? projectProfile(realUser, persona) : realUser),
    [realUser, persona],
  );

  const value = React.useMemo<PortalSessionContextValue>(
    () => ({
      currentUser: projected,
      realUser,
      authUser: session?.user ?? null,
      role: projected?.participant_role ?? null,
      isAdmin: projected?.is_admin ?? false,
      isVolunteer: projected?.is_volunteer ?? false,
      persona,
      availablePersonas,
      setPersona,
      isViewingAs: Boolean(persona && primaryPersona && persona !== primaryPersona),
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
        try {
          window.sessionStorage.removeItem(PERSONA_STORAGE_KEY);
        } catch {
          // Nothing to clean up if storage is unavailable.
        }
        window.location.assign(response.url || "/portal/login");
      },
    }),
    [
      availablePersonas,
      isLoading,
      persona,
      primaryPersona,
      projected,
      queryClient,
      realUser,
      session,
      setPersona,
    ],
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
