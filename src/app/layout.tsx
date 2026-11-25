import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/habit-tracker/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Habit Tracker — Small Habits, Big Changes",
  description:
    "Track your daily habits, build routines, and watch small habits compound into big changes. Month-by-month goals, working tick marks, themes, and configurable off-days.",
  keywords: ["habit tracker", "routines", "goals", "monthly habits", "productivity"],
  authors: [{ name: "Habit Tracker" }],
  manifest: "/manifest.webmanifest",
  applicationName: "Habit Tracker",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Habit Tracker",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icons/icon-192.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#d5a6bd",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// Runs BEFORE first paint: applies the persisted theme from the localStorage
// mirror so the app always opens in the theme the user last chose — no
// default flash, no flicker. (The mirror is written on every theme change.)
const themeInitScript = `(function(){try{if(localStorage.getItem("ht-theme")==="dark"){document.documentElement.classList.add("dark")}}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        {/* TEMP-BISECT: script removed */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          {children}
          <SonnerToaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
