"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useAppState } from "@/context/AppProvider";
import { PLAN_COPY, type PlanCopy } from "@/lib/plans";
import type { PlanTier } from "@/lib/supabase/database.types";

function Feature({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <li className={`flex items-start gap-2 text-[13px] leading-5 ${className}`}>
      <Check className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.25} />
      <span>{text}</span>
    </li>
  );
}

function ctaLabel(plan: PlanCopy, current: PlanTier) {
  if (current === plan.id) return "Your Current Plan";
  return plan.cta;
}

export function PricingModal() {
  const { showPricing, closePricing, upgrade, credits } = useAppState();
  const free = PLAN_COPY.free;
  const pro = PLAN_COPY.pro;
  const plus = PLAN_COPY.pro_plus;

  useEffect(() => {
    if (!showPricing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePricing();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePricing, showPricing]);

  return (
    <AnimatePresence>
      {showPricing ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 backdrop-blur-lg p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closePricing}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="max-h-[min(92vh,880px)] w-[960px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-[20px] border border-zinc-200 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-zinc-950">Get Back to Writing</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Choose the depth of AI you need — from a first draft to a finished manuscript.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close pricing"
                onClick={closePricing}
                className="interactive-scale rounded-full bg-zinc-100 p-2 text-zinc-500"
              >
                <X className="size-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <article className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-semibold text-zinc-500">{free.name}</p>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    {free.badge}
                  </span>
                </div>
                <p className="mt-2 flex items-baseline gap-1">
                  <span className="text-[32px] font-bold text-zinc-400">${free.price}</span>
                  <span className="text-sm text-zinc-400">/mo</span>
                </p>
                <p className="mt-3 text-[13px] leading-5 text-zinc-400">{free.description}</p>
                <div className="my-5 h-px bg-zinc-200" />
                <ul className="flex flex-col gap-2.5 text-zinc-400">
                  {free.features.map((item) => (
                    <Feature key={item} text={item} />
                  ))}
                </ul>
                <button
                  type="button"
                  disabled
                  className="mt-6 rounded-lg bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-400"
                >
                  {ctaLabel(free, credits.plan)}
                </button>
              </article>

              <article className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-zinc-950/5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-semibold text-zinc-700">{pro.name}</p>
                  <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-[10px] font-semibold text-white">
                    {pro.badge}
                  </span>
                </div>
                <p className="mt-2 flex items-baseline gap-1">
                  <span className="text-[32px] font-bold text-zinc-950">${pro.price}</span>
                  <span className="text-sm text-zinc-400">/mo</span>
                </p>
                <p className="mt-3 text-[13px] leading-5 text-zinc-500">{pro.description}</p>
                <div className="my-5 h-px bg-zinc-200" />
                <ul className="flex flex-col gap-2.5 text-zinc-600">
                  {pro.features.map((item) => (
                    <Feature key={item} text={item} />
                  ))}
                </ul>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  disabled={credits.plan === "pro"}
                  onClick={() => void upgrade("pro")}
                  className="sleek-cta mt-6 rounded-lg px-4 py-3 text-sm font-semibold ink-text disabled:opacity-40"
                >
                  {ctaLabel(pro, credits.plan)}
                </motion.button>
              </article>

              <article className="flex flex-col rounded-xl border-[1.5px] border-zinc-400 bg-white/70 p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base font-semibold ink-text">{plus.name}</p>
                  <span className="sleek-cta rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide ink-text">
                    {plus.badge}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-medium text-zinc-400">
                  Ultimate Power User · Best Value for Novelists & Screenwriters
                </p>
                <p className="mt-2 flex items-baseline gap-1">
                  <span className="text-[32px] font-bold ink-text">${plus.price}</span>
                  <span className="text-sm text-zinc-400">/mo</span>
                </p>
                <p className="mt-3 text-[13px] leading-5 text-zinc-500">{plus.description}</p>
                <div className="my-5 h-px bg-zinc-200" />
                <ul className="flex flex-col gap-2.5 text-zinc-600">
                  {plus.features.map((item) => (
                    <Feature key={item} text={item} />
                  ))}
                </ul>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  disabled={credits.plan === "pro_plus"}
                  onClick={() => void upgrade("pro_plus")}
                  className="sleek-cta mt-6 rounded-lg px-4 py-3 text-sm font-semibold ink-text disabled:opacity-40"
                >
                  {ctaLabel(plus, credits.plan)}
                </motion.button>
              </article>
            </div>

            <p className="mt-6 text-center text-xs text-zinc-500">
              Cancel anytime. No hidden fees. Powered by Stripe.
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
