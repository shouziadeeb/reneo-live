import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { RtcTokenBuilder, RtcRole } from "npm:agora-token@2.0.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TokenRequest {
  liveId?: string;
  role?: "host" | "audience";
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const agoraAppId = Deno.env.get("AGORA_APP_ID");
    const agoraCertificate = Deno.env.get("AGORA_APP_CERTIFICATE");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!agoraAppId || !agoraCertificate) {
      return new Response(
        JSON.stringify({ error: "Agora credentials are not configured on the server." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: "Supabase credentials are not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as TokenRequest;
    const liveId = body.liveId?.trim();
    const requestedRole = body.role === "host" ? "host" : "audience";

    if (!liveId) {
      return new Response(JSON.stringify({ error: "liveId is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: live, error: liveError } = await supabase
      .from("live_sessions")
      .select("id, host_id, status")
      .eq("id", liveId)
      .single();

    if (liveError || !live) {
      return new Response(JSON.stringify({ error: "Live session not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (live.status !== "live") {
      return new Response(JSON.stringify({ error: "Live session is not active." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (requestedRole === "host") {
      if (profile.role !== "seller" || live.host_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Only the session host can join as broadcaster." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const uid = uidFromUserId(user.id);
    const channel = channelName(live.id);
    const expireSeconds = 3600;
    const privilegeExpireTs = Math.floor(Date.now() / 1000) + expireSeconds;
    const rtcRole = requestedRole === "host" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    const token = RtcTokenBuilder.buildTokenWithUid(
      agoraAppId,
      agoraCertificate,
      channel,
      uid,
      rtcRole,
      privilegeExpireTs,
      privilegeExpireTs,
    );

    return new Response(
      JSON.stringify({
        token,
        appId: agoraAppId,
        channel,
        uid,
        role: requestedRole,
        expiresAt: privilegeExpireTs,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token generation failed.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
