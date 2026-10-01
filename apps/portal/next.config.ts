import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Game bundles get cross-origin isolation so Wasm threads and
        // SharedArrayBuffer work later. Scoped to /games/* so the portal
        // itself can keep embedding third-party content freely.
        source: "/games/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          // Games run in a sandboxed iframe with an opaque origin, so their
          // own files count as cross-origin and need an explicit CORP.
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
