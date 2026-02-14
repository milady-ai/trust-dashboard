import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/trust-dashboard",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
