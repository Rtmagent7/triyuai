import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <p className="text-muted tabular text-6xl font-semibold tracking-tight">404</p>
      <h1 className="mt-4 text-xl font-semibold">This page went to the moon without us</h1>
      <p className="text-muted mt-2 max-w-md text-sm">
        The page or coin you&apos;re looking for doesn&apos;t exist, or isn&apos;t in the top 250
        yet.
      </p>
      <div className="mt-6 flex gap-2">
        <Button asChild variant="primary">
          <Link href="/">Back to markets</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/ask">Ask TRIYU</Link>
        </Button>
      </div>
    </div>
  );
}
