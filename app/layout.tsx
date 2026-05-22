import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "INConnect | AI LinkedIn Assistant for Industrial Professionals",
  description:
    "INConnect turns industrial expertise into LinkedIn authority with mock profile assessment, trend signals, and personalized post ideas.",
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

