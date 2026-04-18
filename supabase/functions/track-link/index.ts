// Public tracking endpoint for interview link emails.
// - GET ?t=<token>&type=open  -> records email_opened_at, returns 1x1 transparent GIF
// - GET ?t=<token>&type=click -> records link_clicked_at, redirects to /interview/<token>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 1x1 transparent GIF
const PIXEL = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  (c) => c.charCodeAt(0),
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("t");
    const type = url.searchParams.get("type");
    const appOrigin = url.searchParams.get("origin") || "";

    if (!token || (type !== "open" && type !== "click")) {
      return new Response("Bad request", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find the link by token
    const { data: link } = await supabase
      .from("interview_links")
      .select("id, email_opened_at, link_clicked_at")
      .eq("token", token)
      .maybeSingle();

    if (link) {
      const updates: Record<string, string> = {};
      if (type === "open" && !link.email_opened_at) {
        updates.email_opened_at = new Date().toISOString();
      }
      if (type === "click" && !link.link_clicked_at) {
        updates.link_clicked_at = new Date().toISOString();
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from("interview_links").update(updates).eq("id", link.id);
      }
    }

    if (type === "open") {
      return new Response(PIXEL, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "image/gif",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Pragma": "no-cache",
        },
      });
    }

    // click → redirect to interview page
    const target = `${appOrigin}/interview/${token}`;
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: target },
    });
  } catch (err) {
    console.error("track-link error:", err);
    // For opens, still return a pixel so the email looks fine
    const url = new URL(req.url);
    if (url.searchParams.get("type") === "open") {
      return new Response(PIXEL, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "image/gif" },
      });
    }
    return new Response("Error", { status: 500, headers: corsHeaders });
  }
});
