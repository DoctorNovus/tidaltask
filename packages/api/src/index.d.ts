/* eslint-disable no-unused-vars */

/* although unused, the imports being extended must still be present */
import type { Request } from "express";

/* update the express-session types to custom properties */
declare module "express-session" {
    export interface SessionData {
        user: { id: string, first: string, isControlled?: boolean; };
        pendingUserId?: string;
        webauthnChallenge?: string;
    }
}