import type { Metadata } from "next";

export const SITE_URL = "https://in-connect.app";
export const DEFAULT_OG_IMAGE = "/og-image.svg";

type SeoMetadataInput = {
  description: string;
  image?: string;
  path: string;
  title: string;
  type?: "article" | "website";
};

export function createSeoMetadata({
  description,
  image = DEFAULT_OG_IMAGE,
  path,
  title,
  type = "website",
}: SeoMetadataInput): Metadata {
  const url = `${SITE_URL}${path}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      images: [
        {
          alt: `${title} preview`,
          height: 630,
          url: image,
          width: 1200,
        },
      ],
      siteName: "INConnect",
      type,
      url,
    },
    twitter: {
      card: "summary_large_image",
      description,
      images: [image],
      title,
    },
  };
}
