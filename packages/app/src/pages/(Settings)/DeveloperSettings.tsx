import { useUser } from "@/hooks/user";
import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";

export default function DeveloperSettings({ children }: React.PropsWithChildren) {
    const user = useUser();
    const [isOpen, setIsOpen] = useState(false);

    if (user.isLoading || !user.isSuccess || !user.data?.developer) return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="self-start rounded-lg border border-accent-blue/20 px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-accent-blue/50 hover:text-accent-blue"
            >
                Admin
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-xs px-4 pb-4 sm:pb-0"
                    onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
                >
                    <div className="w-full max-w-3xl rounded-2xl surface-card border shadow-2xl overflow-y-auto max-h-[85vh]">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-(--surface-border)">
                            <div>
                                <h2 className="text-base font-semibold text-primary">Admin</h2>
                                <p className="text-xs text-muted">Restricted to developer accounts.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="rounded-lg p-1.5 text-muted transition hover:text-primary hover:bg-black/5 dark:hover:bg-white/10"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="flex flex-col gap-5 p-5">
                            {children}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
