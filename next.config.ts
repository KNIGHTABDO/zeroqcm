import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // DariQCM question images
      { protocol: "https", hostname: "dari-qcm-back-production-c027.up.railway.app" },
      // Supabase storage
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
      // GitHub avatars / assets
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "github.com" },
      // General fallback for question images from other sources
      // Tightly scoped — add new domains here as needed
      { protocol: "https", hostname: "**" },
    ],
  },
};
export default nextConfig;
