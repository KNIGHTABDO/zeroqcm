import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ZeroQCM — La révision médicale, réinventée",
  description: "Plateforme de QCM médicaux pour les étudiants en médecine marocains. S1 à S9, IA intégrée, révision ciblée.",
  metadataBase: new URL("https://zeroqcm.me"),
  openGraph: {
    title: "ZeroQCM",
    description: "La révision médicale, réinventée.",
    url: "https://zeroqcm.me",
    siteName: "ZeroQCM",
    images: [{ url: "/logo.jpg", width: 2048, height: 2048, alt: "ZeroQCM" }],
    locale: "fr_MA",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "ZeroQCM",
    description: "La révision médicale, réinventée.",
    images: ["/logo.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head />
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
