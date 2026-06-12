import { useUser } from "@/hooks/user";
import { Navigate } from "react-router";
import { useAuth } from "@/hooks/auth";

import AuthProvider from "./Auth/AuthProvider";
import HomeIntroduction from "./(Home)/HomeIntroduction";
import HomeAgenda from "./(Home)/HomeAgenda";
import HomeUpcoming from "./(Home)/HomeUpcoming";
import HomeAnnouncements from "./(Home)/HomeAnnouncements";

const Home = () => {
    const auth = useAuth();
    const user = useUser();

    if (auth.isSuccess && auth.data.message != "Logged In")
        return <Navigate to="/auth" />

    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (auth.isLoading)
        return (
            <div className="w-full flex flex-col pb-24 md:pb-4">
                <div className="w-full flex flex-col gap-6 md:grid md:grid-cols-[1fr_300px] md:items-start">
                    <div className="flex flex-col gap-6">
                        <HomeIntroduction skeleton={true} />
                        <HomeAgenda skeleton={true} />
                        <HomeUpcoming skeleton={true} />
                    </div>
                    <div />
                </div>
            </div>
        )

    return (
        <AuthProvider>
            <div className="w-full flex flex-col pb-24 md:pb-4">
                <div className="w-full flex flex-col gap-6 md:grid md:grid-cols-[1fr_300px] md:items-start">
                    <div className="flex flex-col gap-6">
                        <HomeIntroduction user={user} today={today} />
                        <HomeAgenda />
                        <HomeUpcoming />
                    </div>
                    <HomeAnnouncements />
                </div>
            </div>
        </AuthProvider>
    )

};

export default Home;
