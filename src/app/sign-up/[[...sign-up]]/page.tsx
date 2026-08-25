import { Suspense } from "react";
import { SignUpForm } from "@/components/SignUpForm";

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fafafa]" />}>
      <SignUpForm />
    </Suspense>
  );
}
