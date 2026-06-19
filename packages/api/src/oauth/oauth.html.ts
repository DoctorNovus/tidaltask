function esc(s: unknown): string {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

const base = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f172a; color: #f1f5f9; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; width: 100%; max-width: 400px; }
  .logo { font-size: 22px; font-weight: 700; color: #378bd9; margin-bottom: 6px; }
  .heading { font-size: 15px; font-weight: 600; color: #f1f5f9; margin-bottom: 4px; }
  .sub { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
  .badge { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; font-size: 13px; color: #94a3b8; }
  .badge strong { color: #f1f5f9; }
  label { display: block; font-size: 13px; font-weight: 600; color: #94a3b8; margin-bottom: 6px; }
  input[type=email], input[type=password], input[type=text] { width: 100%; padding: 10px 12px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #f1f5f9; font-size: 14px; outline: none; margin-bottom: 16px; }
  input:focus { border-color: #378bd9; }
  .btn { width: 100%; padding: 12px; background: #378bd9; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
  .btn:hover { opacity: 0.9; }
  .btn-deny { background: #334155; color: #f1f5f9; margin-bottom: 10px; }
  .error { background: #450a0a; border: 1px solid #7f1d1d; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 13px; color: #fca5a5; }
  .scopes { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 14px; margin-bottom: 24px; }
  .scope-item { font-size: 13px; color: #94a3b8; padding: 4px 0; display: flex; align-items: center; gap: 8px; }
  .scope-item::before { content: "✓"; color: #22c55e; font-weight: 700; }
  .divider { height: 1px; background: #334155; margin: 20px 0; }
`;

interface OAuthParams {
    client_id: string;
    redirect_uri: string;
    state?: string;
    code_challenge: string;
    code_challenge_method?: string;
    scope?: string;
    response_type?: string;
}

function hiddenFields(params: OAuthParams): string {
    return Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
        .join("\n      ");
}

export function renderLoginPage(clientName: string, params: OAuthParams, error = ""): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign in — TidalTask</title>
  <style>${base}</style>
</head>
<body>
  <div class="card">
    <div class="logo">TidalTask</div>
    <div class="heading">Sign in to continue</div>
    <div class="sub">to authorize <strong>${esc(clientName)}</strong></div>
    ${error ? `<div class="error">${esc(error)}</div>` : ""}
    <form method="POST" action="/oauth/login">
      ${hiddenFields(params)}
      <label for="email">Email</label>
      <input id="email" type="email" name="email" placeholder="you@example.com" required autofocus autocomplete="email">
      <label for="password">Password</label>
      <input id="password" type="password" name="password" placeholder="••••••••" required autocomplete="current-password">
      <button class="btn" type="submit">Sign in</button>
    </form>
  </div>
</body>
</html>`;
}

export function render2FAPage(clientName: string, error = ""): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Two-factor — TidalTask</title>
  <style>${base}</style>
</head>
<body>
  <div class="card">
    <div class="logo">TidalTask</div>
    <div class="heading">Two-factor authentication</div>
    <div class="sub">Authorizing <strong>${esc(clientName)}</strong></div>
    ${error ? `<div class="error">${esc(error)}</div>` : ""}
    <form method="POST" action="/oauth/2fa">
      <label for="code">Authenticator code</label>
      <input id="code" type="text" name="code" placeholder="000000" required autofocus inputmode="numeric" maxlength="6" autocomplete="one-time-code">
      <button class="btn" type="submit">Verify</button>
    </form>
  </div>
</body>
</html>`;
}

export function renderConsentPage(clientName: string, params: OAuthParams, firstName: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize — TidalTask</title>
  <style>${base}</style>
</head>
<body>
  <div class="card">
    <div class="logo">TidalTask</div>
    <div class="heading">Authorize access</div>
    <div class="sub">Signed in as <strong>${esc(firstName)}</strong></div>
    <div class="badge"><strong>${esc(clientName)}</strong> is requesting access to your TidalTask account.</div>
    <div class="scopes">
      <div class="scope-item">Read your tasks</div>
      <div class="scope-item">Create and update tasks</div>
      <div class="scope-item">Mark tasks complete or delete them</div>
    </div>
    <form method="POST" action="/oauth/authorize">
      ${hiddenFields(params)}
      <button class="btn btn-deny" type="submit" name="action" value="deny">Deny</button>
      <button class="btn" type="submit" name="action" value="allow">Allow</button>
    </form>
  </div>
</body>
</html>`;
}

export function renderErrorPage(message: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Error — TidalTask</title>
  <style>${base}</style>
</head>
<body>
  <div class="card">
    <div class="logo">TidalTask</div>
    <div class="heading">Something went wrong</div>
    <div class="sub">${esc(message)}</div>
  </div>
</body>
</html>`;
}
