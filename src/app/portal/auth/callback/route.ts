import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null, fallback = "/portal") {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : fallback;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const destination = new URL(
        safeNextPath(url.searchParams.get("next"), "/portal/password/setup"),
        url.origin,
      );
      return NextResponse.redirect(
        destination.origin === url.origin
          ? destination
          : new URL("/portal", url.origin),
      );
    }
  }

  const loginUrl = new URL("/portal/login", url.origin);
  loginUrl.searchParams.set("error", "auth_callback");
  return NextResponse.redirect(loginUrl);
}
