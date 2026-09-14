import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Request-scoped Supabase client that reads/writes the auth cookie.
 * Use in Server Components, Route Handlers, and Server Actions for
 * RLS-gated access on behalf of the signed-in user.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
            // Session refresh is handled in middleware/route handlers instead.
          }
        },
      },
    },
  );
}

/**
 * Service-role client that BYPASSES RLS. Server-only.
 * Never import this into client components or expose the key to the browser.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * Anonymous, cookie-free client for the **public marketing pages**.
 *
 * `createClient()` above reads the auth cookie, which opts the calling Server
 * Component into dynamic rendering — wrong for `/about`, which has no session
 * to read and should stay cacheable. This one carries no session at all, so it
 * is always the `anon` role and sees exactly what a signed-out visitor sees.
 *
 * Use it only for genuinely public data (`volunteers_public`). Anything
 * user-scoped needs `createClient()`; anything privileged needs
 * `createServiceRoleClient()` inside `src/app/api/admin/**`.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
