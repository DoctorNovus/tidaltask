import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router";
import { initializeNotifications } from "@/utils/notifs";
import { AppContext, useAppReducer, applyFontScale, FONT_SCALE_OPTIONS, type FontScaleId } from "@/hooks/app";
import { applyColorTheme, getColorThemeConfig } from "@/hooks/theme";
import Home from "@/pages/Home";
import Task from "@/pages/Task";
import Settings from "./pages/Settings";
import Calendar from "./pages/Calendar";
import Layout from "@/pages/Layout";
import NoPage from "@/pages/NoPage";
import Login from "@/pages/Auth/Login";
import LoginUser from "@/pages/Auth/LoginUser";
import RegisterUser from "@/pages/Auth/RegisterUser";
import ForgotPassword from "@/pages/Auth/ForgotPassword";
import AuthBootstrap from "@/components/AuthBootstrap";
import AlarmBridge from "@/components/AlarmBridge";
import AnnouncementCenter from "@/components/announcements/AnnouncementCenter";
import { useWidgetSync } from "@/hooks/widgetSync";
import "./index.css";

/* define the query client for react-query */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
        }
    }
});
if (import.meta.env.DEV) (window as any).__queryClient = queryClient;

/** initialize the app outside the react lifecycle */
async function initialize() {
    await initializeNotifications();
}

function WidgetSyncBridge() {
    useWidgetSync();
    return null;
}

export default function App() {
    const reducer = useAppReducer();
    const [appState] = reducer;

    useEffect(() => {
        const updateThemeMeta = (theme: "light" | "dark") => {
            const themeMeta = document.querySelector<HTMLMetaElement>("#theme-color");
            const statusBar = document.querySelector<HTMLMetaElement>("#status-bar-style");

            if (statusBar) {
                statusBar.content = theme === "dark" ? "black" : "default";
            }

            if (themeMeta) {
                themeMeta.content = theme === "dark" ? "#0b0f14" : "#f7f9fb";
            }
        };

        const media = window.matchMedia?.("(prefers-color-scheme: dark)");
        const resolveTheme = () => {
            if (appState?.theme === "auto") {
                return media?.matches ? "dark" : "light";
            }
            return appState?.theme === "dark" ? "dark" : "light";
        };

        const appliedTheme = resolveTheme();
        document.documentElement.classList.toggle("dark", appliedTheme === "dark");
        document.documentElement.setAttribute("data-theme", appliedTheme);
        updateThemeMeta(appliedTheme);
        try {
            window.localStorage.setItem("tidaltask-theme", appState?.theme ?? "light");
        } catch (err) {
            console.warn("Failed to persist theme preference", err);
        }

        if (appState?.theme === "auto" && media?.addEventListener) {
            const listener = () => {
                const next = resolveTheme();
                document.documentElement.classList.toggle("dark", next === "dark");
                document.documentElement.setAttribute("data-theme", next);
                updateThemeMeta(next);
            };
            media.addEventListener("change", listener);
            return () => media.removeEventListener("change", listener);
        }
    }, [appState?.theme]);

    useEffect(() => {
        const scale = appState?.fontScale ?? "md";
        applyFontScale(scale);
        try {
            window.localStorage.setItem("tidaltask-font-scale", scale);
        } catch { /* ignore */ }
    }, [appState?.fontScale]);

    useEffect(() => {
        try {
            window.localStorage.setItem("tidaltask-task-density", appState?.taskDensity ?? "comfortable");
        } catch { /* ignore */ }
    }, [appState?.taskDensity]);

    useEffect(() => {
        try {
            window.localStorage.setItem("tidaltask-task-shape", appState?.taskShape ?? "bubbly");
        } catch { /* ignore */ }
    }, [appState?.taskShape]);

    return (
        <div className="h-full overflow-y-auto overflow-x-hidden">
            <QueryClientProvider client={queryClient}>
                <AuthBootstrap />
                <AlarmBridge />
                <WidgetSyncBridge />
                <AppContext.Provider value={reducer}>
                    <BrowserRouter>
                        <AnnouncementCenter />
                        <Routes>
                            <Route path="/" element={<Layout />}>
                                <Route index element={<Home />} />
                                <Route path="/tasks" element={<Task />} />
                                <Route path="/calendar" element={<Calendar />} />
                                <Route path="/settings" element={<Settings />}></Route>
                                <Route path="*" element={<NoPage />} />
                            </Route>
                            <Route path="/auth" element={<Login />} />
                            <Route path="/auth/login" element={<LoginUser />} />
                            <Route path="/auth/register" element={<RegisterUser />} />
                            <Route path="/auth/forgotPassword" element={<ForgotPassword />} />
                        </Routes>
                    </BrowserRouter>
                </AppContext.Provider>
            </QueryClientProvider>
        </div>
    );
}

applyColorTheme(getColorThemeConfig());
const _storedScale = window.localStorage.getItem("tidaltask-font-scale") as FontScaleId | null;
if (_storedScale && FONT_SCALE_OPTIONS.some(o => o.id === _storedScale)) {
    applyFontScale(_storedScale);
}
createRoot(document.querySelector("#root")!).render(<StrictMode><App /></StrictMode>);
initialize().catch((error) => console.error(error));
