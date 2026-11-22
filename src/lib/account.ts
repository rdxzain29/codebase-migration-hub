import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Account = { id: string; email: string; name: string; provider: string };

/** undefined = still checking, null = signed out. */
let current: Account | null | undefined;
let started = false;
const listeners = new Set<() => void>();

function toAccount(user: User | null | undefined): Account | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const email = user.email ?? "";
  const named = [meta["full_name"], meta["name"], meta["display_name"]].find(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );
  return {
    id: user.id,
    email,
    name: (named ?? email.split("@")[0] ?? "Reader").trim().slice(0, 60),
    provider: String((user.app_metadata as Record<string, unknown> | undefined)?.["provider"] ?? "email"),
  };
}

function set(next: Account | null) {
  current = next;
  listeners.forEach((l) => l());
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  void supabase.auth.getSession().then(({ data }) => set(toAccount(data.session?.user)));
  supabase.auth.onAuthStateChange((_event, session) => set(toAccount(session?.user)));
}

function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** The signed-in reader (display only — the server re-checks every protected action). */
export function useAccount(): Account | null | undefined {
  return useSyncExternalStore(subscribe, () => current, () => undefined);
}
