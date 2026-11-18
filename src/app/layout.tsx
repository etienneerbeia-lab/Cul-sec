import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "./globals.css";

// Polices hébergées dans le projet (SIL OFL) : le build ne dépend plus de
// Google Fonts et la PWA les a toujours en cache.
const display = localFont({
  src: "./fonts/bricolage.woff2",
  variable: "--font-display",
  weight: "200 800",
  display: "swap",
});

const sans = localFont({
  src: "./fonts/inter.woff2",
  variable: "--font-sans",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cul-Sec",
  description: "Jeux de soirée à boire, multijoueur, chacun sur son téléphone.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cul-Sec",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#241a44",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${display.variable} ${sans.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
