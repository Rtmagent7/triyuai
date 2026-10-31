"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { useForm, type FieldError, type UseFormRegisterReturn } from "react-hook-form";
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from "@triyuai/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuthActions, useSession } from "@/hooks/use-session";
import { ApiRequestError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { GOOGLE_ERRORS, GoogleButton, googleLoginEnabled } from "./google";

type Mode = "login" | "register";
type Values = RegisterInput & LoginInput;

/** FR-31/33: sign-in and sign-up share one form; the demo account is one click away. */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/watchlist";
  const { data: user } = useSession();
  const actions = useAuthActions();
  const [serverError, setServerError] = useState<string | null>(
    () => GOOGLE_ERRORS[params.get("error") ?? ""] ?? null,
  );
  const [demoPending, setDemoPending] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(
      (mode === "register" ? registerSchema : loginSchema) as typeof registerSchema,
    ),
    defaultValues: { name: "", email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const run = async (fn: () => Promise<unknown>) => {
    setServerError(null);
    try {
      await fn();
      router.push(next);
    } catch (err) {
      setServerError(
        err instanceof ApiRequestError ? err.message : "Something went wrong. Please try again.",
      );
    }
  };

  const onSubmit = form.handleSubmit((values) =>
    run(() => (mode === "register" ? actions.register(values) : actions.login(values))),
  );

  if (user) {
    return (
      <Card className="mx-auto max-w-md p-6 text-center">
        <p className="font-medium">You&apos;re signed in as {user.name}.</p>
        <Button asChild variant="primary" className="mt-4">
          <Link href={next}>Continue</Link>
        </Button>
      </Card>
    );
  }

  const title = mode === "register" ? "Create your account" : "Welcome back";
  return (
    <Card className="mx-auto w-full max-w-md p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted mt-1 text-sm">
        {mode === "register"
          ? "Sync your watchlist across devices and get 30 Ask TRIYU messages a day."
          : "Sign in to sync your watchlist and chat more with Ask TRIYU."}
      </p>

      {googleLoginEnabled && (
        <div className="mt-6">
          <GoogleButton next={next} />
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="lg"
        className={cn("w-full", googleLoginEnabled ? "mt-3" : "mt-6")}
        disabled={demoPending || isSubmitting}
        onClick={async () => {
          setDemoPending(true);
          await run(actions.demo);
          setDemoPending(false);
        }}
      >
        {demoPending ? <Loader2 className="animate-spin" /> : <UserRound />} Try the demo account
      </Button>

      <div className="text-muted my-6 flex items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" /> or with email{" "}
        <span className="bg-border h-px flex-1" />
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {mode === "register" && (
          <Field label="Name" error={errors.name} autoComplete="name" {...form.register("name")} />
        )}
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email}
          {...form.register("email")}
        />
        <Field
          label="Password"
          type="password"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          hint={
            mode === "register"
              ? "8+ characters with upper and lower case letters and a number."
              : undefined
          }
          error={errors.password}
          {...form.register("password")}
        />
        {serverError && (
          <p role="alert" className="text-down text-sm">
            {serverError}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={isSubmitting || demoPending}
        >
          {isSubmitting && <Loader2 className="animate-spin" />}
          {mode === "register" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="text-muted mt-6 text-center text-sm">
        {mode === "register" ? "Already have an account? " : "New to TRIYUAI? "}
        <Link
          href={`/${mode === "register" ? "login" : "register"}${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="text-brand font-medium hover:underline"
        >
          {mode === "register" ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </Card>
  );
}

type FieldProps = UseFormRegisterReturn & {
  label: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  error?: FieldError;
};

function Field({ label, hint, error, type = "text", autoComplete, ...input }: FieldProps) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={describedBy || undefined}
        className={cn(
          "border-border bg-bg h-11 w-full rounded-xl border px-3 text-base transition-colors outline-none sm:text-sm",
          "focus-visible:border-ring",
          error && "border-down",
        )}
        {...input}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-muted mt-1.5 text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-down mt-1.5 text-xs">
          {error.message}
        </p>
      )}
    </div>
  );
}
