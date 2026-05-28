import { Controller, Get, Inject, Post } from "@outwalk/firefly";
import { BadRequest, Unauthorized } from "@outwalk/firefly/errors";
import { UserService } from "@/user/user.service";
import { User } from "@/user/user.entity";
import { Request } from "express";
import sendToWebhook from "@/logging/webhook";
import { PasswordReset } from "./passwordReset.entity";
import { DeviceToken } from "./deviceToken.entity";
import crypto from "crypto";
import { Resend } from "resend";

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
    async loginToSystem(req: Request): Promise<User> {
        const { email, password } = req.body;

        const user = await this.userService.getUserByEmail(email);
        if (!user) throw new Unauthorized("Account not found. Please register an account.");

        if (!(await this.userService.validatePassword(user.id, password))) {
            throw new Unauthorized("Incorrect Email/Password Combo.");
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

        /* destroy the session and respond with a success message */
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

        // Always respond success to avoid account enumeration.
        if (!user?.id || !user.email) return { success: true };

        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity

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
