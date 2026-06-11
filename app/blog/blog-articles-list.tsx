"use client";

import Link from "next/link";
import { useState } from "react";
import type { BlogPost } from "@/lib/blog-posts";

const ARTICLES_PER_PAGE = 9;

export function BlogArticlesList({
  basePath = "/blog",
  posts,
}: {
  basePath?: string;
  posts: BlogPost[];
}) {
  const [visibleCount, setVisibleCount] = useState(ARTICLES_PER_PAGE);
  const visiblePosts = posts.slice(0, visibleCount);
  const hasMorePosts = visibleCount < posts.length;

  if (posts.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-[#D9DDE3] bg-white p-6 text-sm leading-6 text-[#666666]">
        No published briefings yet. New INConnect intelligence updates will
        appear here after publication.
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {visiblePosts.map((post) => (
          <BlogPostCard basePath={basePath} key={post.slug} post={post} />
        ))}
      </div>
      {hasMorePosts && (
        <div className="mt-8 flex justify-center">
          <button
            className="rounded-lg bg-[#4A6FD0] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#3859B8]"
            onClick={() =>
              setVisibleCount((currentCount) => currentCount + ARTICLES_PER_PAGE)
            }
            type="button"
          >
            Load More
          </button>
        </div>
      )}
    </>
  );
}

function BlogPostCard({
  basePath,
  post,
}: {
  basePath: string;
  post: BlogPost;
}) {
  const postHref = `${basePath}/${post.slug}`;

  return (
    <article className="flex h-full flex-col rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.05)]">
      <div className="aspect-video overflow-hidden rounded-lg bg-[#E8F1FB]">
        <img
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          src={post.heroImageUrl}
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0A66C2]">
        <span>{post.category}</span>
      </div>
      <h3 className="mt-4 text-xl font-semibold leading-snug text-[#191919]">
        <Link className="transition hover:text-[#0A66C2]" href={postHref}>
          {post.title}
        </Link>
      </h3>
      <p className="mt-3 flex-1 text-sm leading-6 text-[#666666]">{post.excerpt}</p>
      <div className="mt-5 flex items-center justify-between gap-4 border-t border-[#D9DDE3] pt-4 text-sm">
        <span className="text-[#666666]">{formatBlogDate(post.publishedAt)}</span>
        <Link
          className="font-semibold text-[#0A66C2] transition hover:text-[#004182]"
          href={postHref}
        >
          Read briefing
        </Link>
      </div>
    </article>
  );
}

function formatBlogDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}
