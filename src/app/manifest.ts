import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NextUp",
    short_name: "NextUp",
    description: "Suis tes séries et tes films, épisode par épisode.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d12",
    theme_color: "#0b0d12",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
