import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permet de lancer une 2e instance (ex. aperçu Claude) sans partager .next,
  // ce qui corrompt le cache de compilation et provoque des 404.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
