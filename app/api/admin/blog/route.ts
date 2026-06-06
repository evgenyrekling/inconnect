import { NextRequest, NextResponse } from "next/server";
import { generateAndStoreBlogPost } from "@/lib/blog-generator";
import { normalizeEmail } from "@/lib/identity";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminBlogPostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  content: string;
  seo_title: string | null;
  seo_description: string | null;
  published: boolean;
  auto_generated: boolean;
  author_name: string | null;
  created_at: string;
  published_at: string | null;
};

export async function GET(request: NextRequest) {
  const email = getEmailFromRequest(request);
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("blog_posts")
      .select(
        "id, slug, title, excerpt, category, content, seo_title, seo_description, published, auto_generated, author_name, created_at, published_at",
      )
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<AdminBlogPostRow[]>();

    if (error) {
      console.error("ADMIN BLOG LIST ERROR", error);
      return NextResponse.json(
        { error: "Blog posts could not be loaded.", details: error.message },
        { status: 500 },
      );
    }

    const posts = data ?? [];
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const generatedToday = posts.some(
      (post) => post.auto_generated && post.created_at.startsWith(todayPrefix),
    );

    return NextResponse.json({
      generatedToday,
      posts,
    });
  } catch (error) {
    console.error("ADMIN BLOG LIST FAILED", error);
    return NextResponse.json(
      {
        error: "Blog posts could not be loaded.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = getEmailFromPayload(payload);
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const result = await generateAndStoreBlogPost();
    return NextResponse.json({
      ok: true,
      autoPublished: result.autoPublished,
      post: result.post,
      topic: result.topic,
    });
  } catch (error) {
    console.error("ADMIN BLOG REGENERATE FAILED", error);
    return NextResponse.json(
      {
        error: "Blog draft could not be generated.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = getEmailFromPayload(payload);
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const id = getString(payload?.id);
  if (!id) {
    return NextResponse.json({ error: "Blog post id is required." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof payload?.title === "string") patch.title = payload.title.trim();
  if (typeof payload?.content === "string") patch.content = payload.content.trim();
  if (typeof payload?.excerpt === "string") patch.excerpt = payload.excerpt.trim();
  if (typeof payload?.seoTitle === "string") patch.seo_title = payload.seoTitle.trim();
  if (typeof payload?.seoDescription === "string") {
    patch.seo_description = payload.seoDescription.trim();
  }
  if (typeof payload?.published === "boolean") {
    patch.published = payload.published;
    patch.published_at = payload.published ? new Date().toISOString() : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No blog post fields were provided." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("blog_posts")
      .update(patch)
      .eq("id", id)
      .select(
        "id, slug, title, excerpt, category, content, seo_title, seo_description, published, auto_generated, author_name, created_at, published_at",
      )
      .single<AdminBlogPostRow>();

    if (error) {
      console.error("ADMIN BLOG UPDATE ERROR", { id, patch, error });
      return NextResponse.json(
        { error: "Blog post could not be updated.", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, post: data });
  } catch (error) {
    console.error("ADMIN BLOG UPDATE FAILED", error);
    return NextResponse.json(
      {
        error: "Blog post could not be updated.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = getEmailFromPayload(payload);
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const id = getString(payload?.id);
  if (!id) {
    return NextResponse.json({ error: "Blog post id is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);

    if (error) {
      console.error("ADMIN BLOG DELETE ERROR", { id, error });
      return NextResponse.json(
        { error: "Blog post could not be deleted.", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("ADMIN BLOG DELETE FAILED", error);
    return NextResponse.json(
      {
        error: "Blog post could not be deleted.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

function getEmailFromRequest(request: NextRequest) {
  return normalizeEmail(request.nextUrl.searchParams.get("email") ?? "");
}

function getEmailFromPayload(payload: Record<string, unknown> | null) {
  return normalizeEmail(typeof payload?.email === "string" ? payload.email : "");
}

function isAdminEmail(email: string) {
  return getAdminEmails().includes(email);
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
