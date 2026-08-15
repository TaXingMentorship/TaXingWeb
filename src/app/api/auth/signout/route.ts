import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json(
      { error: "退出登录失败，请重试。" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(new URL("/portal/login", request.url), {
    status: 303,
  });
}
