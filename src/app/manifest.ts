import type { MetadataRoute } from "next";

// PWA manifest — generated at /manifest.webmanifest
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Habit Tracker — Small Habits, Big Changes",
    short_name: "Habit Tracker",
    description:
      "Track your daily habits, build routines, and watch small habits compound into big changes. Month-by-month goals, working tick marks, themes, and configurable off-days.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#d5a6bd",
    categories: ["productivity", "lifestyle", "health"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
