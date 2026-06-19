import { formatDate, generateWeek } from "@/utils/date";
import CalendarItem from "./CalendarItem";
import DateTimePicker from "@/pages/(Layout)/(TaskInfoMenu)/Shared/DateTimePicker";

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/16/solid";
import { useApp } from "@/hooks/app";

type ActiveCalendarProps = {
  skeleton?: boolean;
  searchSlot?: React.ReactNode;
};

export default function ActiveCalendar({ skeleton, searchSlot }: ActiveCalendarProps) {
  const [appData, setAppData] = useApp();

  const shiftWeek = (direction: number) => {
    const tempDate = new Date(appData.activeDate!);
    tempDate.setDate(tempDate.getDate() + 7 * direction);
    setAppData({ ...appData, activeDate: tempDate });
  };

  if (skeleton) {
    return (
      <div className="w-full h-full">
        <div className="p-1">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-primary">This Week</span>
            <div className="w-44 md:w-56">
              <DateTimePicker
                value={formatDate(new Date())}
                onChange={() => {}}
                dateOnly
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="hidden lg:flex shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-blue-50 text-slate-400 shadow-inner dark:bg-(--accent-subtle) dark:text-muted" aria-hidden>
                <ChevronLeftIcon className="w-6 h-6" />
              </div>
            </div>
            <div className="flex-1 flex flex-row gap-1">
              {generateWeek(new Date(), 0).map((date, key) => (
                <CalendarItem date={date} key={key} />
              ))}
            </div>
            <div className="hidden lg:flex shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-blue-50 text-slate-400 shadow-inner dark:bg-(--accent-subtle) dark:text-muted" aria-hidden>
                <ChevronRightIcon className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  let touchstartX = 0;
  let touchendX = 0;

  const dates = generateWeek(appData.activeDate || new Date(), 0);

  const checkDirection = () => {
    if (touchendX < touchstartX) return -1;
    if (touchendX > touchstartX) return 1;
    return 0;
  };

  const touchstart = (e: React.TouchEvent) => {
    touchstartX = e.changedTouches[0].screenX;
  };

  const touchend = (e: React.TouchEvent) => {
    touchendX = e.changedTouches[0].screenX;
    const direction = checkDirection();
    if (direction !== 0) {
      shiftWeek(direction);
    }
  };

  return (
    <div className="w-full h-full">
      <div className="p-1">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-primary">This Week</span>
          <div className="w-48 md:w-52">
            <DateTimePicker
              value={formatDate(appData.activeDate!)}
              onChange={(val) => {
                const [y, m, d] = val.split("-").map(Number);
                const next = new Date(appData.activeDate!);
                next.setFullYear(y); next.setMonth(m - 1); next.setDate(d);
                setAppData({ ...appData, activeDate: next });
              }}
              dateOnly
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="hidden lg:flex shrink-0">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-blue-50 text-primary shadow-inner transition hover:bg-accent-blue-100 dark:bg-(--accent-subtle)"
              onClick={() => shiftWeek(-1)}
            >
              <ChevronLeftIcon className="w-6 h-6" />
            </button>
          </div>
          <div
            className="flex-1 flex flex-row gap-1"
            onTouchStart={touchstart}
            onTouchEnd={touchend}
          >
            {dates.map((date, key) => (
              <CalendarItem date={date} key={key} />
            ))}
          </div>
          <div className="hidden lg:flex shrink-0">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-blue-50 text-primary shadow-inner transition hover:bg-accent-blue-100 dark:bg-(--accent-subtle)"
              onClick={() => shiftWeek(1)}
            >
              <ChevronRightIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {searchSlot && (
          <div className="mt-3">
            {searchSlot}
          </div>
        )}
      </div>
    </div>
  );
}
