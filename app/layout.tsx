import type { Metadata } from "next";
import Script from "next/script";
import { DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/seo";
import "./globals.css";

const ADSENSE_PUBLISHER_ID = "ca-pub-6306589054094473";
const ADSENSE_SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`;
const ADS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ADS === "true";
const GOOGLE_SITE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
const NETWORK_BLOCKER_SCRIPT = `
(function () {
  if (window.__inconnectNetworkGuard) return;
  window.__inconnectNetworkGuard = true;

  var blockedPattern = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|403|Forbidden/i;

  function isAppResource(url) {
    if (!url) return false;
    try {
      var parsed = new URL(url, window.location.href);
      return parsed.origin === window.location.origin && parsed.pathname.indexOf("/_next/") === 0;
    } catch (error) {
      return String(url).indexOf("/_next/") !== -1;
    }
  }

  function showBlockedNetworkMessage(source) {
    if (document.getElementById("inconnect-network-blocker")) return;

    var render = function () {
      if (!document.body || document.getElementById("inconnect-network-blocker")) return;

      var panel = document.createElement("div");
      panel.id = "inconnect-network-blocker";
      panel.setAttribute("role", "alert");
      panel.setAttribute("aria-live", "assertive");
      panel.style.cssText = [
        "position:fixed",
        "left:16px",
        "right:16px",
        "bottom:16px",
        "z-index:2147483647",
        "max-width:760px",
        "margin:0 auto",
        "padding:18px",
        "border:1px solid rgba(10,102,194,0.28)",
        "border-radius:8px",
        "background:#ffffff",
        "box-shadow:0 18px 52px rgba(10,25,47,0.22)",
        "color:#191919",
        "font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        "line-height:1.55"
      ].join(";");

      panel.innerHTML =
        '<p style="margin:0;font-weight:700;font-size:16px;">INConnect could not fully load on this network.</p>' +
        '<p style="margin:8px 0 0;font-size:14px;color:#444;">This is usually caused by corporate web filtering. Please try mobile data, home Wi-Fi, or ask IT to allow in-connect.app.</p>' +
        '<p style="margin:10px 0 0;font-size:14px;color:#444;">Some application files were blocked by your network security system. Please try another network or ask your IT team to allow in-connect.app.</p>' +
        '<div style="margin-top:12px;border-radius:8px;background:#F3F6FC;padding:12px;font-size:13px;color:#191919;">' +
          '<p style="margin:0 0 6px;font-weight:700;">Recommended allowlist:</p>' +
          '<ul style="margin:0;padding-left:18px;">' +
            '<li>in-connect.app</li>' +
            '<li>www.in-connect.app</li>' +
            '<li>*.vercel.app</li>' +
          '</ul>' +
        '</div>' +
        (source ? '<p style="margin:10px 0 0;font-size:12px;color:#666;word-break:break-word;">Blocked file: ' + String(source).replace(/[<>&]/g, function (character) { return ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[character]; }) + '</p>' : '');

      document.body.appendChild(panel);
    };

    if (document.body) {
      render();
    } else {
      window.addEventListener("DOMContentLoaded", render, { once: true });
    }
  }

  window.addEventListener("error", function (event) {
    var target = event && event.target;
    var resource = target && (target.src || target.href);

    if (resource && isAppResource(resource)) {
      showBlockedNetworkMessage(resource);
      return;
    }

    if (event && event.message && blockedPattern.test(event.message)) {
      showBlockedNetworkMessage(event.message);
    }
  }, true);

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event && event.reason;
    var message = reason && (reason.message || reason.stack) ? (reason.message || reason.stack) : String(reason || "");

    if (blockedPattern.test(message)) {
      showBlockedNetworkMessage(message);
    }
  });
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "INConnect | Professional Intelligence Platform",
  description:
    "Discover opportunities, stay informed, and connect with the right professionals through profile intelligence, industry insights, and future networking opportunities.",
  other: {
    "google-adsense-account": ADSENSE_PUBLISHER_ID,
    ...(GOOGLE_SITE_VERIFICATION
      ? { "google-site-verification": GOOGLE_SITE_VERIFICATION }
      : {}),
  },
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "INConnect | Professional Intelligence Platform",
    description:
      "Discover opportunities, stay informed, and connect with the right professionals through INConnect.",
    url: SITE_URL,
    siteName: "INConnect",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "INConnect professional intelligence platform preview",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "INConnect | Professional Intelligence Platform",
    description:
      "Discover opportunities, stay informed, and connect with the right professionals through INConnect.",
    images: [DEFAULT_OG_IMAGE],
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
        <Script
          dangerouslySetInnerHTML={{ __html: NETWORK_BLOCKER_SCRIPT }}
          id="inconnect-network-guard"
          strategy="beforeInteractive"
        />
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
