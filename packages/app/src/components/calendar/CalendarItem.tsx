import { useApp } from "@/hooks/app";

export default function CalendarItem({ skeleton, date }: { skeleton?: boolean; date: Date }) {
  const [appData, setAppData] = useApp();

  const changeDate = (date: Date) => {
    setAppData({ ...appData, activeDate: date });
  };

  if (skeleton) {
    return (
      <div className="flex-1 min-w-0">
        <div className="w-full flex flex-col items-center justify-center rounded-2xl py-3 px-1 overflow-hidden opacity-40">
          <span className="text-sm font-semibold text-slate-400">—</span>
        </div>
      </div>
    );
  }

  const today = new Date();
  const isToday = today.toDateString() === date.toDateString();
  const isActive = appData.activeDate?.toDateString?.() === date.toDateString();

  const dayName = date.toLocaleDateString(undefined, { weekday: "short" });

  let btnClasses = "w-full flex flex-col items-center justify-center rounded-2xl py-3 px-1 gap-0.5 overflow-hidden transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue-600";
  let textClasses = "text-xs font-semibold truncate";
  let numClasses = "text-base font-semibold";

  if (isActive) {
    btnClasses += " bg-accent-blue-700 ring-2 ring-accent-blue-300 shadow-md";
    textClasses += " text-white";
    numClasses += " text-white";
  } else if (isToday) {
    btnClasses += " bg-accent-blue-50 border border-accent-blue/30 dark:bg-(--accent-subtle)";
    textClasses += " text-accent-blue-600 dark:text-accent-blue-400";
    numClasses += " text-accent-blue-600 dark:text-accent-blue-400";
  } else {
    btnClasses += " hover:bg-slate-100 dark:hover:bg-(--surface-raised)";
    textClasses += " text-slate-700 dark:text-slate-200";
    numClasses += " text-slate-700 dark:text-slate-200";
  }

  return (
    <div className="flex-1 min-w-0">
      <button
        type="button"
        onClick={() => changeDate(date)}
        aria-pressed={isActive}
        className={btnClasses}
      >
        {/* Desktop: day name (Mon, Tue…) */}
        <span className={`max-md:hidden ${textClasses}`}>{dayName}</span>
        {/* Mobile: date number */}
        <span className={`md:hidden ${numClasses}`}>{date.getDate()}</span>
      </button>
    </div>
  );
}
