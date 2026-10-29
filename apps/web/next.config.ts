import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@triyuai/shared"],
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
