import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow server-side file system access for knowledge base and prompts
  serverExternalPackages: ['better-sqlite3', '@prisma/adapter-better-sqlite3'],

  // Disable TypeScript errors during builds (for deployment speed)
  typescript: {
    ignoreBuildErrors: true,
  },

  // Standalone output for Docker deployment
  output: 'standalone',
};

export default nextConfig;
