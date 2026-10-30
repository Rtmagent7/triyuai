import type { MetadataRoute } from "next";
import { SECTORS } from "@triyuai/shared/sectors";
import { serverApi } from "@/lib/api/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = [
    "",
    "/categories",
    "/insights",
    "/derivatives",
    "/compare",
    "/exchanges",
    "/news",
    "/highlights",
    "/converter",
    "/ask",
    "/about",
    "/disclaimer",
    ...SECTORS.map((s) => `/categories/${s.id}`),
  ].map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: "hourly" as const,
  }));
  const coins = (await serverApi.topIds(100)).map((id) => ({
    url: `${SITE_URL}/coins/${id}`,
    changeFrequency: "hourly" as const,
  }));
  return [...pages, ...coins];
}
