import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import type { UserRole } from "@/types/portal";

export async function requireApiRole(roles: UserRole | UserRole[]) {
  try {
    return await requireRole(roles);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    }
    return NextResponse.json({ error: "没有权限执行此操作。" }, { status: 403 });
  }
}

export function invalidBody(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function databaseError(operation: string, message?: string) {
  console.error(`${operation}: ${message ?? "unknown database error"}`);
  return NextResponse.json(
    { error: `${operation}失败，请检查数据后重试。` },
    { status: 400 },
  );
}
