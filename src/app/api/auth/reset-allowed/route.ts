import { NextResponse } from "next/server";
import { z } from "zod";
import { isBannedUser } from "@/lib/supabase/banned";
import { createServiceRoleClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.email().max(320).transform((value) => value.trim().toLowerCase()),
});

/**
 * Whether a password-reset email may be sent to this address. Banned accounts
 * (removed members) get `false`, so the forgot-password page sends nothing.
 * Lookup failures answer `true`: the ban itself is enforced in the middleware,
 * and a hiccup here must not stop a real member from resetting a password.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ allowed: true });

  const service = createServiceRoleClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id")
    .ilike("email", parsed.data.email.replace(/[\\%_]/g, "\\$&"))
    .limit(1)
    .maybeSingle();
  if (!profile) return NextResponse.json({ allowed: true });

  const { data, error } = await service.auth.admin.getUserById(profile.id);
  if (error || !data.user) return NextResponse.json({ allowed: true });
  return NextResponse.json({ allowed: !isBannedUser(data.user) });
}
