import { Application } from "@outwalk/firefly";
import { ExpressPlatform } from "@outwalk/firefly/express";
import { MongooseDatabase } from "@/_lib/mongoose";
import { createTokenDocsModel, getDocsBaseUrl, renderTokenDocsHtml } from "@/docs/tokenDocs";
import { mcpHandler } from "@/mcp/handler";
import { oauthRouter } from "@/oauth/oauth.router";
import { rateLimit } from "express-rate-limit";
import cors from "cors";
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

platform.use(cors({
    credentials: true,
    origin(origin, callback) {
        if (!origin) {
            callback(null, true);
            return;
        }

        if (allowedOrigins.has(origin)) {
            callback(null, true);
            return;
        }

        try {
            const url = new URL(origin);
            const isHttps = url.protocol === "https:";
            const hasAllowedSuffix = allowedOriginSuffixes.some((suffix) => url.hostname.endsWith(suffix));

            if (isHttps && hasAllowedSuffix) {
                callback(null, true);
                return;
            }
        } catch {
            // Ignore invalid origin values and fail closed below.
        }

        callback(new Error(`CORS blocked origin: ${origin}`));
    },
}));
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
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 },
    store: sessionStore
}));

platform.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10000,
    message: { message: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
}));

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
