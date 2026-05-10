import type { NextConfig } from 'next';
import path from 'path';

// When webpack bundles ../src/db/schema.ts it resolves drizzle-orm relative
// to that file's location (src/db/), not the dashboard's node_modules.
// On Vercel only dashboard/node_modules exists, so the alias forces every
// drizzle-orm import across any file to resolve from here.
const nextConfig: NextConfig = {
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      'drizzle-orm': path.resolve(__dirname, 'node_modules/drizzle-orm'),
    };
    return config;
  },
};

export default nextConfig;
