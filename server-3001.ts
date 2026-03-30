const AUTH_PORT = Number(Bun.env.AUTH_PORT ?? "3000");
const APP_PORT = Number(Bun.env.APP_PORT ?? "3001");
const AUTH_ORIGIN = Bun.env.AUTH_ORIGIN ?? `http://localhost:${AUTH_PORT}`;

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

const loginHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cookie Test Login</title>
  </head>
  <body>
    <h1>Login</h1>
    <form id="form">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" value="test@test.local" />

      <label for="password">Password</label>
      <input id="password" name="password" type="password" value="password" />

      <button type="submit">Sign In</button>
    </form>

    <p id="result" aria-live="polite"></p>

    <script>
      const form = document.getElementById("form");
      const result = document.getElementById("result");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        result.textContent = "Signing in...";

        try {
          const response = await fetch("${AUTH_ORIGIN}/sign-in", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: document.getElementById("email").value,
              password: document.getElementById("password").value
            })
          });

          if (!response.ok) {
            throw new Error("Sign-in failed with status " + response.status);
          }

          result.textContent = "Signed in, redirecting...";
          window.location.href = "/dashboard";
        } catch (error) {
          result.textContent = String(error);
        }
      });
    </script>
  </body>
</html>`;

Bun.serve({
  port: APP_PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/login") {
      return new Response(loginHtml, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (url.pathname === "/api/debug/cookies") {
      const cookieHeader = req.headers.get("cookie") ?? "";
      const parsedCookies = parseCookieHeader(cookieHeader);

      const sessionResponse = await fetch(`${AUTH_ORIGIN}/get-session`, {
        headers: {
          cookie: cookieHeader,
        },
      });
      const sessionText = await sessionResponse.text();

      return new Response(
        `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cookie Debug</title>
    <style>
      body {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        line-height: 1.4;
        padding: 24px;
      }

      pre {
        white-space: pre-wrap;
        word-break: break-word;
        padding: 12px;
        background: #f5f5f5;
        border: 1px solid #ddd;
      }
    </style>
  </head>
  <body>
    <h1>Cookie Debug</h1>
    <h2>Request Cookie Header</h2>
    <pre>${cookieHeader || "(none)"}</pre>
    <h2>Parsed Cookies</h2>
    <pre>${JSON.stringify(parsedCookies, null, 2)}</pre>
    <h2>Auth Session Response</h2>
    <pre>Status: ${sessionResponse.status}

${sessionText}</pre>
  </body>
</html>`,
        {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    if (url.pathname === "/dashboard") {
      const cookieHeader = req.headers.get("cookie") ?? "";
      console.log(`[server-3001] /dashboard received cookies: ${cookieHeader || "(none)"}`);

      const sessionResponse = await fetch(`${AUTH_ORIGIN}/get-session`, {
        headers: {
          cookie: cookieHeader,
        },
      });
      const session = (await sessionResponse.json()) as { user: { id: string } | null };

      console.log("[server-3001] /dashboard session response:", session);

      if (!session.user) {
        return new Response(null, {
          status: 302,
          headers: { Location: "/login" },
        });
      }

      return new Response(
        `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cookie Test Dashboard</title>
  </head>
  <body>
    <h1>Dashboard</h1>
    <p>Logged in as: ${session.user.id}</p>
    <p id="status">authenticated</p>
  </body>
</html>`,
        {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    if (url.pathname === "/") {
      return new Response(null, {
        status: 302,
        headers: { Location: "/dashboard" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`App server running on http://localhost:${APP_PORT}`);
