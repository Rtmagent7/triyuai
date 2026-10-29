import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function Page() {
  return (
    <div className="py-6 sm:py-12">
      <Suspense>
        <AuthForm mode="register" />
      </Suspense>
    </div>
  );
}
