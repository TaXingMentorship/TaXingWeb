import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export", // enable static export for GitHub Pages
  images: {
    unoptimized: true, // Pages cannot run the Next.js image optimizer
  },
  basePath: isProd ? basePath : "",
  assetPrefix: isProd ? basePath : "",
};

export default nextConfig;
