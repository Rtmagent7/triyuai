import type { Metadata } from "next";
import { AskPage } from "@/components/chat/ask-page";

export const metadata: Metadata = {
  title: "Ask TRIYU — AI market assistant",
  description:
    "Ask questions about crypto prices, trends and concepts. Answers are grounded in live market data.",
};

export default function Page() {
  return <AskPage />;
}
