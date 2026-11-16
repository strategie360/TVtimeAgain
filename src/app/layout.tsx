import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SwRegister } from "@/components/sw-register";

export const metadata: Metadata = {
  title: { default: "NextUp", template: "%s · NextUp" },
  description: "Suis tes séries et tes films, épisode par épisode.",
  applicationName: "NextUp",
  appleWebApp: { capable: true, title: "NextUp", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased min-h-dvh">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
