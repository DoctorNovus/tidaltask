import AddIcon from "../Icons/AddIcon";
import HomeIcon from "../Icons/HomeIcon";
import SettingsIcon from "../Icons/SettingsIcon";
import { useState } from "react";
import TaskInfoMenu from "../TaskInfoMenu";
import TasksIcon from "../Icons/TasksIcon";
import NavItem from "./NavItem";
import { useAuth } from "@/hooks/auth";
import CalendarViewIcon from "../Icons/CalendarViewIcon";

import icon from "@/assets/icon.png";

export function NavBar() {
  const auth = useAuth();

  const [isAdding, setIsAdding] = useState(false);

  const renderMobileBar = (isInteractive: boolean) => (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 flex justify-center px-4 md:!hidden">
      <div className="pointer-events-auto nav-pad w-full max-w-2xl h-19 rounded-3xl border ring-0 bg-(--surface-card) border-(--nav-border) backdrop-blur-xl shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
        <div className="relative flex h-full items-center justify-between px-3 py-3">
          <div className="flex flex-1 items-center justify-evenly gap-2">
            <NavItem to="/" title="Home">
              <HomeIcon />
            </NavItem>
            <NavItem to="/tasks" title="Tasks">
              <TasksIcon />
            </NavItem>
          </div>

          <div className="flex flex-none items-center justify-center px-2">
            <button
              disabled={!isInteractive}
              onClick={isInteractive ? () => setIsAdding(true) : undefined}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-r from-accent-blue-700 to-accent-blue-500 text-white shadow-lg shadow-accent-blue/25 ring-1 ring-white transition hover:-translate-y-1 hover:scale-[1.05] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex justify-center items-center w-full h-full p-2 fill-current">
                <AddIcon />
              </div>
            </button>
          </div>

          <div className="flex flex-1 items-center justify-evenly gap-2">
            <NavItem to="/calendar" title="Calendar">
              <CalendarViewIcon />
            </NavItem>
            <NavItem to="/settings" title="Settings">
              <SettingsIcon />
            </NavItem>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSidebar = (isInteractive: boolean) => (
    <div className="flex max-md:hidden fixed inset-y-0 left-0 w-56 flex-col z-40 border-r bg-white dark:bg-(--surface-card)" style={{ borderColor: "var(--surface-border)" }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "var(--surface-border)" }}>
        <img src={icon} className="w-9 h-9 rounded-xl shadow-sm" />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-primary">TidalTask</span>
          <span className="text-xs text-muted">Plan • Track • Repeat</span>
        </div>
      </div>

      {/* New Task */}
      <div className="px-3 py-4">
        <button
          disabled={!isInteractive}
          onClick={isInteractive ? () => setIsAdding(true) : undefined}
          className="flex w-full items-center gap-3 rounded-xl bg-linear-to-r from-accent-blue-700 to-accent-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-accent-blue/25 transition hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 flex-shrink-0">
            <AddIcon />
          </div>
          New Task
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-3 flex-1">
        <NavItem to="/" title="Home" sidebar>
          <HomeIcon />
        </NavItem>
        <NavItem to="/tasks" title="Tasks" sidebar>
          <TasksIcon />
        </NavItem>
        <NavItem to="/calendar" title="Calendar" sidebar>
          <CalendarViewIcon />
        </NavItem>
      </nav>

      {/* Settings pinned to bottom */}
      <div className="px-3 pb-5 pt-3 border-t" style={{ borderColor: "var(--surface-border)" }}>
        <NavItem to="/settings" title="Settings" sidebar>
          <SettingsIcon />
        </NavItem>
      </div>
    </div>
  );

  const isAuthed =
    auth.isSuccess && (auth.data?.message === "Logged In" || !auth.data?.statusCode);
  const showBar = true;

  return (
    <>
      {showBar && (
        <>
          {renderMobileBar(isAuthed)}
          {renderSidebar(isAuthed)}
          <TaskInfoMenu type="add" isOpen={isAdding} setIsOpen={setIsAdding} />
        </>
      )}
    </>
  );
}
