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
      intelligenceType="linkedin_daily"
      previewContent={previewContent}
      streamTitle="LinkedIn Daily"
      unlockTitle="Unlock today's LinkedIn Daily briefing."
    />
  );
}
