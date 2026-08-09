import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

/**
 * Routes iOS/Android universal links (dashboard.tidaltask.app/...) opened while
 * the native app is installed into the in-app router instead of Safari/Chrome.
 */
export default function UniversalLinkBridge() {
    const navigate = useNavigate();

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const listenerPromise = CapacitorApp.addListener("appUrlOpen", ({ url }) => {
            let parsed: URL;
            try {
                parsed = new URL(url);
            } catch {
                return;
            }

            if (parsed.protocol !== "https:") return;
            navigate(`${parsed.pathname}${parsed.search}${parsed.hash}`);
        });

        return () => {
            listenerPromise.then((listener) => listener.remove());
        };
    }, [navigate]);

    return null;
}
