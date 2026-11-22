import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { claimLegacyIdentity } from "@/lib/auth.functions";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set New Password — Novels Forever" },
      { name: "description", content: "Choose a new password for your Novels Forever account." },
      { property: "og:title", content: "Set New Password — Novels Forever" },
      { property: "og:description", content: "Choose a new password for your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const claimIdentity = useServerFn(claimLegacyIdentity);
  const [ready, setReady] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(`${window.location.search.slice(1)}&${window.location.hash.slice(1)}`);
    const linkType = params.get("type");
    // A reset link that was already used or has expired comes back with an error in the address.
    if (params.get("error_code") || params.get("error")) setLinkFailed(true);
    if (linkType === "recovery" || linkType === "invite" || linkType === "signup") {
      setReady(true);
    }
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    void supabase.auth.getUser().then(({ data: result, error }) => {
      if (active && !error && result.user?.email_confirmed_at) setReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Re-links a migrated account when it matches; never blocks the password change.
      await claimIdentity({ data: {} }).catch(() => undefined);
      const { data: auth } = await supabase.auth.getUser();
      const { data: role } = auth.user
        ? await supabase.from("user_roles").select("role").eq("user_id", auth.user.id).eq("role", "admin").maybeSingle()
        : { data: null };
      toast.success("Password updated.");
      await navigate({ to: role?.role === "admin" ? "/admin" : "/", replace: true });
    } catch {
      toast.error("Could not update the password. Please open the reset link again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <div className="gold-frame rounded-2xl bg-card-grad p-8">
        <h1 className="font-display text-4xl font-semibold">Set a new password</h1>
        {ready ? (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              aria-label="New password"
              autoComplete="new-password"
            />
            <Button type="submit" variant="gold" className="w-full" disabled={busy}>
              {busy ? "Saving…" : "Save password"}
            </Button>
          </form>
        ) : linkFailed ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              This reset link was already used or has expired. Each link works only once — request a new one and open
              the latest email.
            </p>
            <Button type="button" variant="gold" className="w-full" onClick={() => void navigate({ to: "/login" })}>
              Request a new link
            </Button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Open this page from your setup or password-reset email.
          </p>
        )}
      </div>
    </div>
  );
}