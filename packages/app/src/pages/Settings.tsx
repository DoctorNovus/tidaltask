import {
  cancelNotification,
  getPending,
  setDailyReminders,
} from "@/utils/notifs";
import { Settings, getSettings, setSettings } from "@/hooks/settings";
import { useEffect, useState, FormEvent } from "react";
import UserLogin from "./(Settings)/UserLogin";
import SecuritySettings from "./(Settings)/SecuritySettings";
import { Logger } from "@/utils/logger";
import DeveloperSettings from "./(Settings)/DeveloperSettings";
import ControllerUser from "./(Settings)/ControlledUser";
import AnnouncementManager from "./(Settings)/AnnouncementManager";
import WhatsNew from "./(Settings)/WhatsNew";
import ServerNotificationSettings from "./(Settings)/ServerNotificationSettings";
import ThemeSettings from "./(Settings)/ThemeSettings";
import CalendarSyncSettings from "./(Settings)/CalendarSyncSettings";
import DeveloperNotificationSender from "./(Settings)/DeveloperNotificationSender";
import { useDeleteCompletedTasks } from "@/hooks/tasks";
import xIcon from "@/assets/social_icons/x.svg";
import instagramIcon from "@/assets/social_icons/instagram.svg";
import facebookIcon from "@/assets/social_icons/facebook.svg";
import discordIcon from "@/assets/social_icons/discord.svg";
import { useApp } from "@/hooks/app";
import { useApiKeys, useChangePassword, useExportUserData, useGenerateApiKey, useRequestUserDeletion, useUpdateApiKeys, useUpdateProfile, useUser } from "@/hooks/user";
import { SecureToken } from "@/plugins/secureToken";
import { Capacitor } from "@capacitor/core";
import { fetchData } from "@/utils/data";
import { StarIcon, ChevronDownIcon, SunIcon, MoonIcon, ComputerDesktopIcon, XMarkIcon } from "@heroicons/react/24/solid";

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "support@tidaltask.app";

export default function SettingsPage() {
  const [tempSettings, setTempSettings] = useState<Settings>({});
  const { mutateAsync: deleteCompletedTasks, isPending: isCleanupPending } = useDeleteCompletedTasks();
  const [cleanupInterval, setCleanupInterval] = useState<string>("30");
  const [cleanupStatus, setCleanupStatus] = useState<string>("");
  const [appState, setAppState] = useApp();
  const user = useUser();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const exportUserData = useExportUserData();
  const requestUserDeletion = useRequestUserDeletion();
  const apiKeysQuery = useApiKeys();
  const updateApiKeys = useUpdateApiKeys();
  const generateApiKey = useGenerateApiKey();
  const [profileForm, setProfileForm] = useState({ first: "", last: "", email: "" });
  const [profileMessage, setProfileMessage] = useState<string>("");
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [passwordMessage, setPasswordMessage] = useState<string>("");
  const [dataMessage, setDataMessage] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deleteInput, setDeleteInput] = useState<string>("");
  const [showChangePassword, setShowChangePassword] = useState<boolean>(false);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewMessage, setReviewMessage] = useState<string>("");
  const [reviewStatus, setReviewStatus] = useState<string>("");
  const [apiKeyName, setApiKeyName] = useState<string>("");
  const [apiKeyMessage, setApiKeyMessage] = useState<string>("");
  const [apiKeyValue, setApiKeyValue] = useState<string>("");
  const [apiKeyCopied, setApiKeyCopied] = useState<boolean>(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState<boolean>(false);
  const [siriMessage, setSiriMessage] = useState<string>("");
  const [apiKeysSynced, setApiKeysSynced] = useState<boolean>(false);

  useEffect(() => {
    getSettings().then(async (tempSettings) => {
      setTempSettings(tempSettings);
    });
  }, []);

  useEffect(() => {
    if (user.isSuccess && user.data) {
      setProfileForm({
        first: user.data.first || "",
        last: user.data.last || "",
        email: user.data.email || ""
      });
    }
  }, [user.isSuccess, user.data]);

  useEffect(() => {
    if (apiKeysSynced || !apiKeysQuery.isSuccess) return;

    const serverKeys = apiKeysQuery.data || {};
    const localKeys = tempSettings.apiKeys || {};
    const serverHasKeys = Object.keys(serverKeys).length > 0;
    const localHasKeys = Object.keys(localKeys).length > 0;

    if (!serverHasKeys && localHasKeys) {
      updateApiKeys.mutateAsync(localKeys)
        .then(() => setApiKeyMessage("Synced existing keys to the server."))
        .catch((err) => setApiKeyMessage(err?.message || "Unable to sync API keys."))
        .finally(() => setApiKeysSynced(true));
      return;
    }

    if (serverHasKeys) {
      const mergedKeys = { ...localKeys, ...serverKeys };
      const nextSettings: Settings = {
        ...tempSettings,
        apiKeys: Object.keys(mergedKeys).length ? mergedKeys : undefined
      };
      setTempSettings(nextSettings);
      setSettings(nextSettings);
    }

    setApiKeysSynced(true);
  }, [apiKeysQuery.isSuccess, apiKeysQuery.data, apiKeysSynced, tempSettings, updateApiKeys]);

  const UpdateSettings = async (newValue: object) => {
    const settings: Settings = { ...tempSettings, ...newValue };

    setTempSettings(settings);
    setSettings(settings);

    if (tempSettings.sendDailyReminders && !settings.sendDailyReminders)
      HandleDailyChange(false);

    if (!tempSettings.sendDailyReminders && settings.sendDailyReminders)
      HandleDailyChange(true);
  };

  const handleCleanup = async () => {
    setCleanupStatus("");
    try {
      const days = cleanupInterval === "all" ? undefined : parseInt(cleanupInterval, 10);
      const result = await deleteCompletedTasks(days);
      setCleanupStatus(result.deleted > 0 ? `Deleted ${result.deleted} task${result.deleted === 1 ? "" : "s"}.` : "No completed tasks to delete.");
    } catch (err: any) {
      setCleanupStatus(err?.message || "Failed to delete tasks.");
    }
  };

  const HandleDailyChange = async (newValue: boolean) => {
    if (!newValue) {
      const pendingNotifications = (await getPending()).notifications;
      for (let i = 0; i < pendingNotifications.length; i++) {
        const pendingItem = pendingNotifications[i];
        if (pendingItem.schedule && pendingItem.schedule.every == "day")
          cancelNotification(pendingItem);
      }
    }

    if (newValue) {
      let setTime = tempSettings.sendDailyRemindersTime;
      if (!setTime) {
        setTempSettings({ ...tempSettings, sendDailyRemindersTime: "08:00" });
        setTime = "08:00";
      }

      const timeParts = setTime.split(":");
      const hour = parseInt(timeParts[0]);
      const minute = parseInt(timeParts[1]);

      await setDailyReminders(hour, minute);

      Logger.log(`Set Daily Reminders!`);
    }
  };

  const setTheme = (next: "light" | "dark" | "auto") => {
    setAppState({ ...appState, theme: next });
  };

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMessage("");
    try {
      await updateProfile.mutateAsync(profileForm);
      setProfileMessage("Profile updated.");
    } catch (err: any) {
      setProfileMessage(err?.message || "Unable to update profile.");
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordMessage("New passwords do not match.");
      return;
    }
    setPasswordMessage("");
    try {
      await changePassword.mutateAsync({
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next
      });
      setPasswordMessage("Password updated.");
      setPasswordForm({ current: "", next: "", confirm: "" });
    } catch (err: any) {
      setPasswordMessage(err?.message || "Unable to update password.");
    }
  };

  const handleDownloadData = async () => {
    setDataMessage("");
    try {
      const data = await exportUserData.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "tidaltask-account-data.json";
      link.click();
      URL.revokeObjectURL(url);
      setDataMessage("Download started.");
    } catch (err: any) {
      setDataMessage(err?.message || "Unable to download data.");
    }
  };

  const handleDeleteData = async () => {
    setDataMessage("");
    if (deleteInput.trim().toUpperCase() !== "DELETE") {
      setDataMessage("Type DELETE to confirm.");
      return;
    }
    try {
      const resp = await requestUserDeletion.mutateAsync();
      setDataMessage(
        `Deletion requested. Removed from ${resp.removedFromTasks} tasks; deleted ${resp.deletedTasks} tasks. This cannot be undone.`
      );
      setShowDeleteConfirm(false);
      setDeleteInput("");
      await fetchData("/auth/logout", { method: "POST" });
      window.location.href = "/auth";
    } catch (err: any) {
      setDataMessage(err?.message || "Unable to process deletion.");
    }
  };

  const submitReview = async (e: FormEvent) => {
    e.preventDefault();
    setReviewStatus("");
    if (reviewRating < 1 || reviewRating > 5) {
      setReviewStatus("Please pick a rating between 1 and 5 stars.");
      return;
    }
    try {
      await fetchData("/review", {
        method: "POST",
        body: { rating: reviewRating, message: reviewMessage.trim() }
      });
      setReviewStatus("Thanks for your feedback!");
      setReviewMessage("");
      setReviewRating(5);
    } catch (err: any) {
      setReviewStatus(err?.message || "Unable to submit review right now.");
    }
  };

  const maskApiKey = (value: string) => {
    if (!value) return "";
    const tail = value.slice(-4);
    const maskedCount = Math.max(4, value.length - 4);
    return `${"*".repeat(maskedCount)}${tail}`;
  };

  const handleGenerateApiKey = async () => {
    setApiKeyMessage("");
    setApiKeyCopied(false);
    const name = apiKeyName.trim();
    if (!name) {
      setApiKeyMessage("Provide a name before generating.");
      return;
    }

    try {
      const result = await generateApiKey.mutateAsync(name);
      const nextKeys = { ...(tempSettings.apiKeys || {}), [result.name]: result.value };
      UpdateSettings({ apiKeys: nextKeys });
      setApiKeyValue(result.value);
      setShowApiKeyDialog(true);
      setApiKeyMessage("");
    } catch (err: any) {
      setApiKeyMessage(err?.message || "Unable to generate API key.");
    }
  };

  const handleCopyApiKey = async () => {
    if (!apiKeyValue) {
      setApiKeyMessage("Generate a key first.");
      return;
    }

    try {
      await navigator.clipboard.writeText(apiKeyValue);
      setApiKeyCopied(true);
      setApiKeyMessage("Copied to clipboard.");
    } catch (err: any) {
      setApiKeyMessage(err?.message || "Unable to copy key.");
    }
  };

  const closeApiKeyDialog = () => {
    setShowApiKeyDialog(false);
    setApiKeyValue("");
    setApiKeyCopied(false);
    setApiKeyName("");
  };

  const handleEnableSiri = async () => {
    setSiriMessage("");
    if (Capacitor.getPlatform() === "web") {
      setSiriMessage("Siri is only available on iOS.");
      return;
    }

    try {
      const response = await fetchData("/auth/device-token", {
        method: "POST",
        body: { label: "Siri" }
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.message || "Unable to enable Siri.");
      }
      const data = await response.json().catch(() => ({}));
      if (typeof data?.token === "string" && data.token.trim()) {
        await SecureToken.setToken({ token: data.token });
        setSiriMessage("Siri enabled for this device.");
      } else {
        setSiriMessage("Unable to store device token.");
      }
    } catch (err: any) {
      setSiriMessage(err?.message || "Unable to enable Siri.");
    }
  };

  const [collapsed, setCollapsed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("settings-collapsed") || "[]"); }
    catch { return []; }
  });
  const toggleSection = (id: string) => {
    setCollapsed((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem("settings-collapsed", JSON.stringify(next));
      return next;
    });
  };
  const isClosed = (id: string) => collapsed.includes(id);

  const SectionHeader = ({ id, title, subtitle, badge }: { id: string; title: string; subtitle?: string; badge?: string }) => (
    <button
      type="button"
      onClick={() => toggleSection(id)}
      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left bg-silver-200 dark:bg-(--surface-raised) hover:bg-silver-300 dark:hover:bg-(--surface-card) transition-colors"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-primary">{title}</span>
          {badge && (
            <span className="rounded-full bg-accent-blue/10 px-2 py-0.5 text-[11px] font-semibold text-accent-blue dark:bg-[rgba(48,122,207,0.18)] dark:text-accent-blue">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
      </div>
      <ChevronDownIcon
        className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${isClosed(id) ? "-rotate-90" : ""}`}
      />
    </button>
  );

  const handleRemoveApiKey = async (name: string) => {
    setApiKeyMessage("");
    const nextKeys = { ...(tempSettings.apiKeys || {}) };
    delete nextKeys[name];
    try {
      await updateApiKeys.mutateAsync(nextKeys);
      UpdateSettings({ apiKeys: Object.keys(nextKeys).length ? nextKeys : undefined });
      setApiKeyMessage("Removed.");
    } catch (err: any) {
      setApiKeyMessage(err?.message || "Unable to remove API key.");
    }
  };

  return (
    <div className="flex flex-col w-full h-full px-3 md:px-6 lg:px-10 py-4 pb-28 gap-6 items-center overflow-y-auto">
      <div className="w-full max-w-3xl">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-primary">Settings</h1>
          <p className="text-sm text-muted">Control reminders, account status, and other settings.</p>
        </div>
      </div>
      <div className="w-full max-w-3xl flex flex-col gap-2">
        <div className="rounded-2xl surface-card border shadow-sm overflow-hidden">
          <SectionHeader id="profile" title="Profile" subtitle="Manage your account details and privacy." />
          {!isClosed("profile") && (
          <div className="px-4 py-4 flex flex-col gap-4 border-t border-(--surface-border)">
          {user.isSuccess && user.data?.lastLoggedIn && (
            <span className="text-xs text-muted pt-1">
              Last logged in: {new Date(user.data.lastLoggedIn).toLocaleString()}
            </span>
          )}
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={handleProfileSubmit}>
            <label className="flex flex-col gap-1 text-sm text-primary">
              First name
              <input
                type="text"
                value={profileForm.first}
                onChange={(e) => setProfileForm({ ...profileForm, first: e.target.value })}
                className="rounded-lg border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-3 py-2 text-sm text-primary focus:border-accent-blue focus:outline-hidden"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-primary">
              Last name
              <input
                type="text"
                value={profileForm.last}
                onChange={(e) => setProfileForm({ ...profileForm, last: e.target.value })}
                className="rounded-lg border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-3 py-2 text-sm text-primary focus:border-accent-blue focus:outline-hidden"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-primary md:col-span-2">
              Email
              <input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                className="rounded-lg border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-3 py-2 text-sm text-primary focus:border-accent-blue focus:outline-hidden"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2 md:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-accent-blue px-3 py-2 text-sm font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition disabled:opacity-70"
                disabled={updateProfile.isPending || user.isLoading}
              >
                {updateProfile.isPending ? "Saving..." : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => { setShowChangePassword(true); setPasswordMessage(""); }}
                className="rounded-lg border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-3 py-2 text-sm font-semibold text-primary hover:-translate-y-px transition"
              >
                Change password
              </button>
              {profileMessage && <span className="text-sm text-muted">{profileMessage}</span>}
            </div>
          </form>

          {showChangePassword && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs px-4"
              onClick={(e) => { if (e.target === e.currentTarget) { setShowChangePassword(false); setPasswordMessage(""); } }}
            >
              <div className="w-full max-w-md rounded-2xl surface-card border shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-(--surface-border)">
                  <h3 className="text-base font-semibold text-primary">Change password</h3>
                  <button
                    type="button"
                    onClick={() => { setShowChangePassword(false); setPasswordMessage(""); }}
                    className="rounded-lg p-1.5 text-muted transition hover:text-primary hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <XMarkIcon className="h-5 w-5 brightness-0 invert" />
                  </button>
                </div>
                <form className="flex flex-col gap-4 p-5" onSubmit={async (e) => { await handlePasswordSubmit(e); if (!passwordMessage) setShowChangePassword(false); }}>
                  <label className="flex flex-col gap-1 text-sm text-primary">
                    Current password
                    <input
                      type="password"
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                      className="rounded-lg border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-3 py-2 text-sm text-primary focus:border-accent-blue focus:outline-hidden"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-primary">
                    New password
                    <input
                      type="password"
                      value={passwordForm.next}
                      onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
                      className="rounded-lg border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-3 py-2 text-sm text-primary focus:border-accent-blue focus:outline-hidden"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-primary">
                    Confirm new password
                    <input
                      type="password"
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                      className="rounded-lg border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-3 py-2 text-sm text-primary focus:border-accent-blue focus:outline-hidden"
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-accent-blue px-3 py-2 text-sm font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition disabled:opacity-70"
                      disabled={changePassword.isPending}
                    >
                      {changePassword.isPending ? "Updating..." : "Update password"}
                    </button>
                    {passwordMessage && <span className="text-sm text-muted">{passwordMessage}</span>}
                  </div>
                </form>
              </div>
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-primary mb-2">Privacy</h3>
            <div className="flex flex-wrap gap-3 items-center">
              <button
                type="button"
                onClick={handleDownloadData}
                className="rounded-lg bg-accent-blue px-3 py-2 text-sm font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition disabled:opacity-70"
                disabled={exportUserData.isPending}
              >
                {exportUserData.isPending ? "Preparing..." : "Download my data"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm((prev) => !prev);
                  setDataMessage("");
                }}
                className="rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:-translate-y-px transition"
              >
                {showDeleteConfirm ? "Cancel" : "Confirm deletion"}
              </button>
              {showDeleteConfirm && (
                <div className="w-full rounded-xl border border-red-200/70 bg-red-50/70 p-3 text-left shadow-xs dark:border-red-500/50 dark:bg-red-500/10">
                  <p className="text-sm font-semibold text-red-800 dark:text-red-100">
                    This will permanently delete all of your TidalTask data (tasks, tags, account). There is no way to recover it.
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    <label className="text-xs font-semibold text-primary dark:text-white">Type DELETE to confirm</label>
                    <input
                      type="text"
                      value={deleteInput}
                      onChange={(e) => setDeleteInput(e.target.value)}
                      placeholder="DELETE"
                      className="w-full rounded-lg border border-red-300 bg-silver-200 px-2 py-2 text-sm focus:border-red-500 focus:outline-hidden dark:border-red-500/60 dark:bg-(--surface-raised) dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleDeleteData}
                      className="self-start rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-xs shadow-red-400/40 hover:-translate-y-px transition disabled:opacity-70"
                      disabled={requestUserDeletion.isPending}
                    >
                      {requestUserDeletion.isPending ? "Deleting..." : "Delete everything"}
                    </button>
                  </div>
                </div>
              )}
              {dataMessage && <span className="text-sm text-muted">{dataMessage}</span>}
            </div>
          </div>
          </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-1 pt-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted shrink-0">Preferences</span>
          <div className="flex-1 border-t border-(--surface-border)" />
        </div>

        <div className="rounded-2xl surface-card border shadow-sm overflow-hidden">
          <SectionHeader
            id="appearance"
            title="Appearance"
            subtitle="Choose light, dark, or follow your device."
            badge={(appState?.theme ?? "auto") === "auto" ? "Auto" : (appState?.theme ?? "Light")}
          />
          {!isClosed("appearance") && (
          <div className="px-4 py-4 border-t border-(--surface-border)">
            <div className="inline-flex items-center gap-1 rounded-xl bg-silver-200 dark:bg-(--surface-card) p-1">
              {([
                { id: "light", label: "Light", Icon: SunIcon },
                { id: "dark",  label: "Dark",  Icon: MoonIcon },
                { id: "auto",  label: "Auto",  Icon: ComputerDesktopIcon },
              ] as const).map(({ id, label, Icon }) => {
                const isActive = (appState?.theme ?? "auto") === id;
                return (
                  <button
                    key={id}
                    type="button"
                    title={label}
                    onClick={() => setTheme(id)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      isActive
                        ? "bg-accent-blue text-white shadow-xs shadow-accent-blue/30"
                        : "text-muted hover:text-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          )}
        </div>

        <div className="rounded-2xl surface-card border shadow-sm overflow-hidden">
          <SectionHeader id="theme" title="Theme" subtitle="Choose a preset or pick your own accent color." />
          {!isClosed("theme") && (
          <div className="px-4 py-4 border-t border-(--surface-border)">
            <ThemeSettings />
          </div>
          )}
        </div>

        <div className="rounded-2xl surface-card border shadow-sm overflow-hidden">
          <SectionHeader id="notifications" title="Notifications" subtitle="Configure reminders and push alerts." />
          {!isClosed("notifications") && (
          <div className="px-4 py-4 border-t border-(--surface-border)">
            <ServerNotificationSettings />
          </div>
          )}
        </div>

        <div className="rounded-2xl surface-card border shadow-sm overflow-hidden">
          <SectionHeader id="calendar" title="Calendar Sync" subtitle="Subscribe to your tasks in any calendar app." />
          {!isClosed("calendar") && (
          <div className="px-4 py-4 border-t border-(--surface-border)">
            <CalendarSyncSettings />
          </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-1 pt-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted shrink-0">Tools</span>
          <div className="flex-1 border-t border-(--surface-border)" />
        </div>

        <div className="rounded-2xl surface-card border shadow-sm overflow-hidden">
          <SectionHeader id="feedback" title="Feedback" subtitle="Share a rating or leave us a note." />
          {!isClosed("feedback") && (
          <div className="px-4 py-4 flex flex-col gap-3 border-t border-(--surface-border)">
          <div className="flex flex-col gap-3 pt-1">
            <form className="flex flex-col gap-3" onSubmit={submitReview}>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm font-semibold text-primary">Rating</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((value) => {
                    const isActive = reviewRating >= value;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-label={`${value} star${value > 1 ? "s" : ""}`}
                        onClick={() => setReviewRating(value)}
                        className="rounded-full p-1 transition hover:scale-105"
                      >
                        <StarIcon
                          className={`h-6 w-6 ${isActive ? "text-amber-400" : "text-slate-300"}`}
                        />
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs text-muted">Tap to set 1-5 stars.</span>
              </div>
              <label className="flex flex-col gap-1 text-sm text-primary">
                Optional message
                <textarea
                  value={reviewMessage}
                  onChange={(e) => setReviewMessage(e.target.value)}
                  rows={3}
                  placeholder="What’s working well? What should we improve?"
                  className="w-full rounded-lg border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-3 py-2 text-sm text-primary focus:border-accent-blue focus:outline-hidden"
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-accent-blue px-3 py-2 text-sm font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition disabled:opacity-70"
                  disabled={reviewRating < 1 || reviewRating > 5}
                >
                  Send review
                </button>
                {reviewStatus && <span className="text-sm text-muted">{reviewStatus}</span>}
              </div>
            </form>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-primary">Prefer email?</span>
              <button
                type="button"
                className="inline-flex w-fit items-center gap-2 rounded-lg bg-accent-blue px-3 py-2 text-sm font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition"
                onClick={() => window.open(`mailto:${SUPPORT_EMAIL}?subject=TidalTask%20Feedback`, "_self")}
              >
                <span className="text-lg">✉️</span>
                Email support ({SUPPORT_EMAIL})
              </button>
            </div>
          </div>
          </div>
          )}
        </div>

        <div className="rounded-2xl surface-card border shadow-sm overflow-hidden">
          <SectionHeader id="apikeys" title="API Keys" subtitle="Store integration keys for this device." />
          {!isClosed("apikeys") && (
          <div className="px-4 py-4 flex flex-col gap-3 border-t border-(--surface-border)">
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={apiKeyName}
                onChange={(e) => setApiKeyName(e.target.value)}
                placeholder="Key name (e.g. OpenAI)"
                className="flex-1 rounded-lg border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-3 py-2 text-sm text-primary focus:border-accent-blue focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleGenerateApiKey}
                className="shrink-0 rounded-lg bg-accent-blue px-3 py-2 text-sm font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition disabled:opacity-70"
                disabled={generateApiKey.isPending || updateApiKeys.isPending}
              >
                {generateApiKey.isPending ? "Generating..." : "Generate key"}
              </button>
            </div>
            {apiKeyMessage && <span className="text-sm text-muted">{apiKeyMessage}</span>}
            {showApiKeyDialog && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
                <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                  <div className="flex flex-col gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-primary">Copy your API key</h3>
                      <p className="text-sm text-muted">
                        This key is shown once. Copy it now and store it somewhere safe.
                      </p>
                    </div>
                    <div className="rounded-lg surface-card border px-3 py-2 text-sm font-mono text-primary break-all">
                      {apiKeyValue}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyApiKey}
                        className="rounded-lg bg-accent-blue px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-accent-blue/30 hover:-translate-y-px transition"
                      >
                        {apiKeyCopied ? "Copied" : "Copy key"}
                      </button>
                      <button
                        type="button"
                        onClick={closeApiKeyDialog}
                        className="rounded-lg bg-accent-blue px-3 py-2 text-sm font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition disabled:opacity-70"
                      >
                        Done
                      </button>
                      {apiKeyMessage && <span className="text-sm text-muted">{apiKeyMessage}</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {tempSettings.apiKeys && Object.keys(tempSettings.apiKeys).length > 0 && (
              <div className="flex flex-col gap-2">
                {Object.entries(tempSettings.apiKeys).map(([name, value]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-3 rounded-xl bg-silver-200 dark:bg-(--surface-raised) px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold text-primary truncate">{name}</span>
                      <span className="text-xs text-muted truncate">{maskApiKey(value)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveApiKey(name)}
                      className="shrink-0 rounded-lg bg-red-500 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:-translate-y-px transition"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-semibold text-primary">Siri integration</span>
                  <span className="text-xs text-muted">Store a device token for hands-free Siri shortcuts.</span>
                </div>
                <button
                  type="button"
                  onClick={handleEnableSiri}
                  className="rounded-lg bg-accent-blue px-3 py-2 text-xs font-semibold text-white shadow-xs shadow-accent-blue/30 hover:-translate-y-px transition"
                >
                  Enable Siri
                </button>
              </div>
              {siriMessage && <span className="text-xs text-muted">{siriMessage}</span>}
            </div>
          </div>
          </div>
          )}
        </div>

        <div className="rounded-2xl surface-card border shadow-sm overflow-hidden">
          <SectionHeader id="data" title="Delete Completed Tasks" subtitle="Remove completed non-repeating tasks manually or on a schedule." />
          {!isClosed("data") && (
          <div className="px-4 py-4 flex flex-col gap-4 border-t border-(--surface-border)">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-primary">Manual</span>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  className="rounded-lg border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-2 py-2 text-sm text-primary focus:border-accent-blue focus:outline-hidden"
                  value={cleanupInterval}
                  onChange={(e) => setCleanupInterval(e.target.value)}
                >
                  <option value="7">Older than 7 days</option>
                  <option value="30">Older than 30 days</option>
                  <option value="90">Older than 90 days</option>
                  <option value="all">All completed tasks</option>
                </select>
                <button
                  type="button"
                  className="rounded-lg bg-red-500 text-white px-3 py-2 text-sm font-semibold shadow-xs hover:-translate-y-px transition disabled:opacity-60"
                  onClick={handleCleanup}
                  disabled={isCleanupPending}
                >
                  {isCleanupPending ? "Deleting..." : "Delete now"}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-primary">Auto-delete</span>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  className="rounded-lg border border-(--surface-border) bg-silver-200 dark:bg-(--surface-raised) px-2 py-2 text-sm text-primary focus:border-accent-blue focus:outline-hidden"
                  value={String(tempSettings.autoDeleteCompletedDays ?? 0)}
                  onChange={(e) => UpdateSettings({ autoDeleteCompletedDays: parseInt(e.target.value, 10) })}
                >
                  <option value="0">Disabled</option>
                  <option value="7">After 7 days</option>
                  <option value="30">After 30 days</option>
                  <option value="90">After 90 days</option>
                </select>
                <span className="text-xs text-muted">Runs once per day when you open the app.</span>
              </div>
            </div>
            {cleanupStatus && <span className="text-sm text-muted">{cleanupStatus}</span>}
          </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-1 pt-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted shrink-0">Community</span>
          <div className="flex-1 border-t border-(--surface-border)" />
        </div>

        <div className="rounded-2xl surface-card border shadow-sm overflow-hidden">
          <SectionHeader id="community" title="Follow Ottegi" subtitle="Stay up to date with releases and progress." />
          {!isClosed("community") && (
          <div className="px-4 py-4 flex flex-col gap-4 border-t border-(--surface-border)">
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href="https://discord.gg/qeKgAKVhXa"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-silver-300 dark:bg-(--surface-raised) px-3 py-2 text-sm font-semibold text-primary shadow-xs hover:-translate-y-px transition"
              aria-label="Ottegi on Discord"
            >
              <img src={discordIcon} alt="Discord logo" className="h-5 w-5 brightness-0 invert" />
            </a>
            <a
              href="https://twitter.com/OttegiLLC"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-silver-300 dark:bg-(--surface-raised) px-3 py-2 text-sm font-semibold text-primary shadow-xs hover:-translate-y-px transition"
              aria-label="Ottegi on X"
            >
              <img src={xIcon} alt="X logo" className="h-5 w-5 brightness-0 invert" />
            </a>
            <a
              href="https://www.instagram.com/OttegiLLC"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-silver-300 dark:bg-(--surface-raised) px-3 py-2 text-sm font-semibold text-primary shadow-xs hover:-translate-y-px transition"
              aria-label="Ottegi on Instagram"
            >
              <img src={instagramIcon} alt="Instagram logo" className="h-5 w-5 brightness-0 invert" />
            </a>
            <a
              href="https://www.linkedin.com/company/ottegi"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-silver-300 dark:bg-(--surface-raised) px-3 py-2 text-sm font-semibold text-primary shadow-xs hover:-translate-y-px transition"
              aria-label="Ottegi on LinkedIn"
            >
              <span className="text-sm font-semibold text-white">in</span>
            </a>
            <a
              href="https://www.facebook.com/OttegiLLC"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-silver-300 dark:bg-(--surface-raised) px-3 py-2 text-sm font-semibold text-primary shadow-xs hover:-translate-y-px transition"
              aria-label="Ottegi on Facebook"
            >
              <img src={facebookIcon} alt="Facebook logo" className="h-5 w-5 brightness-0 invert" />
            </a>
          </div>
          <WhatsNew />
          </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-1 pt-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted shrink-0">Account</span>
          <div className="flex-1 border-t border-(--surface-border)" />
        </div>

        <div className="rounded-2xl surface-card border shadow-sm overflow-hidden">
          <SectionHeader id="security" title="Security" subtitle="Two-factor authentication and passkeys." />
          {!isClosed("security") && (
          <div className="px-4 py-4 border-t border-(--surface-border)">
            <SecuritySettings />
          </div>
          )}
        </div>

        <div className="rounded-2xl surface-card border shadow-sm overflow-hidden">
          <SectionHeader id="account" title="Session" subtitle="Manage your active login session." />
          {!isClosed("account") && (
          <div className="px-4 py-4 border-t border-(--surface-border)">
            <UserLogin />
          </div>
          )}
        </div>

        <DeveloperSettings>
          <ControllerUser />
          <AnnouncementManager />
          <DeveloperNotificationSender />
        </DeveloperSettings>
      </div>
    </div>
  );
}
