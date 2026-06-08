import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This project lives in a subfolder of another project that also has a
  // lockfile. Pin the workspace root so Turbopack picks the right directory.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
