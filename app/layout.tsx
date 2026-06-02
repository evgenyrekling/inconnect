import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const ADSENSE_PUBLISHER_ID = "ca-pub-6306589054094473";
const ADSENSE_SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`;
const ADS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ADS === "true";

export const metadata: Metadata = {
  metadataBase: new URL("https://inconnect.app"),
  title: "INConnect | Your AI LinkedIn Intelligence Platform",
  description:
    "Improve LinkedIn positioning, visibility, authority, and growth opportunities with AI-powered profile intelligence and headline generation.",
  other: {
    "google-adsense-account": ADSENSE_PUBLISHER_ID,
  },
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "INConnect | Your AI LinkedIn Intelligence Platform",
    description:
      "Improve LinkedIn positioning, visibility, authority, and growth opportunities.",
    url: "https://inconnect.app",
    siteName: "INConnect",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "INConnect LinkedIn intelligence platform preview",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "INConnect | Your AI LinkedIn Intelligence Platform",
    description:
      "Improve LinkedIn positioning, visibility, authority, and growth opportunities.",
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
      <body>
        {ADS_ENABLED && (
          <Script
            async
            crossOrigin="anonymous"
            id="google-adsense"
            src={ADSENSE_SCRIPT_SRC}
            strategy="afterInteractive"
          />
        )}
        {children}
      </body>
    </html>
  );
}
