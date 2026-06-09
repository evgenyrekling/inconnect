"use client";

import { IntelligenceBriefingAccess } from "@/components/intelligence-briefing-access";

type BlogArticleAccessProps = {
  fullContent: string;
  previewContent: string;
};

export function BlogArticleAccess({
  fullContent,
  previewContent,
}: BlogArticleAccessProps) {
  return (
    <IntelligenceBriefingAccess
      fullContent={fullContent}
      intelligenceType="b2b_sales"
      previewContent={previewContent}
      streamTitle="B2B Sales & LinkedIn Daily"
      unlockTitle="Unlock today's B2B Sales & LinkedIn Daily briefing."
    />
  );
}
