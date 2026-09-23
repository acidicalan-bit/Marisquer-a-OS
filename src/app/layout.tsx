import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { OfflineSyncBridge } from "@/components/offline/offline-sync-bridge";
import { Providers } from "@/components/providers";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Barlovento",
    template: "%s · Barlovento",
  },
  description: "Operación sincronizada para Barlovento.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-MX"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          <OfflineSyncBridge />
          {children}
        </Providers>
      </body>
    </html>
  );
}
