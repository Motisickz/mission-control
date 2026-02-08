import type { Metadata } from "next";
import { Fraunces, Work_Sans } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";

import "./globals.css";
import { AppToaster } from "@/components/app-toaster";

const titleFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-title",
});

const bodyFont = Work_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Mission controle",
  description: "Pilotage des missions et du suivi equipe",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${titleFont.variable} ${bodyFont.variable} antialiased`}>
        <ConvexAuthNextjsServerProvider>{children}</ConvexAuthNextjsServerProvider>
        <AppToaster />
      </body>
    </html>
  );
}
