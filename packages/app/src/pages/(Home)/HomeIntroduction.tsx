import { DaysAsNumbers, MonthsAsNumbers, getDateDD, getNameByDate, getNameByMonth } from "@/utils/date";

interface IntroductionParams {
    skeleton?: boolean;
    user?: any;
    today?: Date;
}

export default function HomeIntroduction({ skeleton, user, today }: IntroductionParams) {
    if (skeleton)
        return (
            <>
                <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-accent-blue-700 to-accent-blue-500 px-6 py-5 text-white shadow-2xl md:hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.2),transparent_35%)]" />
                    <div className="relative flex flex-col gap-2">
                        <span className="text-sm uppercase tracking-[0.18em] text-white/70">Today</span>
                        <span className="text-3xl font-semibold">Hello!</span>
                        <span className="text-lg text-white/80">Loading your day...</span>
                    </div>
                </div>
                <div className="hidden md:flex items-center justify-between gap-4 pt-1 pb-2 border-b border-(--surface-border)">
                    <div className="flex flex-col gap-1">
                        <div className="h-7 w-40 rounded-lg bg-silver-200 dark:bg-(--surface-raised) animate-pulse" />
                        <div className="h-4 w-28 rounded bg-silver-200 dark:bg-(--surface-raised) animate-pulse" />
                    </div>
                </div>
            </>
        )

    const hasName = user?.isSuccess && user.data.first;
    const activeDay = today || new Date();
    return (
        <>
            {/* Mobile: full hero banner */}
            <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-accent-blue-700 via-accent-blue-600 to-accent-blue-500 px-6 py-5 text-white shadow-2xl md:hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(255,255,255,0.25),transparent_35%)] opacity-80" />
                <div className="absolute -right-6 -bottom-10 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
                <div className="relative flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <span className="text-sm uppercase tracking-[0.18em] text-white/70">Today</span>
                        <span className="text-3xl font-semibold">
                            Hello{hasName ? ` ${user.data.first}` : ""}!
                        </span>
                    </div>
                    <a
                        href={`/calendar?scope=today&view=week`}
                        className="inline-flex w-fit items-center gap-2 rounded-2xl bg-white/12 px-3 py-1.5 text-base font-semibold text-white"
                    >
                        <span>{getNameByDate(activeDay.getDay() as DaysAsNumbers)},</span>
                        <span>{getNameByMonth(activeDay.getMonth() as MonthsAsNumbers)} {getDateDD(activeDay)}</span>
                    </a>
                </div>
            </div>

            {/* Desktop: compact header */}
            <div className="hidden md:flex items-center justify-between pt-1 pb-2 border-b border-(--surface-border)">
                <h1 className="text-2xl font-semibold text-primary">
                    Hello{hasName ? `, ${user.data.first}` : ""}!
                </h1>
                <a
                    href={`/calendar?scope=today&view=week`}
                    className="text-sm text-muted hover:text-primary transition-colors"
                >
                    {getNameByDate(activeDay.getDay() as DaysAsNumbers)}, {getNameByMonth(activeDay.getMonth() as MonthsAsNumbers)} {getDateDD(activeDay)}
                </a>
            </div>
        </>
    )
}
