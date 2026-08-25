"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, useUser } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ONBOARDING_STEPS } from "@/lib/onboarding-steps";
import { createBrowserSupabase } from "@/lib/supabase/client";
import {
  EMPTY_WRITING_PREFERENCES,
  type WritingPreferences,
} from "@/lib/writing-preferences";

export function OnboardingFlow() {
  const router = useRouter();
  const { session } = useSession();
  const { user } = useUser();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<WritingPreferences>({
    ...EMPTY_WRITING_PREFERENCES,
    fullName: user?.fullName ?? "",
  });

  const current = ONBOARDING_STEPS[step];
  const progress = ((step + 1) / ONBOARDING_STEPS.length) * 100;
  const value = answers[current.key];
  const canContinue = typeof value === "string" && value.trim().length > 0;

  const heading = useMemo(
    () => (step === 0 ? "Let’s set your voice" : "A few more details"),
    [step],
  );

  const setValue = (next: string) => {
    setAnswers((currentAnswers) => ({ ...currentAnswers, [current.key]: next }));
  };

  const finish = async () => {
    if (!session) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createBrowserSupabase(async () => (await session.getToken()) ?? null);
      const payload: WritingPreferences = {
        ...answers,
        completedAt: new Date().toISOString(),
      };
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: payload.fullName.trim() || user?.fullName,
          writing_preferences: payload,
        })
        .eq("id", user?.id ?? "");
      if (updateError) throw new Error(updateError.message);
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: payload }),
      });
      router.replace("/editor");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save preferences");
      setSaving(false);
    }
  };

  const next = () => {
    if (!canContinue) return;
    if (step === ONBOARDING_STEPS.length - 1) {
      void finish();
      return;
    }
    setStep((value) => value + 1);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-2xl rounded-[28px] border-[1.5px] border-zinc-400 bg-white/70 p-8 backdrop-blur-lg">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Leitmotif
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight ink-text">{heading}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Eight short questions so Claude can write in your register.
        </p>

        <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <motion.div
            className="h-full rounded-full ink-fill"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>
        <p className="mt-2 text-xs font-medium text-zinc-400">
          Step {step + 1} of {ONBOARDING_STEPS.length}
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={current.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
            className="mt-8"
          >
            <h2 className="text-2xl font-semibold text-zinc-900">{current.title}</h2>
            <p className="mt-1 text-sm text-zinc-500">{current.subtitle}</p>

            {current.input ? (
              <input
                autoFocus
                value={answers.fullName}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") next();
                }}
                placeholder="Your name"
                className="mt-6 w-full rounded-2xl border-[1.5px] border-zinc-400 bg-white/70 px-4 py-3.5 text-base text-zinc-900 outline-none transition focus:ring-1 focus:ring-zinc-500"
              />
            ) : (
              <div className="mt-6 grid gap-2">
                {current.options?.map((option) => {
                  const selected = value === option;
                  return (
                    <motion.button
                      key={option}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.99 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => setValue(option)}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        selected
                          ? "sleek-cta ink-text font-semibold"
                          : "border-zinc-400 bg-white/70 text-zinc-800 hover:border-zinc-500"
                      }`}
                    >
                      {option}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            disabled={step === 0 || saving}
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            className="interactive-scale inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-zinc-500 disabled:opacity-30"
          >
            <ArrowLeft className="size-4" strokeWidth={1.75} />
            Back
          </button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={!canContinue || saving}
            onClick={next}
            className="sleek-cta inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            <span className="ink-text">
              {saving ? "Saving…" : step === ONBOARDING_STEPS.length - 1 ? "Enter the studio" : "Continue"}
            </span>
            <ArrowRight className="size-4" strokeWidth={1.75} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
