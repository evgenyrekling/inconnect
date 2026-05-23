import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "INConnect | AI LinkedIn Assistant for Professionals",
  description:
    "INConnect turns professional expertise into LinkedIn authority with profile analysis, professional area detection, trend discovery, and personalized content ideas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
