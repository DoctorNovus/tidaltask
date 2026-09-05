import { Router } from "express";
import crypto from "crypto";
import { OAuthClient } from "./oauthClient.entity";
import { OAuthCode } from "./oauthCode.entity";
import { OAuthToken } from "./oauthToken.entity";
import { User } from "@/user/user.entity";
import { UserService } from "@/user/user.service";
import { renderLoginPage, render2FAPage, renderConsentPage, renderErrorPage } from "./oauth.html";
import { verifySync as totpVerifySync } from "otplib";

const userService = new UserService();
export const oauthRouter = Router();

const BASE_URL = "https://api.tidaltask.app";
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SUPPORTED_SCOPES = new Set(["mcp", "offline_access"]);

function tokenHash(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizeScope(scope: unknown): string | null {
    const scopes = String(scope ?? "mcp offline_access").split(/\s+/).filter(Boolean);
    if (!scopes.length || scopes.some((item) => !SUPPORTED_SCOPES.has(item))) return null;
    return [...new Set(scopes)].join(" ");
}

function issueTokens(userId: string, clientId: string, scope: string) {
    const accessToken = crypto.randomBytes(32).toString("base64url");
    const includeRefreshToken = scope.split(" ").includes("offline_access");
    const refreshToken = includeRefreshToken ? crypto.randomBytes(32).toString("base64url") : null;
    const now = Date.now();

    return {
        accessToken,
        refreshToken,
        record: {
            accessTokenHash: tokenHash(accessToken),
            refreshTokenHash: refreshToken ? tokenHash(refreshToken) : null,
            userId,
            clientId,
            scope,
            accessTokenExpiresAt: new Date(now + ACCESS_TOKEN_TTL_MS),
            refreshTokenExpiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
        },
    };
}

const protectedResourceMetadata = {
    resource: BASE_URL,
    authorization_servers: [BASE_URL],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp", "offline_access"],
};

// ─── Well-known discovery ─────────────────────────────────────────────────────

oauthRouter.get("/.well-known/oauth-protected-resource", (_req, res) => {
    res.json(protectedResourceMetadata);
});

oauthRouter.get("/mcp/.well-known/oauth-protected-resource", (_req, res) => {
    res.json(protectedResourceMetadata);
});

oauthRouter.get("/.well-known/oauth-authorization-server", (_req, res) => {
    res.json({
        issuer: BASE_URL,
        authorization_endpoint: `${BASE_URL}/oauth/authorize`,
        token_endpoint: `${BASE_URL}/oauth/token`,
        registration_endpoint: `${BASE_URL}/oauth/register`,
        revocation_endpoint: `${BASE_URL}/oauth/revoke`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
        scopes_supported: ["mcp", "offline_access"],
    });
});

// ─── Dynamic client registration (RFC 7591) ───────────────────────────────────

oauthRouter.post("/oauth/register", async (req, res) => {
    const { client_name, redirect_uris, grant_types, response_types, token_endpoint_auth_method } = req.body;

    if (!client_name || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
        res.status(400).json({ error: "invalid_client_metadata", error_description: "client_name and redirect_uris are required." });
        return;
    }

    const clientId = crypto.randomUUID();

    await OAuthClient.create({
        clientId,
        clientName: String(client_name).slice(0, 200),
        redirectUris: redirect_uris.slice(0, 20).map(String),
        grantTypes: grant_types ?? ["authorization_code"],
        tokenEndpointAuthMethod: token_endpoint_auth_method ?? "none",
        scope: "mcp offline_access",
    });

    res.status(201).json({
        client_id: clientId,
        client_name,
        redirect_uris,
        grant_types: grant_types ?? ["authorization_code"],
        response_types: response_types ?? ["code"],
        token_endpoint_auth_method: token_endpoint_auth_method ?? "none",
        scope: "mcp offline_access",
    });
});

// ─── Authorization endpoint ───────────────────────────────────────────────────

oauthRouter.get("/oauth/authorize", async (req, res) => {
    const q = req.query as Record<string, string>;
    const { client_id, redirect_uri, state, code_challenge, code_challenge_method, scope, response_type } = q;

    if (!client_id || !redirect_uri || !code_challenge) {
        res.status(400).send(renderErrorPage("Missing required OAuth parameters (client_id, redirect_uri, code_challenge)."));
        return;
    }
    if (response_type !== "code") {
        res.status(400).send(renderErrorPage("Only response_type=code is supported."));
        return;
    }
    if (code_challenge_method && code_challenge_method !== "S256") {
        res.status(400).send(renderErrorPage("Only code_challenge_method=S256 is supported."));
        return;
    }

    const normalizedScope = normalizeScope(scope);
    if (!normalizedScope) {
        res.status(400).send(renderErrorPage("Unsupported OAuth scope."));
        return;
    }

    const client = await OAuthClient.findOne({ clientId: client_id }).lean<OAuthClient>().exec();
    if (!client) {
        res.status(400).send(renderErrorPage("Unknown client_id."));
        return;
    }
    if (!client.redirectUris.includes(redirect_uri)) {
        res.status(400).send(renderErrorPage("redirect_uri does not match any registered URI."));
        return;
    }

    const params = { client_id, redirect_uri, state: state ?? "", code_challenge, code_challenge_method: code_challenge_method ?? "S256", scope: normalizedScope, response_type };

    if (req.session.user) {
        const user = await User.findById(req.session.user.id).lean<User>().exec();
        res.send(renderConsentPage(client.clientName, params, user?.first ?? ""));
        return;
    }

    res.send(renderLoginPage(client.clientName, params, q.login_error ?? ""));
});

// ─── Login form POST ──────────────────────────────────────────────────────────

oauthRouter.post("/oauth/login", async (req, res) => {
    const { email, password, client_id, redirect_uri, state, code_challenge, code_challenge_method, scope, response_type } = req.body;

    const params = { client_id, redirect_uri, state: state ?? "", code_challenge, code_challenge_method: code_challenge_method ?? "S256", scope: scope ?? "mcp", response_type };

    const client = await OAuthClient.findOne({ clientId: client_id }).lean<OAuthClient>().exec();
    if (!client || !client.redirectUris.includes(redirect_uri)) {
        res.status(400).send(renderErrorPage("Invalid client or redirect_uri."));
        return;
    }

    const user = await userService.getUserByEmail(email ?? "");
    if (!user || !(await userService.validatePassword(user.id, password ?? ""))) {
        const qs = new URLSearchParams({ ...params, login_error: "Incorrect email or password." }).toString();
        res.redirect(`/oauth/authorize?${qs}`);
        return;
    }

    if (user.twoFactorEnabled) {
        (req.session as any).pendingOAuth = { userId: user.id, params };
        const clientName = client.clientName;
        res.send(render2FAPage(clientName));
        return;
    }

    req.session.user = { id: user.id, first: user.first };
    const qs = new URLSearchParams(params).toString();
    res.redirect(`/oauth/authorize?${qs}`);
});

// ─── 2FA POST ─────────────────────────────────────────────────────────────────

oauthRouter.post("/oauth/2fa", async (req, res) => {
    const pending = (req.session as any).pendingOAuth;
    if (!pending?.userId || !pending?.params) {
        res.status(400).send(renderErrorPage("Session expired. Please start the sign-in again."));
        return;
    }

    const { code } = req.body;
    const trimmedCode = String(code ?? "").replace(/\s/g, "");

    const user = await User.findById(pending.userId).select("+twoFactorSecret +twoFactorBackupCodes").lean<User>().exec();
    if (!user) {
        res.status(400).send(renderErrorPage("User not found."));
        return;
    }

    const client = await OAuthClient.findOne({ clientId: pending.params.client_id }).lean<OAuthClient>().exec();
    const clientName = client?.clientName ?? "Unknown";

    const secret = (user as any).twoFactorSecret;
    const isTotp = secret && totpVerifySync({ token: trimmedCode, secret }).valid;

    if (!isTotp) {
        // Check backup codes
        const codes: string[] = (user as any).twoFactorBackupCodes ?? [];
        const codeHash = crypto.createHash("sha256").update(trimmedCode.toUpperCase()).digest("hex");
        const idx = codes.indexOf(codeHash);
        if (idx === -1) {
            res.send(render2FAPage(clientName, "Invalid code. Try again."));
            return;
        }
        codes.splice(idx, 1);
        await User.updateOne({ _id: user.id }, { twoFactorBackupCodes: codes }).exec();
    }

    delete (req.session as any).pendingOAuth;
    req.session.user = { id: user.id, first: user.first };

    const qs = new URLSearchParams(pending.params).toString();
    res.redirect(`/oauth/authorize?${qs}`);
});

// ─── Consent grant/deny POST ──────────────────────────────────────────────────

oauthRouter.post("/oauth/authorize", async (req, res) => {
    const { action, client_id, redirect_uri, state, code_challenge, code_challenge_method, scope } = req.body;

    if (!req.session.user) {
        res.status(401).send(renderErrorPage("Not authenticated. Please sign in again."));
        return;
    }

    let redirectUrl: URL;
    try {
        redirectUrl = new URL(redirect_uri);
    } catch {
        res.status(400).send(renderErrorPage("Invalid redirect_uri."));
        return;
    }

    const client = await OAuthClient.findOne({ clientId: client_id }).lean<OAuthClient>().exec();
    if (!client || !client.redirectUris.includes(redirect_uri)) {
        res.status(400).send(renderErrorPage("Invalid client."));
        return;
    }

    const normalizedScope = normalizeScope(scope);
    if (!normalizedScope) {
        res.status(400).send(renderErrorPage("Unsupported OAuth scope."));
        return;
    }

    if (action !== "allow") {
        redirectUrl.searchParams.set("error", "access_denied");
        if (state) redirectUrl.searchParams.set("state", state);
        res.redirect(redirectUrl.toString());
        return;
    }

    const code = crypto.randomBytes(32).toString("hex");
    await OAuthCode.create({
        code,
        clientId: client_id,
        userId: req.session.user.id,
        redirectUri: redirect_uri,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method ?? "S256",
        scope: normalizedScope,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        used: false,
    });

    redirectUrl.searchParams.set("code", code);
    if (state) redirectUrl.searchParams.set("state", state);
    res.redirect(redirectUrl.toString());
});

// ─── Token exchange ───────────────────────────────────────────────────────────

oauthRouter.post("/oauth/token", async (req, res) => {
    const { grant_type, code, code_verifier, client_id, redirect_uri } = req.body;

    if (grant_type === "refresh_token") {
        await refreshToken(req, res);
        return;
    }

    if (grant_type !== "authorization_code") {
        res.status(400).json({ error: "unsupported_grant_type" });
        return;
    }

    if (!code || !code_verifier || !client_id || !redirect_uri) {
        res.status(400).json({ error: "invalid_request", error_description: "Missing required parameters." });
        return;
    }

    const authCode = await OAuthCode.findOneAndUpdate(
        { code, used: false },
        { used: true },
        { new: false },
    ).lean<OAuthCode>().exec();
    if (!authCode || authCode.clientId !== client_id || authCode.redirectUri !== redirect_uri) {
        res.status(400).json({ error: "invalid_grant" });
        return;
    }

    if (authCode.expiresAt < new Date()) {
        res.status(400).json({ error: "invalid_grant", error_description: "Authorization code has expired." });
        return;
    }

    // PKCE verification
    const challenge = crypto.createHash("sha256").update(code_verifier).digest("base64url");
    if (challenge !== authCode.codeChallenge) {
        res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed." });
        return;
    }

    const tokens = issueTokens(authCode.userId, client_id, authCode.scope);
    await OAuthToken.create(tokens.record);

    res.json({
        access_token: tokens.accessToken,
        token_type: "bearer",
        scope: authCode.scope,
        expires_in: ACCESS_TOKEN_TTL_MS / 1000,
        ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
    });
});

async function refreshToken(req: any, res: any): Promise<void> {
    const { client_id, refresh_token } = req.body;
    if (!client_id || !refresh_token) {
        res.status(400).json({ error: "invalid_request", error_description: "client_id and refresh_token are required." });
        return;
    }

    const current = await OAuthToken.findOneAndUpdate(
        {
            clientId: client_id,
            refreshTokenHash: tokenHash(refresh_token),
            refreshTokenExpiresAt: { $gt: new Date() },
            revokedAt: null,
        },
        { revokedAt: new Date() },
        { new: false },
    ).lean<OAuthToken>().exec();

    if (!current) {
        res.status(400).json({ error: "invalid_grant" });
        return;
    }

    const tokens = issueTokens(current.userId, client_id, current.scope);
    await OAuthToken.create(tokens.record);
    res.json({
        access_token: tokens.accessToken,
        token_type: "bearer",
        scope: current.scope,
        expires_in: ACCESS_TOKEN_TTL_MS / 1000,
        ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
    });
}

// ─── Token revocation (RFC 7009) ─────────────────────────────────────────────

oauthRouter.post("/oauth/revoke", async (req, res) => {
    const { token } = req.body;

    if (token) {
        try {
            const hash = tokenHash(token);
            await OAuthToken.updateMany(
                { $or: [{ accessTokenHash: hash }, { refreshTokenHash: hash }], revokedAt: null },
                { revokedAt: new Date() },
            ).exec();
        } catch {
            // Ignore — always return 200 per RFC 7009
        }
    }

    res.status(200).json({});
});
