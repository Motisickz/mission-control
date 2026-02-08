import type { Metadata } from "next";
import { Fraunces, Work_Sans } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";

import "./globals.css";
import { AppToaster } from "@/components/app-toaster";
import { ConvexClientProvider } from "@/components/convex-client-provider";

const titleFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-title",
});

const bodyFont = Work_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Mission contrôle",
  description: "Pilotage des missions et du suivi d'équipe",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${titleFont.variable} ${bodyFont.variable} antialiased`}>
        <ConvexAuthNextjsServerProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ConvexAuthNextjsServerProvider>
        <AppToaster />
      </body>
    </html>
  );
}
