import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthAside } from "@/components/auth/auth-aside";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function Page() {
  return (
    <div className="mx-auto grid max-w-5xl items-center gap-16 py-6 sm:py-12 lg:grid-cols-[1fr_28rem]">
      <AuthAside />
      <Suspense>
        <AuthForm mode="register" />
      </Suspense>
    </div>
  );
}
