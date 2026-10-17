import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: "desirepath: the worn paths of the web",
  description: "A shared map of the routes agents have walked on real websites, how often each worked, and the cheapest route to a goal.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${hanken.variable} ${plex.variable}`} suppressHydrationWarning>
      <head><style>{"/* Hallmark · macrostructure: Workbench · map canvas with a side panel; tone: field survey · anchor hue: 168 */"}</style></head>
      <body>{children}</body>
    </html>
  );
}
