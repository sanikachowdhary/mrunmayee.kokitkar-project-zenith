import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {}, // explicit empty config silences the webpack/Turbopack warning
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "apod.nasa.gov" },
      { protocol: "https", hostname: "*.nasa.gov" },
      { protocol: "https", hostname: "cesium.com" },
    ],
  },
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

    // External mapping for Cesium
    config.externals = [...(config.externals || []), { cesium: "Cesium" }];

    return config;
  },
};

export default nextConfig;
