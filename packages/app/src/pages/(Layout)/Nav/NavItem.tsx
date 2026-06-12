import { ReactNode } from "react";
import { Link, useLocation } from "react-router";

interface NavItemProps {
    to: string;
    title: string;
    children: ReactNode;
    disabled?: boolean;
    sidebar?: boolean;
}

export default function NavItem({ to, title, children, disabled, sidebar }: NavItemProps) {
    const { pathname } = useLocation();
    const isActive = pathname == to;

    if (sidebar) {
        return (
            <Link
                to={to}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors w-full ${
                    disabled ? "pointer-events-none opacity-50" : ""
                } ${
                    isActive
                        ? "bg-accent-blue/10 text-accent-blue-700 fill-accent-blue-700 dark:bg-(--accent-subtle)"
                        : "text-muted fill-muted hover:text-primary hover:fill-primary hover:bg-silver-200 dark:hover:bg-(--surface-raised)"
                }`}
            >
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {children}
                </div>
                <span>{title}</span>
            </Link>
        );
    }

    return (
        <Link
            to={to}
            aria-current={isActive ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 rounded-2xl px-2 py-1 text-[11px] font-semibold transition-colors ${disabled ? "pointer-events-none opacity-50 cursor-not-allowed" : ""} ${
                isActive
                    ? "text-accent-blue-700 fill-accent-blue-700"
                    : "text-muted fill-muted hover:text-accent-blue-600 hover:fill-accent-blue-600"
            }`}
        >
            <div
                className={`flex items-center justify-center text-center w-11 h-11 rounded-2xl transition ${
                    isActive
                        ? "bg-accent-blue-50/90 border border-accent-blue/30 shadow-[0_10px_24px_rgba(48,122,207,0.25)] dark:bg-(--accent-subtle)"
                        : "bg-transparent border border-transparent hover:border-accent-blue/20 hover:bg-accent-blue-50/60 dark:hover:bg-(--accent-subtle)"
                }`}
            >
                <div className="flex justify-center items-center w-full h-full p-1.5">
                    {children}
                </div>
            </div>
            <span>{title}</span>
        </Link>
    );
}
