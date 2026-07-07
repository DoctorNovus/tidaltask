import { Injectable, Inject } from "@outwalk/firefly";
import { Review } from "./review.entity";
import { UserService } from "@/user/user.service";

@Injectable()
export class ReviewService {
    @Inject()
    userService: UserService;

    async createReview({
        rating,
        message,
        userId
    }: { rating: number; message?: string; userId?: string }) {
        const doc: Partial<Review> = { rating, message: message ?? "" };

        if (userId) {
            doc.user = userId;
            const user = await this.userService.getUserById(userId);
            if (user?.email) doc.userEmail = user.email;
        }

        return Review.create(doc);
    }

    async listReviews(): Promise<Review[]> {
        return Review.find().select("-userEmail -user").sort({ createdAt: -1 }).lean<Review[]>().exec();
    }
}
