import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  KeyRound,
  Loader2,
  ShieldCheck,
  MailCheck,
} from "lucide-react";
import type { Site } from "../types";
import { post } from "../lib";
import { useToast } from "./UI";

/**
 * পাসওয়ার্ড ভুলে যাওয়া ও নতুন পাসওয়ার্ড বসানোর পর্দা।
 * দুই অবস্থায় কাজ করে:
 *  ১) রিসেট-লিংক ছাড়া (/admin → "পাসওয়ার্ড ভুলে গেছি?") → ইমেইল চেয়ে রিসেট-লিংক পাঠায়
 *  ২) রিসেট-লিংকের সাথে (/admin/reset#access_token=…) → নতুন পাসওয়ার্ড বসায়
 */
export default function ResetPassword({
  site,
  navigate,
}: {
  site: Site;
  navigate: (path: string) => void;
}) {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const token = params.get("access_token") || "";
  const fromLink = Boolean(token) && params.get("type") === "recovery";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const toast = useToast();

  const askLink = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const answer = await post<{ message: string; note?: string }>(
        "/password-reset",
        { email },
      );
      setSent(answer.message + (answer.note ? ` ${answer.note}` : ""));
      toast("অনুরোধ পাঠানো হয়েছে।");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setNewPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।");
      return;
    }
    if (password !== confirm) {
      setError("দুই জায়গায় একই পাসওয়ার্ড লিখুন।");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await post("/password-update", { token, password });
      history.replaceState({}, "", "/admin");
      toast("নতুন পাসওয়ার্ড বসে গেছে — এখন লগইন করুন।");
      navigate("/admin");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <button
        className="text-button login-back"
        onClick={() => navigate("/admin")}
      >
        <ArrowLeft size={17} />
        লগইনে ফিরে যাই
      </button>
      <div className="login-layout">
        <div className="login-art">
          <img src="/assets/ssc96-logo.webp" alt="SSC 96 লোগো" />
          <span>FRIENDS FOREVER</span>
          <h1>
            পাসওয়ার্ড,
            <br />
            একবার ভুলে যাওয়া।
          </h1>
          <p>
            চিন্তা নেই — আবার
            <br />
            ঢুকে পড়ব উৎসবে।
          </p>
        </div>
        <div className="login-card">
          <span className="login-lock">
            {fromLink ? <KeyRound size={26} /> : <ShieldCheck size={26} />}
          </span>
          <h2>
            {fromLink ? "নতুন পাসওয়ার্ড বসান" : "পাসওয়ার্ড ভুলে গেছেন?"}
          </h2>
          <p>
            {fromLink
              ? "নিচে নতুন পাসওয়ার্ড লিখুন — সেটাই এখন থেকে চলবে।"
              : "আপনার স্টাফ ইমেইল দিন — থাকলে রিসেট-লিংক পাঠানো হবে।"}
          </p>

          {fromLink ? (
            <form onSubmit={setNewPassword}>
              <label className="field">
                নতুন পাসওয়ার্ড
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="নতুন পাসওয়ার্ড"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="field">
                আবার লিখুন
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="একই পাসওয়ার্ড আবার"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="button button-primary full-width"
                disabled={busy}
              >
                {busy ? (
                  <Loader2 size={18} className="spin" />
                ) : (
                  <KeyRound size={17} />
                )}
                নতুন পাসওয়ার্ড বসাও
              </button>
            </form>
          ) : sent ? (
            <div className="login-sent">
              <MailCheck size={22} />
              <p>{sent}</p>
              <button
                className="button button-outline full-width"
                onClick={() => navigate("/admin")}
              >
                লগইনে ফিরে যাই
              </button>
            </div>
          ) : (
            <form onSubmit={askLink}>
              <label className="field">
                ইমেইল
                <input
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="আপনার স্টাফ ইমেইল"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="button button-primary full-width"
                disabled={busy}
              >
                {busy ? (
                  <Loader2 size={18} className="spin" />
                ) : (
                  <MailCheck size={17} />
                )}
                রিসেট-লিংক পাঠাও
              </button>
            </form>
          )}

          {site.mode === "demo" && (
            <p className="small-note">
              ডেমো মোডে আসল ইমেইল পাঠানো হয় না — এখানে শুধু কার্যপ্রণালী দেখা
              যায়।
            </p>
          )}
          <p className="small-note">
            রিসেট-লিংক ১ ঘণ্টা পর্যন্ত চলে। না পেলে স্প্যাম ফোল্ডার দেখুন।
          </p>
        </div>
      </div>
    </div>
  );
}
