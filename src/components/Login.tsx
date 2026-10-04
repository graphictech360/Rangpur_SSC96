import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  ScanLine,
  LockKeyhole,
  Loader2,
} from "lucide-react";
import type { Site, Staff } from "../types";
import { post } from "../lib";
import { Star, useToast } from "./UI";
export default function Login({
  site,
  navigate,
  onLogin,
  scanner = false,
}: {
  site: Site;
  navigate: (path: string) => void;
  onLogin: (staff: Staff) => void;
  scanner?: boolean;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const toast = useToast();
  const login = async (userEmail: string, userPassword: string) => {
    setBusy(true);
    setError("");
    try {
      const user = await post<Staff>("/login", {
        email: userEmail,
        password: userPassword,
      });
      onLogin(user);
      toast("লগইন সফল হয়েছে।");
      if (user.role === "scanner") navigate("/check-in");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    login(email, password);
  };
  return (
    <div className="login-page">
      <button className="text-button login-back" onClick={() => navigate("/")}>
        <ArrowLeft size={17} />
        উৎসবে ফিরে যাই
      </button>
      <div className="login-layout">
        <div className="login-art">
          <img src="/assets/ssc96-logo.webp" alt="SSC 96 লোগো" />
          <span>FRIENDS FOREVER</span>
          <h1>
            বন্ধুত্বের উৎসব,
            <br />
            যত্নে আয়োজন।
          </h1>
          <p>
            নিবন্ধন, পেমেন্ট আর প্রবেশ—
            <br />
            সবকিছু এক জায়গায়।
          </p>
          <Star className="login-star" color="#e9c948" />
          <div className="login-big-number">96</div>
        </div>
        <div className="login-card">
          <span className="login-lock">
            {scanner ? <ScanLine size={26} /> : <ShieldCheck size={26} />}
          </span>
          <h2>{scanner ? "গেট স্টাফ লগইন" : "আয়োজক প্যানেল"}</h2>
          <p>এটি শুধু অনুমোদিত আয়োজক ও স্টাফদের জন্য।</p>
          <form onSubmit={submit}>
            <label className="field">
              ইমেইল
              <input
                type="email"
                required
                autoComplete="username"
                placeholder="তোমার স্টাফ ইমেইল"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              পাসওয়ার্ড
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="পাসওয়ার্ড"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                <LockKeyhole size={17} />
              )}
              লগইন করো
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="login-help">
            <button
              type="button"
              className="text-button"
              onClick={() => navigate("/admin/reset")}
            >
              পাসওয়ার্ড ভুলে গেছেন? রিসেট করুন
            </button>
          </div>
          {site.mode === "demo" && (
            <div className="demo-login">
              <span>ডেমো অ্যাকাউন্ট · কাল্পনিক ডেটা</span>
              <button
                className="button button-outline full-width"
                disabled={busy}
                onClick={() => login("admin@ssc96.demo", "Festival96!")}
              >
                <ShieldCheck size={16} />
                ডেমো অ্যাডমিন হিসেবে দেখো
              </button>
              <button
                className="button button-ghost full-width"
                disabled={busy}
                onClick={() => login("staff@ssc96.demo", "Checkin96!")}
              >
                <ScanLine size={16} />
                ডেমো গেট স্টাফ হিসেবে দেখো
              </button>
            </div>
          )}
          <p className="small-note">
            <ShieldCheck size={14} />
            চেক-ইন করতে স্টাফ লগইনের পাশাপাশি ব্রাউজার/ডিভাইস অনুমোদন প্রয়োজন।
          </p>
        </div>
      </div>
    </div>
  );
}
