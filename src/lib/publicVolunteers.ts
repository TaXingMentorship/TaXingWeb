import { createPublicClient } from "@/lib/supabase/server";
import type { PublicVolunteer } from "@/types/portal";

/**
 * The volunteer acknowledgement list for the public /about page.
 *
 * Server-only. This is the marketing site's one Supabase read, so it does not
 * belong in `src/lib/portal/store.ts` — that file is `"use client"` and scoped
 * to the auth-gated portal.
 *
 * `volunteers_public` is a SECURITY DEFINER view exposing only the name and the
 * season names (migration 0010). Email, WeChat and notes are not columns of it,
 * so no filtering is needed here to keep them off a page anyone can read.
 */
export async function listPublicVolunteers(): Promise<PublicVolunteer[]> {
  try {
    const { data, error } = await createPublicClient()
      .from("volunteers_public")
      .select("id, full_name, seasons")
      .order("full_name", { ascending: true });

    if (error) {
      // A missing table or an outage must not take down the whole About page;
      // the section renders its empty state instead.
      console.error(`读取志愿者名单失败：${error.message}`);
      return [];
    }
    return (data ?? []) as PublicVolunteer[];
  } catch (error) {
    console.error(
      `读取志愿者名单失败：${error instanceof Error ? error.message : "unknown"}`,
    );
    return [];
  }
}
