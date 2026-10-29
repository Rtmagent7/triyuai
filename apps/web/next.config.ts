import type { NextConfig } from "next";

const apiOrigin = process.env.API_ORIGIN;
const mocking = process.env.NEXT_PUBLIC_API_MOCKING !== "disabled";

const nextConfig: NextConfig = {
  transpilePackages: ["@triyuai/shared"],
  // The browser calls /api/v1 on this origin and Next proxies it to the Express API,
  // so auth cookies stay first-party and no CORS is needed.
  async rewrites() {
    if (mocking || !apiOrigin) return [];
    return [{ source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` }];
  },
  // Render <meta> tags in <head> for every client (Next 15 otherwise streams them into
  // <body> on dynamic pages, which Lighthouse and some link previewers miss).
  htmlLimitedBots: /.*/,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "coin-images.coingecko.com" },
      { protocol: "https", hostname: "assets.coingecko.com" },
    ],
  },
};

export default nextConfig;
