import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Debrief — Hear what you're actually feeling",
  description: "Post-session decompression powered by AI voice analysis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
