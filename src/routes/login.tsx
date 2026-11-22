import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpenText, Eye, EyeOff, Headphones, Loader2, MailCheck, ShieldCheck, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleMark, MicrosoftMark } from "@/components/site/ProviderIcons";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { ALLOWED_EMAIL_HINT, isAllowedLoginEmail, safeReaderReturn } from "@/lib/login";

type LoginSearch = { redirect?: string };
type Mode = "signin" | "signup" | "forgot";
const RETURN_KEY = "nf-login-return";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch =>
    typeof search["redirect"] === "string" ? { redirect: search["redirect"] } : {},
  head: () => ({
    meta: [
      { title: "Sign in — Novels Forever" },
      { name: "description", content: "Sign in to Novels Forever with Google, Microsoft Outlook or your Gmail / Outlook email to review novels." },
      { property: "og:title", content: "Sign in — Novels Forever" },
      { property: "og:description", content: "Join the Novels Forever reader community with Google, Outlook or email." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<null | "email" | "google" | "microsoft">(null);
  const [sentTo, setSentTo] = useState<{ kind: "confirm" | "reset"; email: string } | null>(null);

  // Already signed in (or just back from Google / Microsoft): continue where the reader was.
  useEffect(() => {
    if (redirect) sessionStorage.setItem(RETURN_KEY, redirect);
    // An email link that was already used (or opened twice) comes back with an error in the address.
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const queryParams = new URLSearchParams(window.location.search);
    const linkError = hashParams.get("error_code") ?? queryParams.get("error_code")
      ?? hashParams.get("error") ?? queryParams.get("error");
    if (linkError) {
      toast.info(
        linkError === "otp_expired"
          ? "This email link was already used or has expired. If you clicked it before, your email is verified — just sign in below."
          : "That email link didn't work. Please sign in, or request a new link.",
        { duration: 10000 },
      );
      window.history.replaceState(null, "", window.location.pathname);
    }
    const go = () => {
      const target = safeReaderReturn(sessionStorage.getItem(RETURN_KEY), window.location.origin);
      sessionStorage.removeItem(RETURN_KEY);
      void navigate({ to: target, replace: true });
    };
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) go();
    });
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") go();
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, redirect]);

  const social = async (provider: "google" | "microsoft") => {
    setBusy(provider);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: `${window.location.origin}/login` });
    if (result.redirected) return;
    setBusy(null);
    if (result.error) toast.error(`Could not continue with ${provider === "google" ? "Google" : "Microsoft"}. Please try again.`);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!isAllowedLoginEmail(cleanEmail)) {
      toast.error(ALLOWED_EMAIL_HINT);
      return;
    }
    setBusy("email");
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) {
          throw new Error(/confirm/i.test(error.message) ? "Please confirm your email first — check your inbox." : "Wrong email or password.");
        }
        toast.success("Welcome back!");
      } else if (mode === "signup") {
        if (name.trim().length < 2) throw new Error("Please write your name.");
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: `${window.location.origin}/login`, data: { full_name: name.trim().slice(0, 60) } },
        });
        if (error) {
          throw new Error(/pwned|weak|leak/i.test(error.message)
            ? "This password is too easy to guess. Please choose a stronger one."
            : /registered|exists/i.test(error.message) ? "An account with this email already exists. Please sign in." : "Could not create the account. Please try again.");
        }
        if (!data.session) setSentTo({ kind: "confirm", email: cleanEmail });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw new Error("Could not send the reset link. Please try again.");
        setSentTo({ kind: "reset", email: cleanEmail });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setSentTo(null);
  };

  const heading = mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your reader account" : "Reset your password";

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-20">
      <aside className="relative hidden overflow-hidden rounded-3xl border border-border lg:block">
        <img src="/media/hero-library.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-night opacity-80" />
        <div className="relative flex min-h-[560px] flex-col justify-end p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Reader community</p>
          <h2 className="mt-3 font-display text-5xl font-semibold leading-tight">
            Every story, <span className="text-gold">one magical library</span>
          </h2>
          <ul className="mt-8 space-y-4 text-sm text-muted-foreground">
            <li className="flex items-center gap-3"><Star className="h-5 w-5 text-primary" /> Rate and review your favourite novels</li>
            <li className="flex items-center gap-3"><Headphones className="h-5 w-5 text-primary" /> Keep listening to 1,000+ audio episodes</li>
            <li className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-primary" /> Secure sign-in with Google or Microsoft</li>
          </ul>
        </div>
      </aside>

      <section className="gold-frame rounded-3xl bg-card-grad p-6 sm:p-10">
        <div className="flex items-center gap-2 text-primary">
          <BookOpenText className="h-5 w-5" />
          <span className="text-xs uppercase tracking-[0.3em]">Novels Forever</span>
        </div>
        <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">{heading}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "forgot" ? "We'll email you a secure link to choose a new password." : "Sign in with Google, Microsoft Outlook, or your Gmail / Outlook email."}
        </p>

        {sentTo ? (
          <div className="mt-8 rounded-2xl border border-primary/40 bg-primary/5 p-6 text-center">
            <MailCheck className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-3 font-medium">Check your inbox</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {sentTo.kind === "confirm"
                ? `We sent a confirmation link to ${sentTo.email}. Open it to activate your account.`
                : `We sent a password reset link to ${sentTo.email}.`}
            </p>
            <Button variant="link" className="mt-3" onClick={() => switchMode("signin")}>Back to sign in</Button>
          </div>
        ) : (
          <>
            {mode !== "forgot" && (
              <>
                <div className="mt-8 grid gap-3">
                  <Button type="button" variant="google" size="xl" className="w-full gap-2.5 rounded-full px-3 text-sm" disabled={busy !== null} onClick={() => void social("google")}>
                    {busy === "google" ? <Loader2 className="animate-spin" /> : <GoogleMark />}
                    Continue with Google
                  </Button>
                  <Button type="button" variant="microsoft" size="xl" className="w-full gap-2.5 rounded-full px-3 text-sm" disabled={busy !== null} onClick={() => void social("microsoft")}>
                    {busy === "microsoft" ? <Loader2 className="animate-spin" /> : <MicrosoftMark />}
                    Continue with Microsoft
                  </Button>
                </div>
                <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> or use email <span className="h-px flex-1 bg-border" />
                </div>
                <div className="mb-4 grid grid-cols-2 rounded-full border border-border p-1" role="tablist" aria-label="Email sign-in">
                  {(["signin", "signup"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={mode === m}
                      onClick={() => switchMode(m)}
                      className="rounded-full py-2 text-sm font-medium text-muted-foreground transition-colors aria-selected:bg-gold aria-selected:text-primary-foreground"
                    >
                      {m === "signin" ? "Sign in" : "Create account"}
                    </button>
                  ))}
                </div>
              </>
            )}

            <form onSubmit={submit} className={mode === "forgot" ? "mt-8 space-y-4" : "space-y-4"}>
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="login-name">Your name</Label>
                  <Input id="login-name" required maxLength={60} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ayesha Khan" className="h-11" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Email</Label>
                <Input id="login-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com or you@outlook.com" className="h-11" />
                <p className="text-xs text-muted-foreground">{ALLOWED_EMAIL_HINT}</p>
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Password</Label>
                    {mode === "signin" && (
                      <button type="button" className="text-xs text-primary hover:underline" onClick={() => switchMode("forgot")}>Forgot password?</button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                      className="h-11 pr-11"
                    />
                    <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((v) => !v)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-primary">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
              <Button type="submit" variant="gold" size="xl" className="w-full" disabled={busy !== null}>
                {busy === "email" && <Loader2 className="animate-spin" />}
                {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
              </Button>
              {mode === "forgot" && (
                <Button type="button" variant="link" className="w-full" onClick={() => switchMode("signin")}>Back to sign in</Button>
              )}
            </form>
          </>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Site owner? <Link to="/auth" className="text-primary hover:underline">Owner sign-in</Link>
          <span className="mx-2">·</span>
          <Link to="/" className="hover:text-primary">Back to the library</Link>
        </p>
      </section>
    </div>
  );
}
