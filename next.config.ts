// next.config.ts
//
// Production builds use Webpack (via `next build --webpack` in package.json).
// Dev uses Turbopack (via `next dev --turbopack`).
//
// Webpack config handles node: URI scheme fallbacks needed for any packages
// that reference Node.js built-ins (e.g., satellite.js wasm builds).
//
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {}, // used only for dev (next dev --turbopack)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Handle node: URI scheme — browser can't use these, set to false
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        module: false,
        worker_threads: false,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: false,
        os: false,
      };
    }

    // Silence unknown context critical warnings from large packages
    config.module = config.module || {};
    config.module.unknownContextCritical = false;

    return config;
  },
};

export default nextConfig;
