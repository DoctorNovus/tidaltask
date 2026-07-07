import { Controller, Get, Inject, Middleware, Post } from "@outwalk/firefly";
import { Request } from "express";
import { ReviewService } from "./review.service";
import { session } from "@/_middleware/session";
import sendToWebhook from "@/logging/webhook";
import { BadRequest } from "@outwalk/firefly/errors";

@Controller()
@Middleware(session)
export class ReviewController {

    @Inject()
    reviewService: ReviewService;

    @Post()
    async createReview({ body, session }: Request) {
        const rating = Number(body?.rating);
        if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
            throw new BadRequest("Rating must be between 1 and 5.");
        }

        const message = typeof body?.message === "string" ? body.message.trim() : "";
        await this.reviewService.createReview({
            rating,
            message,
            userId: session?.user?.id
        });

        await sendToWebhook({
            embeds: [
                {
                    title: "New Review Submitted",
                    description: `Rating: **${rating}/5**${message ? `\nMessage: ${message}` : ""}`,
                    timestamp: new Date()
                }
            ]
        });

        return { success: true };
    }

    @Get()
    async listReviews() {
        return this.reviewService.listReviews();
    }
}
