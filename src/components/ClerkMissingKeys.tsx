export function ClerkMissingKeys() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4">
      <div className="w-full max-w-md rounded-[10px] border border-neutral-200 bg-white p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Leitmotif
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Add your Clerk keys</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          The app is running, but Clerk keys are empty in <code className="text-[12px]">.env.local</code>.
          Paste them from the Clerk dashboard and restart the dev server:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-500">
          <li>
            <code className="text-[12px]">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>
          </li>
          <li>
            <code className="text-[12px]">CLERK_SECRET_KEY</code>
          </li>
        </ul>
        <p className="mt-4 text-sm text-slate-500">
          Then open <code className="text-[12px]">http://127.0.0.1:3000/login</code>
        </p>
      </div>
    </div>
  );
}
