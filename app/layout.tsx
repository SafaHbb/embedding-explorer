import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Embedding Explorer",
  description: "Explore 6,000 words as stars, placed by meaning.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
