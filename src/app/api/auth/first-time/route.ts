import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { AuthError, User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.email().max(320).transform((value) => value.trim().toLowerCase()),
  activationCode: z.string().min(12).max(200),
  password: z.string().min(8).max(72),
});

function secretsMatch(provided: string, expected: string): boolean {
  const providedHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "请检查邮箱、激活码和新密码。" },
      { status: 400 },
    );
  }

  const activationCode = process.env.PORTAL_ACTIVATION_CODE;
  if (!activationCode) {
    console.error("PORTAL_ACTIVATION_CODE is not configured.");
    return NextResponse.json(
      { error: "会员激活暂不可用，请联系管理员。" },
      { status: 503 },
    );
  }
  if (!secretsMatch(parsed.data.activationCode, activationCode)) {
    return NextResponse.json(
      { error: "受邀邮箱或激活码不正确。" },
      { status: 403 },
    );
  }

  const service = createServiceRoleClient();
  const { data: invite, error: inviteLookupError } = await service
    .from("roster_invites")
    .select("id")
    .eq("email", parsed.data.email)
    .is("claimed_user_id", null)
    .limit(1)
    .maybeSingle();

  if (inviteLookupError) {
    console.error("读取会员激活邀请失败:", inviteLookupError.message);
    return NextResponse.json(
      { error: "暂时无法激活账号，请稍后重试。" },
      { status: 500 },
    );
  }

  if (!invite) {
    return NextResponse.json(
      { error: "受邀邮箱或激活码不正确。" },
      { status: 403 },
    );
  }

  const { data: created, error: createError } =
    await service.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
    });
  let userId = created.user?.id;

  if (
    createError?.code === "email_exists" ||
    createError?.code === "user_already_exists"
  ) {
    let existingUser: User | undefined;
    let listError: AuthError | null = null;
    const perPage = 200;
    for (let page = 1; !existingUser; page += 1) {
      const { data, error } = await service.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) {
        listError = error;
        break;
      }
      existingUser = data.users.find(
        (user) => user.email?.toLowerCase() === parsed.data.email,
      );
      if (data.users.length < perPage) break;
    }
    if (listError || !existingUser) {
      console.error(
        "查找待激活会员账号失败:",
        listError?.message ?? "user not found",
      );
      return NextResponse.json(
        { error: "暂时无法激活账号，请联系管理员。" },
        { status: 500 },
      );
    }

    const { data: existingProfile, error: profileError } = await service
      .from("profiles")
      .select("id")
      .eq("id", existingUser.id)
      .maybeSingle();
    if (profileError) {
      console.error("检查已激活会员资料失败:", profileError.message);
      return NextResponse.json(
        { error: "暂时无法激活账号，请稍后重试。" },
        { status: 500 },
      );
    }
    if (existingProfile) {
      return NextResponse.json(
        { error: "该账号已激活，请直接登录或使用忘记密码。" },
        { status: 409 },
      );
    }

    userId = existingUser.id;
    const { error: updateError } = await service.auth.admin.updateUserById(
      existingUser.id,
      { password: parsed.data.password, email_confirm: true },
    );
    if (updateError) {
      console.error("更新待激活会员账号失败:", updateError.message);
      return NextResponse.json(
        { error: "暂时无法激活账号，请稍后重试。" },
        { status: 500 },
      );
    }
  } else if (createError || !userId) {
    console.error("创建会员账号失败:", createError?.message ?? "no user");
    return NextResponse.json(
      { error: "暂时无法激活账号，请稍后重试。" },
      { status: 500 },
    );
  }

  const { error: claimError } = await service
    .from("roster_invites")
    .update({ claimed_user_id: userId })
    .eq("email", parsed.data.email)
    .is("claimed_user_id", null);
  if (claimError) {
    console.error("预留会员邀请失败:", claimError.message);
    return NextResponse.json(
      { error: "账号已创建，请使用私人密码直接登录。" },
      { status: 500 },
    );
  }

  return NextResponse.json({ activated: true });
}
