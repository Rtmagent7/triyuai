"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/common/states";

/** FR-06: route-level error boundary — never a blank error page. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ErrorState
      className="py-24"
      title="Something went wrong on this page"
      message="Market data might be temporarily unavailable. Please try again."
      onRetry={reset}
    />
  );
}
