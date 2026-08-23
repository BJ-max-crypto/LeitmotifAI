"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient, setBrowserSupabaseConfig } from "@/lib/supabase/client";

function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.82-.07-1.64-.23-2.43H12v4.6h6.46a5.52 5.52 0 0 1-2.4 3.63v3h3.87c2.26-2.08 3.56-5.15 3.56-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.97-1.07 7.96-2.93l-3.87-3c-1.08.72-2.47 1.14-4.09 1.14-3.14 0-5.8-2.12-6.75-4.97H1.27v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.25 14.24A7.2 7.2 0 0 1 4.87 12c0-.78.13-1.53.38-2.24V6.67H1.27A12 12 0 0 0 0 12c0 1.94.46 3.78 1.27 5.33l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.36.61 4.61 1.8l3.45-3.45C17.96 1.14 15.23 0 12 0 7.31 0 3.26 2.69 1.27 6.67l3.98 3.09C6.2 6.87 8.86 4.75 12 4.75Z"
      />
    </svg>
  );
}

function authMessage(error: string) {
  const text = error.toLowerCase();
  if (text.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (text.includes("email not confirmed")) {
    return "Confirm your email before signing in. Check your inbox, or we can send the link again.";
  }
  if (text.includes("email address") && text.includes("invalid")) {
    return "Use a real email address. Supabase rejects disposable or example.com addresses.";
  }
  if (text.includes("already registered") || text.includes("already exists")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (text.includes("provider is not enabled") || text.includes("unsupported provider")) {
    return "Google is not enabled yet. In Supabase go to Authentication → Providers → Google.";
  }
  if (text.includes("redirect")) {
    return "Add http://127.0.0.1:3000/auth/callback to Authentication → URL Configuration.";
  }
  return error;
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/editor";
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [projectUrl, setProjectUrl] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [googleEnabled, setGoogleEnabled] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const data = (await fetch("/api/supabase-config").then((response) =>
          response.json(),
        )) as { configured?: boolean; url?: string; key?: string };
        if (data.url && data.key) {
          setBrowserSupabaseConfig(data.url, data.key);
        }
        setConfigured(Boolean(data.configured));
        if (data.url && data.key) {
          try {
            const settings = await fetch(`${data.url}/auth/v1/settings`, {
              headers: { apikey: data.key, Authorization: `Bearer ${data.key}` },
            }).then(
              (response) =>
                response.json() as Promise<{ external?: { google?: boolean } }>,
            );
            setGoogleEnabled(Boolean(settings.external?.google));
          } catch {
            setGoogleEnabled(true);
          }
        }
      } catch {
        setConfigured(false);
      }
    })();
  }, []);

  function enterApp() {
    window.location.assign(next.startsWith("/") ? next : "/editor");
  }

  async function saveSupabaseConfig(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: projectUrl, key: publishableKey }),
      });
      const data = (await response.json()) as {
        error?: string;
        url?: string;
        key?: string;
      };
      if (!response.ok) throw new Error(data.error || "Could not save keys");
      if (data.url && data.key) setBrowserSupabaseConfig(data.url, data.key);
      setConfigured(true);
      setMessage("Keys saved. You can create an account or sign in.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save keys");
    } finally {
      setPending(false);
    }
  }

  async function signInWithGoogle() {
    setError(null);
    setPending(true);
    try {
      if (!googleEnabled) {
        throw new Error(
          "Google is not enabled yet. In Supabase go to Authentication → Providers → Google, then add http://127.0.0.1:3000/auth/callback as a redirect URL.",
        );
      }
      const supabase = createClient();
      const origin = window.location.origin;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });
      if (oauthError) throw oauthError;
    } catch (caught) {
      setError(
        authMessage(caught instanceof Error ? caught.message : "Google sign-in failed"),
      );
      setPending(false);
    }
  }

  async function resendConfirmation() {
    if (!email) return;
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (resendError) throw resendError;
      setMessage("Confirmation email sent. Click the link, then sign in.");
    } catch (caught) {
      setError(authMessage(caught instanceof Error ? caught.message : "Could not resend"));
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);

    try {
      const supabase = createClient();
      const origin = window.location.origin;

      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() || email.split("@")[0] },
            emailRedirectTo: `${origin}/auth/callback`,
          },
        });
        if (signUpError) throw signUpError;

        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          throw new Error("An account with this email already exists. Sign in instead.");
        }

        if (data.session) {
          void fetch("/api/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, fullName }),
          });
          enterApp();
          return;
        }

        setMessage(
          "Account created. Confirm the email we just sent, then sign in. To skip this in development, turn off Confirm email under Authentication → Providers → Email.",
        );
        setMode("login");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      enterApp();
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : "Something went wrong";
      setError(authMessage(raw));
    } finally {
      setPending(false);
    }
  }

  if (configured === null) {
    return <div className="min-h-screen bg-[#fafafa]" />;
  }

  if (!configured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4">
        <form
          onSubmit={(event) => void saveSupabaseConfig(event)}
          className="w-full max-w-md rounded-[10px] border border-neutral-200 bg-white p-8"
        >
          <h1 className="text-2xl font-bold text-slate-900">Connect Supabase</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Paste the project URL and the publishable or anon key from Settings → API Keys.
          </p>
          <label className="mt-5 block text-[13px] font-medium text-slate-700">
            Project URL
            <input
              required
              value={projectUrl}
              onChange={(event) => setProjectUrl(event.target.value)}
              className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2.5 text-sm text-slate-900"
              placeholder="https://xxxx.supabase.co"
            />
          </label>
          <label className="mt-4 block text-[13px] font-medium text-slate-700">
            Publishable or anon key
            <input
              required
              value={publishableKey}
              onChange={(event) => setPublishableKey(event.target.value)}
              className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2.5 text-sm text-slate-900"
              placeholder="sb_publishable_… or eyJ…"
            />
          </label>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-5 w-full rounded-lg bg-[#1e1e1e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save and continue"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4">
      <div className="w-full max-w-md rounded-[10px] border border-neutral-200 bg-white p-8 shadow-[0_8px_12px_rgba(0,0,0,0.06)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Leitmotif
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {mode === "login" ? "Welcome back" : "Create your workspace"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === "login"
            ? "Sign in with Google or email to open your projects."
            : "Start with 50 free AI credits. No credit card required."}
        </p>

        <button
          type="button"
          disabled={pending}
          onClick={() => void signInWithGoogle()}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <GoogleMark />
          Continue with Google
        </button>
        {!googleEnabled ? (
          <p className="mt-2 text-center text-[12px] text-slate-400">
            Google is off in this Supabase project until you enable the provider.
          </p>
        ) : null}

        <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <span className="h-px flex-1 bg-neutral-200" />
          or
          <span className="h-px flex-1 bg-neutral-200" />
        </div>

        <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
          {mode === "signup" ? (
            <label className="block text-[13px] font-medium text-slate-700">
              Full Name
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2.5 text-sm text-slate-900"
                placeholder="Benjamin Jimenez"
              />
            </label>
          ) : null}
          <label className="block text-[13px] font-medium text-slate-700">
            Email Address
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2.5 text-sm text-slate-900"
              placeholder="you@gmail.com"
            />
          </label>
          <label className="block text-[13px] font-medium text-slate-700">
            Password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2.5 text-sm text-slate-900"
              placeholder="At least 8 characters"
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
          {error?.toLowerCase().includes("confirm") ? (
            <button
              type="button"
              disabled={pending || !email}
              onClick={() => void resendConfirmation()}
              className="text-left text-sm font-medium text-slate-700 underline"
            >
              Resend confirmation email
            </button>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[#1e1e1e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 text-sm font-medium text-slate-500"
          onClick={() => {
            setError(null);
            setMessage(null);
            setMode(mode === "login" ? "signup" : "login");
          }}
        >
          {mode === "login"
            ? "Need an account? Create one"
            : "Already writing? Sign in"}
        </button>
      </div>
    </div>
  );
}
