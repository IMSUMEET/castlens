import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import NavBar from "@/components/NavBar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Castlens — Video Intelligence for Streaming",
  description:
    "Castlens turns raw video into the metadata streaming platforms need — X-Ray cast recognition, smart thumbnails, and skip-intro markers — automatically. Watch it live in a Netflix-style viewer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
