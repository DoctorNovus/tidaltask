import { Application } from "@outwalk/firefly";
import { ExpressPlatform } from "@outwalk/firefly/express";
import { MongooseDatabase } from "@/_lib/mongoose";
import { createTokenDocsModel, getDocsBaseUrl, renderTokenDocsHtml } from "@/docs/tokenDocs";
import { rateLimit } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import session from "express-session";
import MongoStore from "connect-mongo";

const appUrl = process.env.APP_URL;
const sessionSecret = process.env.SESSION_SECRET;

if (!appUrl) {
    throw new Error("APP_URL environment variable is required");
}

if (!sessionSecret) {
    throw new Error("SESSION_SECRET environment variable is required");
}

/* setup the database and global plugins */
const database = await new MongooseDatabase().connect();
const leanVirtualsModule = await import("mongoose-lean-virtuals");
const leanIdModule = await import("mongoose-lean-id");

const leanVirtualsPlugin = (leanVirtualsModule.default ?? leanVirtualsModule) as any;
const leanIdPlugin = (leanIdModule.default ?? leanIdModule) as any;

database.plugin(leanVirtualsPlugin);
database.plugin(leanIdPlugin);

/* Import entity-touching modules AFTER plugins are registered so lean-id applies to all schemas */
const { mcpHandler } = await import("@/mcp/handler");
const { oauthRouter } = await import("@/oauth/oauth.router");

/* setup the platform and global middleware */
const platform = new ExpressPlatform();
const defaultAllowedOrigins = [
    "https://dashboard.tidaltask.app",
    "https://tidaltask.app",
    "https://sequenced.ottegi.com",
    "http://localhost:4173",
    "http://localhost:5173",
];

const allowedOrigins = new Set([
    ...defaultAllowedOrigins,
    ...appUrl.split(",").map((origin) => origin.trim()).filter(Boolean),
]);

const allowedOriginSuffixes = [
    ".tidaltask.app",
    ".sequenced.ottegi.com",
];

// Security headers (HSTS, clickjacking protection, MIME sniffing, etc.)
platform.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
});

platform.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    const allowed = !origin
        || allowedOrigins.has(origin)
        || (() => {
            try {
                const { protocol, hostname } = new URL(origin);
                return protocol === "https:" && allowedOriginSuffixes.some((s) => hostname.endsWith(s));
            } catch { return false; }
        })();

    if (origin && allowed) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Vary", "Origin");
    }

    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-Requested-With");
        res.setHeader("Access-Control-Max-Age", "86400");
        res.sendStatus(204);
        return;
    }

    next();
});
platform.set("trust proxy", 4);

const sessionStore = MongoStore.create({
    /* @ts-ignore - connect-mongo has a type conflict here that is safe to ignore */
    client: MongooseDatabase.connection.getClient(),
    collectionName: "session"
});

const baseTouch = sessionStore.touch.bind(sessionStore);
sessionStore.touch = ((sid: string, sess: session.SessionData, callback?: any) => {
    baseTouch(sid, sess, (err?: Error | null) => {
        if (err?.message === "Unable to find the session to touch") {
            callback?.();
            return;
        }

        callback?.(err ?? undefined);
    });
}) as typeof sessionStore.touch;

platform.use(session({
    name: "authorization",
    resave: false,
    saveUninitialized: false,
    secret: sessionSecret,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV !== "development",
        sameSite: "lax",
        httpOnly: true,
    },
    store: sessionStore
}));

// Global rate limit — broad protection against scraping / flooding.
platform.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10000,
    message: { message: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
}));

// Tight rate limit on auth endpoints — prevents brute-force and credential stuffing.
const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: { message: "Too many attempts. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});
["/auth/login", "/auth/register", "/auth/forgot-password", "/auth/reset-password"].forEach((path) => {
    platform.use(path, authRateLimit);
});

platform.use((req, res, next) => {
    if (req.method !== "GET") {
        next();
        return;
    }

    if (req.path === "/docs" || req.path === "/docs/") {
        const baseUrl = getDocsBaseUrl(req);
        res
            .status(200)
            .type("html")
            .send(renderTokenDocsHtml(baseUrl));
        return;
    }

    if (req.path === "/docs.json") {
        const baseUrl = getDocsBaseUrl(req);
        res.status(200).json(createTokenDocsModel(baseUrl));
        return;
    }

    next();
});

/* OAuth 2.0 server (discovery, registration, authorize, token, revoke) */
platform.use(oauthRouter);

/* MCP endpoint — POST /mcp (Streamable HTTP, stateless) */
platform.use(async (req, res, next) => {
    if (req.method === "POST" && req.path === "/mcp") {
        try {
            await mcpHandler(req, res);
        } catch {
            next(new Error("MCP handler error."));
        }
        return;
    }
    next();
});

/* start the application */
new Application({ platform }).listen();
