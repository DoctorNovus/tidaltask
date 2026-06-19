import { Controller, Delete, Get, Inject, Post } from "@outwalk/firefly";
import { BadRequest, NotFound, Unauthorized } from "@outwalk/firefly/errors";
import { UserService } from "@/user/user.service";
import { User } from "@/user/user.entity";
import { Request } from "express";
import sendToWebhook from "@/logging/webhook";
import { PasswordReset } from "./passwordReset.entity";
import { DeviceToken } from "./deviceToken.entity";
import { Passkey } from "./passkey.entity";
import crypto from "crypto";
import { Resend } from "resend";
import { generateSecret as totpGenerateSecret, generateURI as totpGenerateURI, verifySync as totpVerifySync } from "otplib";
import QRCode from "qrcode";
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture, RegistrationResponseJSON, AuthenticationResponseJSON } from "@simplewebauthn/server";

function getRpConfig(req: Request) {
    const rpID = process.env.WEBAUTHN_RP_ID || "tidaltask.app";
    const origin = req.headers.origin || process.env.FRONTEND_URL || "https://dashboard.tidaltask.app";
    const rpName = process.env.WEBAUTHN_RP_NAME || "TidalTask";
    return { rpID, origin, rpName };
}

function generateBackupCodes(): string[] {
    return Array.from({ length: 8 }, () => crypto.randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-"));
}

@Controller()
export class AuthController {

    @Inject()
    userService: UserService;

    @Get("/")
    async getAuth({ session }: Request): Promise<{ message: string }> {
        if (!session.user) throw new Unauthorized("Not Logged In");
        return { message: "Logged In" };
    }

    @Post("/login")
    async loginToSystem(req: Request): Promise<User | { requiresTwoFactor: true }> {
        const { email, password } = req.body;

        const user = await this.userService.getUserByEmail(email);
        if (!user) throw new Unauthorized("Account not found. Please register an account.");

        if (!(await this.userService.validatePassword(user.id, password))) {
            throw new Unauthorized("Incorrect Email/Password Combo.");
        }

        if (user.twoFactorEnabled) {
            req.session.pendingUserId = user.id;
            return { requiresTwoFactor: true };
        }

        req.session.user = { id: user.id, first: user.first };
        await this.userService.updateUser(user.id, { lastLoggedIn: new Date() });
        return user;
    }

    @Post("/device-token")
    async issueDeviceToken({ session, body }: Request): Promise<{ token: string; expiresAt: Date }> {
        if (!session?.user?.id) throw new Unauthorized("Not Logged In");

        const label = typeof body?.label === "string" ? body.label.trim() : "Siri";
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

        await DeviceToken.create({ tokenHash, user: session.user.id, expiresAt, label });
        return { token, expiresAt };
    }

    @Post("/register")
    async registerInSystem(req: Request): Promise<User> {
        const { first, last, email, password } = req.body;

        if (await this.userService.getUserByEmail(email)) {
            throw new BadRequest("Email Already Exists");
        }

        const user = await this.userService.createUser({ first, last, email, password, lastLoggedIn: new Date() });
        req.session.user = { id: user.id, first: user.first };

        await this.sendWelcomeOnSignup(user);

        sendToWebhook({
            embeds: [
                { title: "New User Has Registered", description: `**${first} ${last}** has registered with the email, **${email}**.`, timestamp: new Date() }
            ]
        });
        return user;
    }

    @Post("/loginAsUser")
    async loginAsUser(req: Request): Promise<User> {
        const { id } = req.body;

        const user = await this.userService.getUserById(req.session.user.id);
        if (!user || !user.developer) throw new Unauthorized("Not a Developer");

        const controlled = await this.userService.getUserById(id);
        if (!controlled) throw new Unauthorized("Account not found.");

        req.session.user = { id: controlled.id, first: user.first, isControlled: true };
        await this.userService.updateUser(controlled.id, { lastLoggedIn: new Date() });
        return controlled;
    }

    @Post("/logout")
    async logout(req: Request): Promise<{ message: string }> {
        if (!req.session.user) throw new Unauthorized("You are not logged in.");

        await new Promise<void>((resolve, reject) => req.session.destroy((error) => {
            if (error) reject(error);
            else resolve();
        }));

        return { message: "success" };
    }

    @Post("/forgot-password")
    async requestPasswordReset(req: Request): Promise<{ success: true }> {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        if (!email) throw new BadRequest("Email is required.");

        const user = await this.userService.getUserByEmail(email);

        if (!user?.id || !user.email) return { success: true };

        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        await PasswordReset.deleteMany({ user: user.id });
        await PasswordReset.create({ user: user.id, tokenHash, expiresAt, used: false });

        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) throw new BadRequest("Password reset is unavailable right now. Please try again later.");

        const resend = new Resend(resendApiKey);
        const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || "https://dashboard.tidaltask.app";
        const resetUrl = `${frontendUrl.replace(/\/$/, "")}/auth/forgotPassword?token=${token}`;
        const fromEmail = process.env.RESET_FROM_EMAIL || "TidalTask <support@tidaltask.app>";

        const sendResult = await resend.emails.send({
            from: fromEmail,
            to: user.email,
            subject: "Reset your TidalTask password",
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
                    <h2 style="color:#2563eb;margin-bottom:12px;">Reset your password</h2>
                    <p>Hello ${user.first ?? "there"},</p>
                    <p>We received a request to reset your TidalTask password. Click the button below to set a new password. This link will expire in 1 hour.</p>
                    <p style="margin:16px 0;">
                        <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:white;text-decoration:none;border-radius:10px;font-weight:600;">Reset password</a>
                    </p>
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p style="word-break:break-all;"><a href="${resetUrl}">${resetUrl}</a></p>
                    <p>If you didn't request this, you can safely ignore this email.</p>
                </div>
            `
        });

        if (sendResult?.error) {
            throw new BadRequest(sendResult.error.message || "Unable to send reset email right now.");
        }

        return { success: true };
    }

    @Get("/reset-password")
    async validateResetToken(req: Request): Promise<{ valid: boolean }> {
        const token = typeof req.query?.token === "string" ? req.query.token.trim() : "";
        if (!token) return { valid: false };

        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const resetRequest = await PasswordReset.findOne({ tokenHash, used: false }).lean<PasswordReset>().exec();

        if (!resetRequest || !resetRequest.user || resetRequest.expiresAt < new Date()) {
            return { valid: false };
        }

        return { valid: true };
    }

    @Post("/reset-password")
    async resetPassword(req: Request): Promise<{ success: true }> {
        const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
        const password = typeof req.body?.password === "string" ? req.body.password : "";

        if (!token || !password) {
            throw new BadRequest("Reset token and password are required.");
        }

        if (password.length < 8) {
            throw new BadRequest("Password must be at least 8 characters long.");
        }

        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const resetRequest = await PasswordReset.findOne({ tokenHash, used: false }).lean<PasswordReset>().exec();

        if (!resetRequest || !resetRequest.user || resetRequest.expiresAt < new Date()) {
            throw new BadRequest("This reset link is invalid or has expired.");
        }

        await this.userService.updateUser(resetRequest.user as any, { password });
        await PasswordReset.deleteOne({ _id: resetRequest._id }).exec();

        return { success: true };
    }

    // ─── Two-Factor Authentication ────────────────────────────────────────────

    @Post("/2fa/setup")
    async setupTwoFactor(req: Request): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
        if (!req.session?.user?.id) throw new Unauthorized("Not Logged In");

        const user = await User.findById(req.session.user.id).select("+twoFactorSecret +twoFactorBackupCodes").lean<User>().exec();
        if (!user) throw new Unauthorized("User not found.");
        if ((user as any).twoFactorEnabled) throw new BadRequest("Two-factor authentication is already enabled.");

        const secret = totpGenerateSecret();
        const issuer = process.env.WEBAUTHN_RP_NAME || "TidalTask";
        const uri = totpGenerateURI({ issuer, label: user.email, secret });
        const qrCode = await QRCode.toDataURL(uri);
        const backupCodes = generateBackupCodes();
        const backupCodeHashes = backupCodes.map((c) => crypto.createHash("sha256").update(c).digest("hex"));

        await User.updateOne({ _id: user.id }, { twoFactorSecret: secret, twoFactorBackupCodes: backupCodeHashes });

        return { secret, qrCode, backupCodes };
    }

    @Post("/2fa/verify-setup")
    async verifySetupTwoFactor(req: Request): Promise<{ enabled: boolean }> {
        if (!req.session?.user?.id) throw new Unauthorized("Not Logged In");

        const code = typeof req.body?.code === "string" ? req.body.code.trim().replace(/\s/g, "") : "";
        if (!code) throw new BadRequest("Verification code is required.");

        const user = await User.findById(req.session.user.id).select("+twoFactorSecret").lean<User>().exec();
        if (!user) throw new Unauthorized("User not found.");

        const secret = (user as any).twoFactorSecret;
        if (!secret) throw new BadRequest("Run setup first.");

        const result = totpVerifySync({ token: code, secret });
        if (!result.valid) throw new BadRequest("Invalid code. Check your authenticator app and try again.");

        await User.updateOne({ _id: user.id }, { twoFactorEnabled: true });

        return { enabled: true };
    }

    @Post("/2fa/disable")
    async disableTwoFactor(req: Request): Promise<{ disabled: boolean }> {
        if (!req.session?.user?.id) throw new Unauthorized("Not Logged In");

        const code = typeof req.body?.code === "string" ? req.body.code.trim().replace(/\s/g, "") : "";
        const password = typeof req.body?.password === "string" ? req.body.password : "";

        const user = await User.findById(req.session.user.id).select("+twoFactorSecret").lean<User>().exec();
        if (!user) throw new Unauthorized("User not found.");
        if (!(user as any).twoFactorEnabled) throw new BadRequest("Two-factor authentication is not enabled.");

        if (code) {
            const secret = (user as any).twoFactorSecret;
            const result = secret ? totpVerifySync({ token: code, secret }) : null;
            if (!result?.valid) {
                throw new Unauthorized("Invalid code.");
            }
        } else if (password) {
            if (!(await this.userService.validatePassword(user.id, password))) {
                throw new Unauthorized("Incorrect password.");
            }
        } else {
            throw new BadRequest("Provide a verification code or current password.");
        }

        await User.updateOne({ _id: user.id }, { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] });

        return { disabled: true };
    }

    @Post("/2fa/complete-login")
    async completeTwoFactorLogin(req: Request): Promise<User> {
        const pendingId = req.session?.pendingUserId;
        if (!pendingId) throw new Unauthorized("No pending login. Please log in again.");

        const code = typeof req.body?.code === "string" ? req.body.code.trim().replace(/\s/g, "") : "";
        if (!code) throw new BadRequest("Verification code is required.");

        const user = await User.findById(pendingId).select("+twoFactorSecret +twoFactorBackupCodes").lean<User>().exec();
        if (!user) throw new Unauthorized("User not found.");

        const secret = (user as any).twoFactorSecret;
        const isValid = secret && totpVerifySync({ token: code, secret }).valid;

        if (!isValid) throw new Unauthorized("Invalid code. Try again or use a backup code.");

        delete req.session.pendingUserId;
        req.session.user = { id: user.id, first: user.first };
        await this.userService.updateUser(user.id, { lastLoggedIn: new Date() });

        const cleanUser = await this.userService.getUserById(user.id);
        return cleanUser!;
    }

    @Post("/2fa/backup-login")
    async backupCodeLogin(req: Request): Promise<User> {
        const pendingId = req.session?.pendingUserId;
        if (!pendingId) throw new Unauthorized("No pending login. Please log in again.");

        const code = typeof req.body?.code === "string" ? req.body.code.trim().replace(/\s/g, "").toUpperCase() : "";
        if (!code) throw new BadRequest("Backup code is required.");

        const user = await User.findById(pendingId).select("+twoFactorBackupCodes").lean<User>().exec();
        if (!user) throw new Unauthorized("User not found.");

        const codes: string[] = (user as any).twoFactorBackupCodes || [];
        const codeHash = crypto.createHash("sha256").update(code).digest("hex");
        const idx = codes.indexOf(codeHash);
        if (idx === -1) throw new Unauthorized("Invalid backup code.");

        codes.splice(idx, 1);
        await User.updateOne({ _id: user.id }, { twoFactorBackupCodes: codes });

        delete req.session.pendingUserId;
        req.session.user = { id: user.id, first: user.first };
        await this.userService.updateUser(user.id, { lastLoggedIn: new Date() });

        const cleanUser = await this.userService.getUserById(user.id);
        return cleanUser!;
    }

    @Post("/2fa/regenerate-backup-codes")
    async regenerateBackupCodes(req: Request): Promise<{ backupCodes: string[] }> {
        if (!req.session?.user?.id) throw new Unauthorized("Not Logged In");

        const user = await User.findById(req.session.user.id).lean<User>().exec();
        if (!user || !(user as any).twoFactorEnabled) throw new BadRequest("Two-factor authentication is not enabled.");

        const backupCodes = generateBackupCodes();
        const backupCodeHashes = backupCodes.map((c) => crypto.createHash("sha256").update(c).digest("hex"));
        await User.updateOne({ _id: user.id }, { twoFactorBackupCodes: backupCodeHashes });

        return { backupCodes };
    }

    // ─── Passkeys ─────────────────────────────────────────────────────────────

    @Get("/passkeys")
    async listPasskeys(req: Request): Promise<Array<{ id: string; label: string; deviceType?: string; backedUp: boolean; createdAt: Date }>> {
        if (!req.session?.user?.id) throw new Unauthorized("Not Logged In");

        const passkeys = await Passkey.find({ user: req.session.user.id })
            .select("id label deviceType backedUp createdAt")
            .lean<Passkey[]>()
            .exec();

        return (passkeys as any[]).map((p) => ({
            id: p.id,
            label: p.label || "Passkey",
            deviceType: p.deviceType,
            backedUp: p.backedUp,
            createdAt: p.createdAt,
        }));
    }

    @Post("/passkeys/register-options")
    async passkeyRegisterOptions(req: Request): Promise<object> {
        if (!req.session?.user?.id) throw new Unauthorized("Not Logged In");

        const user = await this.userService.getUserById(req.session.user.id);
        if (!user) throw new Unauthorized("User not found.");

        const { rpID, rpName } = getRpConfig(req);

        const existingPasskeys = await Passkey.find({ user: user.id }).lean<Passkey[]>().exec();

        const options = await generateRegistrationOptions({
            rpName,
            rpID,
            userName: user.email,
            userID: new TextEncoder().encode(user.id),
            attestationType: "none",
            authenticatorSelection: {
                residentKey: "preferred",
                userVerification: "preferred",
            },
            excludeCredentials: (existingPasskeys as any[]).map((pk) => ({
                id: pk.credentialId,
                transports: pk.transports as AuthenticatorTransportFuture[] | undefined,
            })),
        });

        req.session.webauthnChallenge = options.challenge;

        return options;
    }

    @Post("/passkeys/register-verify")
    async passkeyRegisterVerify(req: Request): Promise<{ registered: boolean; passkey: object }> {
        if (!req.session?.user?.id) throw new Unauthorized("Not Logged In");

        const challenge = req.session.webauthnChallenge;
        if (!challenge) throw new BadRequest("No challenge found. Start registration again.");

        const { rpID, origin } = getRpConfig(req);
        const body: RegistrationResponseJSON = req.body.response;
        const label = typeof req.body.label === "string" ? req.body.label.trim() : "Passkey";

        let verification;
        try {
            verification = await verifyRegistrationResponse({
                response: body,
                expectedChallenge: challenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
                requireUserVerification: false,
            });
        } catch (err: any) {
            throw new BadRequest(err?.message || "Passkey registration failed.");
        }

        if (!verification.verified || !verification.registrationInfo) {
            throw new BadRequest("Passkey registration could not be verified.");
        }

        delete req.session.webauthnChallenge;

        const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
        const passkey = await Passkey.create({
            user: req.session.user.id,
            credentialId: credential.id,
            publicKey: Buffer.from(credential.publicKey).toString("base64url"),
            counter: credential.counter,
            deviceType: credentialDeviceType,
            backedUp: credentialBackedUp,
            transports: credential.transports,
            label,
        });

        return {
            registered: true,
            passkey: { id: (passkey as any).id, label, deviceType: credentialDeviceType, backedUp: credentialBackedUp },
        };
    }

    @Post("/passkeys/authenticate-options")
    async passkeyAuthenticateOptions(req: Request): Promise<object> {
        const { rpID } = getRpConfig(req);

        const options = await generateAuthenticationOptions({
            rpID,
            userVerification: "preferred",
            allowCredentials: [],
        });

        req.session.webauthnChallenge = options.challenge;

        return options;
    }

    @Post("/passkeys/authenticate-verify")
    async passkeyAuthenticateVerify(req: Request): Promise<User> {
        const challenge = req.session.webauthnChallenge;
        if (!challenge) throw new BadRequest("No challenge found. Start authentication again.");

        const { rpID, origin } = getRpConfig(req);
        const body: AuthenticationResponseJSON = req.body;

        const passkey = await Passkey.findOne({ credentialId: body.id })
            .populate({ path: "user", select: "id first last email twoFactorEnabled" })
            .lean<Passkey>()
            .exec();

        if (!passkey) throw new NotFound("Passkey not found.");

        let verification;
        try {
            verification = await verifyAuthenticationResponse({
                response: body,
                expectedChallenge: challenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
                requireUserVerification: false,
                credential: {
                    id: passkey.credentialId,
                    publicKey: Buffer.from(passkey.publicKey, "base64url") as any,
                    counter: passkey.counter,
                    transports: passkey.transports as AuthenticatorTransportFuture[] | undefined,
                },
            });
        } catch (err: any) {
            throw new Unauthorized(err?.message || "Passkey authentication failed.");
        }

        if (!verification.verified) throw new Unauthorized("Passkey authentication failed.");

        await Passkey.updateOne({ _id: (passkey as any)._id }, { counter: verification.authenticationInfo.newCounter });

        delete req.session.webauthnChallenge;

        const passkeyUser = passkey.user as any;
        req.session.user = { id: passkeyUser.id, first: passkeyUser.first };
        await this.userService.updateUser(passkeyUser.id, { lastLoggedIn: new Date() });

        return (await this.userService.getUserById(passkeyUser.id))!;
    }

    @Delete("/passkeys/:id")
    async deletePasskey(req: Request): Promise<{ deleted: boolean }> {
        if (!req.session?.user?.id) throw new Unauthorized("Not Logged In");

        const result = await Passkey.deleteOne({ _id: req.params.id, user: req.session.user.id }).exec();
        if (result.deletedCount === 0) throw new NotFound("Passkey not found.");

        return { deleted: true };
    }

    private async sendWelcomeOnSignup(user: User): Promise<void> {
        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey || !user?.email) return;

        const resend = new Resend(resendApiKey);
        const audienceId = (process.env.RESEND_AUDIENCE_ID || "").trim();

        try {
            if (audienceId) {
                const contact = await resend.contacts.create({
                    audienceId,
                    email: user.email,
                    firstName: user.first || "",
                    lastName: user.last || ""
                });

                if (contact?.error) {
                    const updated = await resend.contacts.update({
                        audienceId,
                        email: user.email,
                        firstName: user.first || "",
                        lastName: user.last || "",
                        unsubscribed: false
                    });

                    if (updated?.error) {
                        throw new Error(updated.error.message || "Unable to add user to audience.");
                    }
                }
            }

            const fromEmail = process.env.WELCOME_FROM_EMAIL || process.env.RESET_FROM_EMAIL || "TidalTask <support@tidaltask.app>";
            const subject = process.env.WELCOME_EMAIL_SUBJECT || "Welcome to TidalTask";
            const welcome = await resend.emails.send({
                from: fromEmail,
                to: user.email,
                subject,
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
                        <p>Hey!</p>
                        <p>Thank you so much for signing up for TidalTask, formerly Sequenced: ADHD Management.</p>
                        <p>When I first built TidalTask, it was just something I made to survive school. I needed a system that worked with my brain, not against it. Watching it grow into something other people actually use is unreal. It keeps me building and improving it every week.</p>
                        <p>The app has come a long way, and I rely heavily on real feedback from real ADHD brains to decide what gets better next. If you have a few minutes, I would love for you to fill out this short feedback form:</p>
                        <p><a href="https://form.jotform.com/260608522625051">https://form.jotform.com/260608522625051</a></p>
                        <p>Everything you submit is stored privately and only accessible to me. Your data is yours. Privacy matters here.</p>
                        <p>If TidalTask has helped you even a little, leaving a review on the App Store would mean a lot. Reviews genuinely help the app grow and reach more people who need support. And if you would rather just email me directly with feedback, that works too.</p>
                        <p>We also moved TidalTask off the parent company site and gave it its own home. You can explore features, join the newsletter, and follow along here:</p>
                        <p><a href="https://www.tidaltask.app">https://www.tidaltask.app</a></p>
                        <p>If you would like me to manually add you to the newsletter, just send me an email and I will handle it.</p>
                        <p>If you ever want to share ideas, ask questions, or just talk through how you are using the app, my inbox is always open.</p>
                        <p>Thank you for helping shape TidalTask into the ADHD task companion it is becoming.</p>
                        <p>
                            Daniel Wedding | Founder<br />
                            <a href="mailto:daniel@tidaltask.app">daniel@tidaltask.app</a>
                        </p>
                    </div>
                `
            });

            if (welcome?.error) {
                throw new Error(welcome.error.message || "Unable to send welcome email.");
            }
        } catch (error) {
            await sendToWebhook({
                embeds: [
                    {
                        title: "Welcome Email Failed",
                        description: `User **${user.id}** (${user.email}) failed welcome flow: ${String((error as Error)?.message || error)}`,
                        timestamp: new Date()
                    }
                ]
            });
        }
    }

}
