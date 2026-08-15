import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/portal";

type OnboardingInvite = {
  fullName: string | null;
  role: UserRole;
  cohortIds: string[];
  cohortNames: string[];
};

const claimSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  wechatNumber: z.string().trim().max(100).nullable().optional(),
  avatarUrl: z.string().trim().url().max(2048).nullable().optional(),
});

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;
  return { supabase, user };
}

function claimError(message: string) {
  if (message.includes("INVITE_NOT_FOUND")) {
    return "没有找到与当前登录邮箱匹配的有效邀请。";
  }
  if (message.includes("INVITE_ROLE_CONFLICT")) {
    return "该邮箱存在身份冲突，请联系管理员处理。";
  }
  if (message.includes("INVALID_PROFILE")) {
    return "请填写有效的姓名。";
  }
  return "暂时无法完成注册，请稍后重试。";
}

export async function GET() {
  const auth = await authenticatedClient();
  if (!auth) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const { data, error } = await auth.supabase.rpc("get_onboarding_invite");
  if (error) {
    return NextResponse.json(
      { error: claimError(error.message) },
      { status: 400 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "没有找到与当前登录邮箱匹配的有效邀请。" },
      { status: 404 },
    );
  }

  return NextResponse.json({ invite: data as OnboardingInvite });
}

export async function POST(request: Request) {
  const auth = await authenticatedClient();
  if (!auth) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const parsed = claimSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "请检查姓名、微信号和头像后重试。" },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase.rpc("claim_roster_invite", {
    p_full_name: parsed.data.fullName,
    p_wechat_number: parsed.data.wechatNumber || null,
    p_avatar_url: parsed.data.avatarUrl || null,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: claimError(error?.message ?? "") },
      { status: 400 },
    );
  }

  return NextResponse.json({ profile: data as Profile });
}
