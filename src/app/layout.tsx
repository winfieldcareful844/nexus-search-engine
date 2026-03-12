import type { Metadata } from "next";
import { Orbitron, Space_Grotesk, Share_Tech_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const shareTechMono = Share_Tech_Mono({
  variable: "--font-share-tech",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NEXUS DSA — Alien Intelligence Search Engine",
  description: "A production-grade search engine powered by alien-tech data structures: Trie, PageRank, LRU Cache, Min-Heap, Inverted Index, and BM25 Binary Search.",
  keywords: ["DSA", "Data Structures", "Algorithms", "Trie", "PageRank", "LRU Cache", "Min-Heap", "Inverted Index", "Binary Search", "Next.js", "TypeScript", "Search Engine"],
  authors: [{ name: "NEXUS Intelligence" }],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔮</text></svg>",
  },
  openGraph: {
    title: "NEXUS DSA — Alien Intelligence Search Engine",
    description: "Production-grade DSA algorithms with holographic visualization",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${orbitron.variable} ${spaceGrotesk.variable} ${shareTechMono.variable} antialiased bg-alien-grid text-foreground font-space scanlines`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
