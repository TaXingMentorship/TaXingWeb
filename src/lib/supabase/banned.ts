/** True while Supabase Auth has the account banned (admins ban accounts to remove portal access). */
export function isBannedUser(user: { banned_until?: string | null }): boolean {
  if (!user.banned_until) return false;
  const until = Date.parse(user.banned_until);
  return Number.isFinite(until) && until > Date.now();
}
