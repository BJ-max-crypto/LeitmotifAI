"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useAppState } from "@/context/AppProvider";
import { initialsFromName, planLabel } from "@/lib/plans";

function Card({
  title,
  children,
  danger = false,
}: {
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border bg-white p-6 ${
        danger ? "border-black" : "border-neutral-200"
      }`}
    >
      <h2 className="mb-4 text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-10 rounded-full transition ${
        checked ? "bg-black" : "bg-slate-200"
      }`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-white transition ${
          checked ? "left-5" : "left-0.5"
        }`}
      />
    </button>
  );
}

function Row({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="pr-6">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export function SettingsPage() {
  const { credits, openPricing, profile, updateProfile, signOut } = useAppState();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [wordCount, setWordCount] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(true);
  const [emailNotes, setEmailNotes] = useState(false);
  const [creditAlerts, setCreditAlerts] = useState(true);
  const [creativity, setCreativity] = useState<"Low" | "Medium" | "High">("High");
  const usedPct = credits.limit
    ? Math.round((credits.used / credits.limit) * 100)
    : 0;

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
  }, [profile?.full_name]);

  return (
    <div className="h-screen overflow-y-auto bg-[#fafafa]">
      <div className="mx-auto w-full max-w-3xl px-8 py-12">
        <h1 className="text-[40px] font-bold text-slate-900">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">
          Manage your personal settings, preferences, and AI features.
        </p>

        <div className="mt-8 flex flex-col gap-8">
          <Card title="Profile">
            <div className="flex items-center gap-4">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="size-16 rounded-full border border-neutral-200 object-cover"
                />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-full border border-neutral-200 bg-slate-100 text-xl font-semibold text-slate-500">
                  {initialsFromName(profile?.full_name, profile?.email)}
                </div>
              )}
              <div>
                <p className="text-[15px] font-semibold text-slate-900">Profile Picture</p>
                <p className="text-xs text-slate-500">PNG, JPG up to 5MB.</p>
              </div>
            </div>
            <label className="mt-5 block text-[13px] font-medium text-slate-700">
              Full Name
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2.5 text-sm text-slate-900"
              />
            </label>
            <label className="mt-4 block text-[13px] font-medium text-slate-700">
              Email Address
              <input
                value={profile?.email ?? ""}
                readOnly
                className="mt-1.5 w-full rounded-md border border-neutral-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900"
              />
            </label>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setSaving(true);
                  void updateProfile({ full_name: fullName }).finally(() =>
                    setSaving(false),
                  );
                }}
                className="rounded-md bg-[#1e1e1e] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-md border border-neutral-200 px-4 py-2 text-[13px] font-semibold text-slate-600"
              >
                Sign out
              </button>
            </div>
          </Card>

          <Card title="Plan & Usage">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {credits.plan === "free"
                    ? "Letmotif Free Tier"
                    : credits.plan === "pro"
                      ? "Leitmotif Pro"
                      : "Leitmotif Pro Plus"}
                </p>
                <p className="text-xs text-slate-500">
                  {credits.plan === "free"
                    ? "You're currently using the limited trial plan."
                    : "You're on a paid plan with fast AI credits."}
                </p>
              </div>
              <span className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                {planLabel(credits.plan)}
              </span>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-[13px]">
                <span className="font-medium text-slate-700">Monthly AI Credits</span>
                <span className="font-semibold text-slate-900">
                  {credits.used} / {credits.limit} Used ({usedPct}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-slate-100">
                <div
                  className="h-full rounded bg-gradient-to-r from-black to-neutral-300"
                  style={{ width: `${Math.min(usedPct, 100)}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={openPricing}
              className="mt-5 w-[180px] rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white"
            >
              Upgrade Plan
            </button>
          </Card>

          <Card title="Writing Preferences">
            <Row
              title="Auto-save drafts"
              description="Automatically save changes as you write to prevent data loss."
              checked={autoSave}
              onChange={setAutoSave}
            />
            <div className="h-px bg-neutral-200" />
            <Row
              title="Show word count"
              description="Display live word count and stats bar inside the editor view."
              checked={wordCount}
              onChange={setWordCount}
            />
            <div className="h-px bg-neutral-200" />
            <Row
              title="Focus mode"
              description="Fade out inactive paragraphs to stay intensely focused on the current line."
              checked={focusMode}
              onChange={setFocusMode}
            />
          </Card>

          <Card title="AI Settings">
            <p className="text-[13px] font-medium text-slate-700">Default AI Model</p>
            <button
              type="button"
              className="mt-1.5 flex w-full items-center justify-between rounded-md border border-neutral-200 px-3 py-2.5 text-sm text-slate-900"
            >
              Letmotif v1 (High Creativity)
              <ChevronDown className="size-4 text-slate-400" />
            </button>
            <div className="my-4 h-px bg-neutral-200" />
            <Row
              title="Show AI suggestions while typing"
              description="Generate real-time smart completions and outline hints inline."
              checked={aiSuggestions}
              onChange={setAiSuggestions}
            />
            <div className="mb-4 h-px bg-neutral-200" />
            <p className="text-[13px] font-medium text-slate-700">Response Creativity</p>
            <div className="mt-2 flex rounded-lg bg-slate-100 p-0.5">
              {(["Low", "Medium", "High"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCreativity(option)}
                  className={`h-8 flex-1 rounded-md text-[13px] ${
                    creativity === option
                      ? "bg-white font-semibold text-black shadow-sm"
                      : "font-medium text-slate-500"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </Card>

          <Card title="Notifications">
            <Row
              title="Email notifications"
              description="Receive weekly summaries of your generated stories and plan updates."
              checked={emailNotes}
              onChange={setEmailNotes}
            />
            <div className="h-px bg-neutral-200" />
            <Row
              title="Credit usage alerts"
              description="Send an in-app and email notification when you reach 80% credit usage."
              checked={creditAlerts}
              onChange={setCreditAlerts}
            />
          </Card>

          <Card title="Danger Zone" danger>
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-sm font-medium">Delete Account</p>
                <p className="text-xs text-slate-600">
                  Permanently delete all your projects, settings, and workspace data. This
                  cannot be undone.
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-md border border-[#b70000] px-4 py-2 text-[13px] font-semibold"
              >
                Delete Account
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
