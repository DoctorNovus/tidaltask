import { Outlet, useLocation } from "react-router";

export default function DataContainer() {
    const location = useLocation();
    const isAuthRoute = location.pathname.startsWith("/auth");

    return (
        <div
            className="min-h-screen md:ml-56 flex flex-col overflow-x-hidden"
            style={{ background: "var(--app-background)", transition: "background 0.2s ease" }}
        >
            <div
                id="unit-container"
                className={`flex flex-1 flex-col overflow-x-hidden ${isAuthRoute ? "justify-center items-center" : "justify-start"} px-4 md:px-6 pt-2 md:pt-8`}
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
            >
                <div id="zoom-content" className="flex flex-1 flex-col w-full">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
