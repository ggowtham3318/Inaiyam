import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function response(body: unknown, status = 200, origin = "") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin") ?? "";
  const allowedOrigins = (Deno.env.get("APP_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!allowedOrigins.includes(origin)) return response({ error: "ORIGIN_NOT_ALLOWED" }, 403); 
  const allowedOrigin = origin;
  if (request.method === "OPTIONS") return new Response("ok", {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });

  try {
    if (request.method !== "POST") return response({ error: "METHOD_NOT_ALLOWED" }, 405, allowedOrigin);
    const authorization = request.headers.get("Authorization");
    if (!authorization) return response({ error: "AUTH_REQUIRED" }, 401, allowedOrigin);

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return response({ error: "FUNCTION_NOT_CONFIGURED" }, 500, allowedOrigin);

    const anon = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      db: { schema: "app" },
    });
    const { data: { user } } = await anon.auth.getUser();
    if (!user) return response({ error: "AUTH_REQUIRED" }, 401, allowedOrigin);
    const { data: staff, error: staffError } = await anon.schema("app").rpc("is_staff");
    if (staffError || !staff) return response({ error: "STAFF_REQUIRED" }, 403, allowedOrigin);

    const body = await request.json();
    const photoId = body?.photo_id;
    const status = body?.status;
    const reason = body?.reason;
    if (typeof photoId !== "string" || !["approved", "rejected"].includes(status)) {
      return response({ error: "INVALID_REQUEST" }, 400, allowedOrigin);
    }
    if (reason != null && (typeof reason !== "string" || reason.length > 1000)) {
      return response({ error: "INVALID_REASON" }, 400, allowedOrigin);
    }

    const admin = createClient(url, serviceKey, { db: { schema: "app" } });
    const { data: photo, error: photoError } = await admin
      .schema("app")
      .from("profile_photos")
      .select("id,uploaded_by,storage_bucket,storage_path,status")
      .eq("id", photoId)
      .single();
    if (photoError || !photo) return response({ error: "PHOTO_NOT_FOUND" }, 404, allowedOrigin);
    if (
      photo.status !== "pending" ||
      photo.storage_bucket !== "photos-pending" ||
      !photo.storage_path.startsWith(`${photo.uploaded_by}/`)
    ) return response({ error: "PHOTO_NOT_PENDING" }, 409, allowedOrigin);

    let approvedPath: string | null = null;
    if (status === "approved") {
      approvedPath = `${photo.uploaded_by}/${photo.id}`;
      const { error: copyError } = await admin.storage
        .from("photos-pending")
        .copy(photo.storage_path, approvedPath, { destinationBucket: "photos-approved" });
      if (copyError) return response({ error: "PHOTO_COPY_FAILED" }, 502, allowedOrigin);
    }

    const { error: reviewError } = await anon.schema("app").rpc("admin_review_photo", {
      p_photo_id: photoId,
      p_status: status,
      p_reason: reason ?? null,
      p_approved_storage_path: approvedPath,
    });
    if (reviewError) {
      if (approvedPath) await admin.storage.from("photos-approved").remove([approvedPath]);
      return response({ error: "PHOTO_REVIEW_FAILED" }, 500, allowedOrigin);
    }

    const { error: cleanupError } = await admin.storage.from("photos-pending").remove([photo.storage_path]);
    if (cleanupError) console.error("review-photo pending cleanup failed", photo.id, cleanupError.message);
    return response({ ok: true }, 200, allowedOrigin);
  } catch (error) {
    console.error("review-photo", error);
    return response({ error: "INTERNAL_ERROR" }, 500, allowedOrigin);
  }
});
