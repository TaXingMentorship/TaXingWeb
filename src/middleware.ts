import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PORTAL_PATHS = [
  "/portal/login",
  "/portal/auth/callback",
  "/portal/password/first-time",
  "/portal/password/forgot",
];
const PROFILE_OPTIONAL_PATHS = [
  "/portal/onboarding",
  "/portal/password/setup",
  "/portal/password/update",
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (request.nextUrl.pathname === "/") {
    const code = request.nextUrl.searchParams.get("code");
    if (!code) return response;

    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/portal/auth/callback";
    return NextResponse.redirect(callbackUrl);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPortalPath = PUBLIC_PORTAL_PATHS.includes(
    request.nextUrl.pathname,
  );

  const redirectWithCookies = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) =>
      redirect.cookies.set(cookie),
    );
    return redirect;
  };

  if (!user && !isPublicPortalPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/portal/login";
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );

    return redirectWithCookies(loginUrl);
  }

  if (user && !isPublicPortalPath) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    const isOnboarding = request.nextUrl.pathname === "/portal/onboarding";
    const profileIsOptional = PROFILE_OPTIONAL_PATHS.includes(
      request.nextUrl.pathname,
    );

    if (!profile && !profileIsOptional) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/portal/onboarding";
      onboardingUrl.search = "";
      return redirectWithCookies(onboardingUrl);
    }

    if (profile && isOnboarding) {
      const portalUrl = request.nextUrl.clone();
      portalUrl.pathname = "/portal";
      portalUrl.search = "";
      return redirectWithCookies(portalUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/", "/portal/:path*"],
};
