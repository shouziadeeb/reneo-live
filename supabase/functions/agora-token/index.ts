import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { RtcTokenBuilder, RtcRole } from "npm:agora-token@2.0.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOKEN_TTL_SECONDS = 3600;

type ErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "MISSING_AGORA_CREDENTIALS"
  | "MISSING_SUPABASE_CREDENTIALS"
  | "MISSING_AUTHORIZATION"
  | "INVALID_SESSION"
  | "INVALID_JSON_BODY"
  | "MISSING_LIVE_ID"
  | "PROFILE_NOT_FOUND"
  | "LIVE_NOT_FOUND"
  | "LIVE_NOT_ACTIVE"
  | "UNAUTHORIZED_HOST"
  | "AGORA_TOKEN_GENERATION_FAILED"
  | "INTERNAL_ERROR";

interface TokenRequest {
  liveId?: string;
  role?: "host" | "audience";
}

interface ErrorPayload {
  error: string;
  code: ErrorCode;
  debug?: {
    name?: string;
    message?: string;
    stack?: string;
  };
}

function isDebugEnabled(): boolean {
  return Deno.env.get("DEBUG_AGORA_TOKEN") === "true";
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  cause?: unknown,
): Response {
  const payload: ErrorPayload = { error: message, code };

  if (cause !== undefined) {
    console.error(`[agora-token] ${code}:`, cause);
  } else {
    console.error(`[agora-token] ${code}: ${message}`);
  }

  if (isDebugEnabled() && cause instanceof Error) {
    payload.debug = {
      name: cause.name,
      message: cause.message,
      stack: cause.stack,
    };
  }

  return jsonResponse(payload, status);
}

function uidFromUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

function channelName(liveId: string): string {
  return `live_${liveId.replace(/-/g, "")}`;
}

async function parseRequestBody(req: Request): Promise<TokenRequest> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {};
  }

  try {
    const text = await req.text();
    if (!text.trim()) return {};
    return JSON.parse(text) as TokenRequest;
  } catch (error) {
    console.error("[agora-token] INVALID_JSON_BODY:", error);
    throw new Error("INVALID_JSON_BODY");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse(
      405,
      "METHOD_NOT_ALLOWED",
      "Only POST is supported.",
    );
  }

  try {
    const agoraAppId = Deno.env.get("AGORA_APP_ID")?.trim();
    const agoraCertificate = Deno.env.get("AGORA_APP_CERTIFICATE")?.trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim();

    if (!agoraAppId || !agoraCertificate) {
      return errorResponse(
        500,
        "MISSING_AGORA_CREDENTIALS",
        "Agora credentials are not configured on the server. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE Edge Function secrets.",
      );
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return errorResponse(
        500,
        "MISSING_SUPABASE_CREDENTIALS",
        "Supabase credentials are not configured for this Edge Function.",
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(
        401,
        "MISSING_AUTHORIZATION",
        "Missing or invalid Authorization header.",
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return errorResponse(
        401,
        "INVALID_SESSION",
        userError?.message ?? "Unauthorized — invalid or expired session.",
        userError ?? undefined,
      );
    }

    let body: TokenRequest;
    try {
      body = await parseRequestBody(req);
    } catch {
      return errorResponse(
        400,
        "INVALID_JSON_BODY",
        "Request body must be valid JSON.",
      );
    }

    const liveId = body.liveId?.trim();
    const requestedRole = body.role === "host" ? "host" : "audience";

    if (!liveId) {
      return errorResponse(
        400,
        "MISSING_LIVE_ID",
        "liveId is required.",
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return errorResponse(
        403,
        "PROFILE_NOT_FOUND",
        profileError?.message ?? "Profile not found for authenticated user.",
        profileError ?? undefined,
      );
    }

    const { data: live, error: liveError } = await supabase
      .from("live_sessions")
      .select("id, host_id, status")
      .eq("id", liveId)
      .single();

    if (liveError || !live) {
      return errorResponse(
        404,
        "LIVE_NOT_FOUND",
        liveError?.message ?? "Live session not found.",
        liveError ?? undefined,
      );
    }

    if (live.status !== "live") {
      return errorResponse(
        400,
        "LIVE_NOT_ACTIVE",
        `Live session is not active (status: ${live.status}).`,
      );
    }

    if (requestedRole === "host") {
      if (profile.role !== "seller" || live.host_id !== user.id) {
        return errorResponse(
          403,
          "UNAUTHORIZED_HOST",
          "Only the session host can join as broadcaster.",
        );
      }
    }

    const uid = uidFromUserId(user.id);
    const channel = channelName(live.id);
    const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    const rtcRole = requestedRole === "host" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    let token: string;
    try {
      // agora-token v2.x expects seconds-from-now, NOT Unix timestamps.
      token = RtcTokenBuilder.buildTokenWithUid(
        agoraAppId,
        agoraCertificate,
        channel,
        uid,
        rtcRole,
        TOKEN_TTL_SECONDS,
        TOKEN_TTL_SECONDS,
      );
    } catch (tokenError) {
      return errorResponse(
        500,
        "AGORA_TOKEN_GENERATION_FAILED",
        tokenError instanceof Error
          ? tokenError.message
          : "Failed to generate Agora RTC token.",
        tokenError,
      );
    }

    if (!token) {
      return errorResponse(
        500,
        "AGORA_TOKEN_GENERATION_FAILED",
        "Token builder returned an empty token.",
      );
    }

    return jsonResponse(
      {
        token,
        appId: agoraAppId,
        channel,
        uid,
        role: requestedRole,
        expiresAt,
      },
      200,
    );
  } catch (error) {
    console.error("[agora-token] INTERNAL_ERROR:", error);

    const payload: ErrorPayload = {
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    };

    if (isDebugEnabled() && error instanceof Error) {
      payload.debug = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return jsonResponse(payload, 500);
  }
});
