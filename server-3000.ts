const SESSION_COOKIE = "test_session";
const VALID_TOKEN = "abc123";
const AUTH_PORT = Number(Bun.env.AUTH_PORT ?? "3000");
const APP_ORIGIN = Bun.env.APP_ORIGIN ?? "http://localhost:3001";

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  if (!cookieHeader.trim()) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader
      .split(/;\s*/)
      .filter(Boolean)
      .map((entry) => {
        const [name, ...rest] = entry.split("=");
        return [name, rest.join("=")];
      }),
  );
}

const corsHeaders = {
  "Access-Control-Allow-Origin": APP_ORIGIN,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type, Cookie",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Bun.serve({
  port: AUTH_PORT,
  fetch(req) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/sign-in" && req.method === "POST") {
      console.log("[server-3000] POST /sign-in");

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Set-Cookie": `${SESSION_COOKIE}=${VALID_TOKEN}; Path=/; HttpOnly; SameSite=Lax`,
        },
      });
    }

    if (url.pathname === "/get-session" && req.method === "GET") {
      const cookieHeader = req.headers.get("cookie") ?? "";
      const cookies = parseCookieHeader(cookieHeader);
      const isAuthed = cookies[SESSION_COOKIE] === VALID_TOKEN;

      console.log(`[server-3000] GET /get-session cookie=${cookieHeader || "(none)"} authed=${isAuthed}`);

      return new Response(
        JSON.stringify({
          user: isAuthed ? { id: "1", email: "test@test.local" } : null,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  },
});

console.log(`Auth server running on http://localhost:${AUTH_PORT}`);
