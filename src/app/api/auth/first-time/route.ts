import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.email().max(320).transform((value) => value.trim().toLowerCase()),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "请输入有效的邮箱地址。" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data: invite, error: inviteLookupError } = await service
    .from("roster_invites")
    .select("id")
    .ilike("email", parsed.data.email)
    .limit(1)
    .maybeSingle();

  if (inviteLookupError) {
    console.error("读取首次登录邀请失败:", inviteLookupError.message);
    return NextResponse.json(
      { error: "暂时无法发送设置邮件，请稍后重试。" },
      { status: 500 },
    );
  }

  if (!invite) {
    return NextResponse.json({ sent: true });
  }

  const callbackUrl = new URL("/portal/auth/callback", request.url);
  callbackUrl.searchParams.set("next", "/portal/password/setup");
  const { error: authError } = await service.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { redirectTo: callbackUrl.toString() },
  );

  if (authError?.code === "email_exists" || authError?.code === "user_already_exists") {
    const { error: resetError } = await service.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: callbackUrl.toString() },
    );
    if (resetError) {
      console.error("发送首次登录重置邮件失败:", resetError.message);
      return NextResponse.json(
        { error: "暂时无法发送设置邮件，请稍后重试。" },
        { status: 500 },
      );
    }
  } else if (authError) {
    console.error("发送首次登录邀请失败:", authError.message);
    return NextResponse.json(
      { error: "暂时无法发送设置邮件，请稍后重试。" },
      { status: 500 },
    );
  }

  return NextResponse.json({ sent: true });
}
