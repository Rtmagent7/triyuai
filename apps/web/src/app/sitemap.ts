import type { MetadataRoute } from "next";
import { serverApi } from "@/lib/api/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/highlights", "/converter", "/ask", "/about", "/disclaimer"].map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: "hourly" as const,
  }));
  const coins = serverApi
    .topIds(100)
    .map((id) => ({ url: `${SITE_URL}/coins/${id}`, changeFrequency: "hourly" as const }));
  return [...pages, ...coins];
}
