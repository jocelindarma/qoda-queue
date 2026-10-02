import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // native module, keep it out of the bundle
  serverExternalPackages: ["better-sqlite3"],
  output: "standalone",
};

export default nextConfig;
