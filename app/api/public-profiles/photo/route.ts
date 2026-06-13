import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const PROFILE_PHOTOS_BUCKET = "profile-photos";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

type PhotoProfileRow = {
  id: string;
  profile_photo_storage_path: string | null;
  user_id: string | null;
  user_key: string | null;
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const userKey = formData.get("userKey");
    const file = formData.get("file");

    if (typeof userKey !== "string" || !userKey.trim()) {
      return NextResponse.json({ error: "userKey is required." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Profile photo file is required." }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Profile photo must be jpg, jpeg, png, or webp." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Profile photo must be 5 MB or smaller." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdminClient();
    const profile = await getPhotoProfile(userKey.trim());
    if (!profile) {
      return NextResponse.json({ error: "Public profile was not found." }, { status: 404 });
    }

    await ensureProfilePhotosBucket();

    const ownerPathSegment = profile.user_id || profile.user_key || userKey.trim();
    const objectPath = `${ownerPathSegment}/profile-photo.webp`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .upload(objectPath, fileBuffer, {
        cacheControl: "3600",
        contentType: "image/webp",
        upsert: true,
      });

    if (uploadError) {
      console.error("PROFILE PHOTO UPLOAD ERROR", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Profile photo could not be uploaded." },
        { status: 500 },
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .getPublicUrl(objectPath);

    const publicUrl = publicUrlData.publicUrl;
    const { error: updateError } = await supabase
      .from("public_profiles")
      .update({
        profile_photo_storage_path: objectPath,
        profile_photo_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("user_key", userKey.trim());

    if (updateError) {
      console.error("PROFILE PHOTO PROFILE UPDATE ERROR", updateError);
      return NextResponse.json(
        { error: updateError.message || "Profile photo could not be saved." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      profilePhotoStoragePath: objectPath,
      profilePhotoUrl: publicUrl,
    });
  } catch (error) {
    console.error("PROFILE PHOTO ROUTE ERROR", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Profile photo could not be uploaded." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userKey = searchParams.get("userKey")?.trim();
    if (!userKey) {
      return NextResponse.json({ error: "userKey is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const profile = await getPhotoProfile(userKey);
    if (!profile) {
      return NextResponse.json({ error: "Public profile was not found." }, { status: 404 });
    }

    if (profile.profile_photo_storage_path) {
      const { error: removeError } = await supabase.storage
        .from(PROFILE_PHOTOS_BUCKET)
        .remove([profile.profile_photo_storage_path]);
      if (removeError) {
        console.error("PROFILE PHOTO REMOVE ERROR", removeError);
      }
    }

    const { error: updateError } = await supabase
      .from("public_profiles")
      .update({
        profile_photo_storage_path: null,
        profile_photo_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_key", userKey);

    if (updateError) {
      console.error("PROFILE PHOTO CLEAR ERROR", updateError);
      return NextResponse.json(
        { error: updateError.message || "Profile photo could not be removed." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PROFILE PHOTO DELETE ROUTE ERROR", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Profile photo could not be removed." },
      { status: 500 },
    );
  }
}

async function getPhotoProfile(userKey: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("public_profiles")
    .select("id, user_id, user_key, profile_photo_storage_path")
    .eq("user_key", userKey)
    .maybeSingle<PhotoProfileRow>();

  if (error) {
    console.error("PROFILE PHOTO OWNER LOOKUP ERROR", error);
    throw new Error(error.message || "Public profile lookup failed.");
  }

  return data;
}

async function ensureProfilePhotosBucket() {
  const supabase = getSupabaseAdminClient();
  const { error: getBucketError } = await supabase.storage.getBucket(PROFILE_PHOTOS_BUCKET);
  if (!getBucketError) return;

  const { error: createBucketError } = await supabase.storage.createBucket(
    PROFILE_PHOTOS_BUCKET,
    {
      allowedMimeTypes: ALLOWED_MIME_TYPES,
      fileSizeLimit: MAX_FILE_SIZE_BYTES,
      public: true,
    },
  );

  if (createBucketError) {
    console.error("PROFILE PHOTOS BUCKET ERROR", createBucketError);
    throw new Error(createBucketError.message || "Profile photos bucket could not be created.");
  }
}
