import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import ArrowBack from "../(Login)/ArrowBack";
import { useCompletePasswordReset, useRequestPasswordReset, useValidateResetToken } from "@/hooks/auth";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const requestReset = useRequestPasswordReset();
  const completeReset = useCompletePasswordReset();
  const validateToken = useValidateResetToken(token);

  const tokenInvalid = validateToken.isSuccess && !validateToken.data?.valid;

  const handleRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setStatus("");

    try {
      await requestReset.mutateAsync({ email });
      setStatus("If that email is registered, a reset link is on the way.");
    } catch (err: any) {
      setError(err?.message || "Unable to send reset link right now.");
    }
  };

  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setStatus("");

    if (!token) {
      setError("Reset link is missing or invalid.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await completeReset.mutateAsync({ token, password });
      setStatus("Your password has been reset. You can login now.");
      setTimeout(() => navigate("/auth/login", { state: { status: "Your password has been reset. You can login now." } }), 3000);
    } catch (err: any) {
      setError(err?.message || "Unable to reset password.");
    }
  };

  const isResetMode = Boolean(token);

  return (
    <div
      className="relative flex h-screen w-full items-center justify-center px-5 py-10 overflow-hidden"
      style={{ background: "var(--app-background)" }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_5%_10%,rgba(48,122,207,0.12),transparent_35%),radial-gradient(circle_at_90%_0%,rgba(48,122,207,0.1),transparent_30%)] dark:bg-[radial-gradient(circle_at_10%_20%,rgba(99,102,241,0.18),transparent_40%),radial-gradient(circle_at_85%_10%,rgba(14,165,233,0.18),transparent_35%)]" />
      <div className="relative z-10 w-full max-w-md rounded-3xl surface-card border p-6 shadow-2xl ring-1 ring-accent-blue/10 backdrop-blur-sm">
        <div className="flex flex-row items-center justify-between mb-4 text-primary">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-blue-50 text-accent-blue"
            onClick={() => navigate("/auth/login")}
          >
            <ArrowBack />
          </button>
          <span className="text-lg font-semibold">
            {isResetMode ? "Reset password" : "Forgot password"}
          </span>
          <div className="w-10" />
        </div>

        {!isResetMode && (
          <form className="flex flex-col gap-5 text-primary" onSubmit={handleRequest}>
            <p className="text-sm text-muted">
              Enter your account email and we&apos;ll send you a reset link.
            </p>
            <label className="flex flex-col text-left text-sm font-semibold text-muted">
              Email
              <input
                required
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-accent-blue/20 bg-white px-3 py-2 text-base shadow-inner focus:border-accent-blue focus:outline-hidden dark:bg-[rgba(15,23,42,0.7)]"
                placeholder="you@example.com"
              />
            </label>
            {error && <span className="text-red-500 text-sm">{error}</span>}
            {status && <span className="text-green-600 text-sm">{status}</span>}
            <button
              type="submit"
              className="w-full rounded-xl bg-linear-to-r from-accent-blue-700 to-accent-blue-500 py-3 text-lg font-semibold text-white shadow-lg shadow-accent-blue/25 ring-1 ring-accent-blue/20 transition hover:-translate-y-px disabled:opacity-70"
              disabled={requestReset.isPending}
            >
              {requestReset.isPending ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        {isResetMode && tokenInvalid && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <p className="text-sm text-red-500">This reset link is invalid or has expired.</p>
            <button
              type="button"
              onClick={() => navigate("/auth/forgotPassword")}
              className="w-full rounded-xl bg-linear-to-r from-accent-blue-700 to-accent-blue-500 py-3 text-lg font-semibold text-white shadow-lg shadow-accent-blue/25 ring-1 ring-accent-blue/20 transition hover:-translate-y-px"
            >
              Request a new link
            </button>
          </div>
        )}

        {isResetMode && !tokenInvalid && (
          <form className="flex flex-col gap-5 text-primary" onSubmit={handleReset}>
            <p className="text-sm text-muted">
              Create a new password for your TidalTask account.
            </p>
            <label className="flex flex-col text-left text-sm font-semibold text-muted">
              New password
              <input
                required
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-accent-blue/20 bg-white px-3 py-2 text-base shadow-inner focus:border-accent-blue focus:outline-hidden dark:bg-[rgba(15,23,42,0.7)]"
                placeholder="••••••••"
              />
            </label>
            <label className="flex flex-col text-left text-sm font-semibold text-muted">
              Confirm password
              <input
                required
                type="password"
                name="confirmPassword"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-xl border border-accent-blue/20 bg-white px-3 py-2 text-base shadow-inner focus:border-accent-blue focus:outline-hidden dark:bg-[rgba(15,23,42,0.7)]"
                placeholder="••••••••"
              />
            </label>
            {error && <span className="text-red-500 text-sm">{error}</span>}
            {status && <span className="text-green-600 text-sm">{status}</span>}
            <button
              type="submit"
              className="w-full rounded-xl bg-linear-to-r from-accent-blue-700 to-accent-blue-500 py-3 text-lg font-semibold text-white shadow-lg shadow-accent-blue/25 ring-1 ring-accent-blue/20 transition hover:-translate-y-px disabled:opacity-70"
              disabled={completeReset.isPending}
            >
              {completeReset.isPending ? "Saving..." : "Update password"}
            </button>
            <div className="flex w-full justify-center">
              <button
                type="button"
                onClick={() => navigate("/auth/login")}
                className="text-sm font-semibold text-accent-blue hover:underline"
              >
                Return to login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
