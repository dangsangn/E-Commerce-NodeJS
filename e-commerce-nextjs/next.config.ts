import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Repo có nhiều lockfile (backend + frontend) — cố định workspace root về thư mục app này.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
