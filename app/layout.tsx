import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://inconnect.app"),
  title: "INConnect | Your AI LinkedIn Growth Assistant",
  description:
    "Analyze LinkedIn positioning, discover relevant trends, and generate personalized content ideas designed to grow professional and company authority.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "INConnect | Your AI LinkedIn Growth Assistant",
    description:
      "Analyze LinkedIn positioning, discover trends, and grow professional authority.",
    url: "https://inconnect.app",
    siteName: "INConnect",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "INConnect LinkedIn growth assistant preview",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "INConnect | Your AI LinkedIn Growth Assistant",
    description:
      "Analyze LinkedIn positioning, discover trends, and grow professional authority.",
    images: ["/og-image.svg"],
  },
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
