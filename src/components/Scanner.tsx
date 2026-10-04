import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  ScanLine,
  ShieldCheck,
  Smartphone,
  RefreshCw,
  Check,
  AlertTriangle,
  Users,
  LogOut,
  Upload,
  Loader2,
  X,
} from "lucide-react";
import type { IScannerControls, BrowserQRCodeReader } from "@zxing/browser";
import type { CheckinResult, Device, Site, Staff } from "../types";
import { api, post, bn, dateTime } from "../lib";
import { useToast } from "./UI";
export default function Scanner({
  site,
  staff,
  navigate,
  onLogout,
}: {
  site: Site;
  staff: Staff;
  navigate: (path: string) => void;
  onLogout: () => void;
}) {
  const [device, setDevice] = useState<Device | null>(null),
    [deviceLoaded, setDeviceLoaded] = useState(false),
    [label, setLabel] = useState("গেট মোবাইল ১");
  const [busy, setBusy] = useState(false),
    [cameraOn, setCameraOn] = useState(false),
    [input, setInput] = useState(""),
    [error, setError] = useState("");
  const [result, setResult] = useState<CheckinResult | null>(null),
    [history, setHistory] = useState<CheckinResult[]>([]);
  const video = useRef<HTMLVideoElement>(null),
    controls = useRef<IScannerControls | null>(null),
    reader = useRef<BrowserQRCodeReader | null>(null),
    scanBusy = useRef(false);
  const toast = useToast();
  const loadDevice = async () => {
    try {
      setDevice(await api<Device | null>("/staff/device"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeviceLoaded(true);
    }
  };
  useEffect(() => {
    loadDevice();
    return () => {
      controls.current?.stop();
    };
  }, []);
  const stopCamera = () => {
    controls.current?.stop();
    controls.current = null;
    setCameraOn(false);
  };
  const enroll = async () => {
    setBusy(true);
    try {
      const d = await post<Device>("/staff/device", { label });
      setDevice(d);
      toast(
        d.status === "approved"
          ? "এই ব্রাউজার চেক-ইনের জন্য অনুমোদিত।"
          : "ডিভাইস অনুমোদনের অনুরোধ জমা হয়েছে।",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const checkin = async (value: string) => {
    if (scanBusy.current) return;
    scanBusy.current = true;
    stopCamera();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = await post<CheckinResult>("/checkin", { input: value });
      setResult(data);
      if (!data.alreadyCheckedIn)
        setHistory((old) => [data, ...old].slice(0, 5));
      toast(
        data.alreadyCheckedIn
          ? "এই টিকিট আগে চেক-ইন হয়েছে।"
          : "চেক-ইন সম্পন্ন হয়েছে।",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      scanBusy.current = false;
    }
  };
  const startCamera = async () => {
    setError("");
    setResult(null);
    setCameraOn(true);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      reader.current = new BrowserQRCodeReader();
      controls.current = await reader.current.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        video.current!,
        (code, _, ctl) => {
          if (code && !scanBusy.current) {
            ctl.stop();
            checkin(code.getText());
          }
        },
      );
    } catch {
      stopCamera();
      setError(
        "ক্যামেরা চালু হয়নি। HTTPS সংযোগ ও ক্যামেরার অনুমতি যাচাই করো। প্রয়োজনে QR-এর ছবি বা টিকিট নম্বর ব্যবহার করো।",
      );
    }
  };
  const uploadQr = async (file?: File) => {
    if (!file) return;
    setError("");
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const r = new BrowserQRCodeReader();
      const code = await r.decodeFromImageUrl(url);
      await checkin(code.getText());
    } catch {
      setError("ছবিতে স্পষ্ট QR পাওয়া যায়নি।");
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  const approved = device?.status === "approved";
  return (
    <div className="scanner-page">
      <header className="scanner-header">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          <img
            src="/assets/ssc96-logo.webp"
            alt="SSC 96"
            width="44"
            height="44"
          />
          <span>
            SSC 96<small>গেট চেক-ইন</small>
          </span>
        </a>
        <div>
          <span className="scanner-staff-name">{staff.name}</span>
          {staff.role === "admin" && (
            <button
              className="button button-ghost"
              onClick={() => navigate("/admin")}
            >
              <ShieldCheck size={17} />
              অ্যাডমিন
            </button>
          )}
          <button
            className="icon-button"
            aria-label="লগআউট"
            onClick={() => {
              stopCamera();
              onLogout();
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="scanner-main">
        <div className="scanner-title">
          <span className="eyebrow">
            <ScanLine size={16} />
            AUTHORIZED STAFF ONLY
          </span>
          <h1>স্বাগতম, বন্ধু!</h1>
          <p>নাম ও পরিবারের সদস্যসংখ্যা মিলিয়ে টিকিট চেক-ইন করো।</p>
        </div>
        {site.mode === "demo" && (
          <div className="notice notice-warning">
            <AlertTriangle size={18} />
            ডেমো চেক-ইন · বাস্তব ইভেন্টের প্রবেশ রেকর্ড নয়
          </div>
        )}
        {!deviceLoaded ? (
          <div className="loading-state">
            <Loader2 className="spin" />
            ডিভাইস যাচাই হচ্ছে…
          </div>
        ) : !approved ? (
          <section className="device-enrollment">
            <span className="device-icon">
              <Smartphone size={30} />
            </span>
            <h2>
              {device?.status === "pending"
                ? "অ্যাডমিন অনুমোদনের অপেক্ষায়"
                : device?.status === "revoked"
                  ? "এই ডিভাইসের অনুমতি বাতিল"
                  : "এই ব্রাউজারটি অনুমোদন করো"}
            </h2>
            <p>
              {device
                ? "অ্যাডমিন প্যানেলের “স্টাফ ডিভাইস” থেকে এই ব্রাউজারের অনুমতি নিয়ন্ত্রণ করা যাবে।"
                : "QR স্ক্যান করে প্রবেশ রেকর্ড করতে লগইনের পাশাপাশি ব্রাউজার-সেশন অনুমোদনও লাগবে।"}
            </p>
            {!device && (
              <>
                <label className="field">
                  ডিভাইসের পরিচয়
                  <input
                    value={label}
                    maxLength={100}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </label>
                <button
                  className="button button-primary full-width"
                  disabled={busy || label.trim().length < 2}
                  onClick={enroll}
                >
                  <Smartphone size={17} />
                  {staff.role === "admin"
                    ? "এই ব্রাউজার অনুমোদন করো"
                    : "অনুমোদনের অনুরোধ পাঠাও"}
                </button>
              </>
            )}
            <button className="text-button" onClick={loadDevice}>
              <RefreshCw size={16} />
              অনুমতি আবার যাচাই করো
            </button>
          </section>
        ) : (
          <>
            <div className="approved-device">
              <ShieldCheck size={17} />
              <span>{device.label} · অনুমোদিত ব্রাউজার</span>
              <span className="live-dot" />
            </div>
            <section className="scanner-card">
              <div
                className={`camera-window ${cameraOn ? "camera-active" : ""}`}
              >
                <video
                  ref={video}
                  autoPlay
                  muted
                  playsInline
                  aria-label="QR স্ক্যানের ক্যামেরা"
                />
                {!cameraOn && (
                  <div className="camera-placeholder">
                    <ScanLine size={52} />
                    <h3>QR টিকিট স্ক্যান করো</h3>
                    <p>টিকিটের QR ক্যামেরার সামনে রাখো।</p>
                    <button
                      className="button button-primary"
                      disabled={busy}
                      onClick={startCamera}
                    >
                      <Camera size={18} />
                      ক্যামেরা চালু করো
                    </button>
                  </div>
                )}
                {cameraOn && (
                  <>
                    <div className="scan-frame">
                      <span />
                      <span />
                      <span />
                      <span />
                      <i />
                    </div>
                    <button
                      className="camera-stop icon-button"
                      onClick={stopCamera}
                      aria-label="ক্যামেরা বন্ধ করো"
                    >
                      <X size={19} />
                    </button>
                    <span className="camera-caption">
                      QR-টি ফ্রেমের মধ্যে রাখো
                    </span>
                  </>
                )}
              </div>
              <div className="scanner-manual">
                <label className="upload-qr">
                  <Upload size={16} />
                  QR-এর ছবি থেকে স্ক্যান
                  <input
                    type="file"
                    accept="image/*"
                    disabled={busy}
                    onChange={(e) => uploadQr(e.target.files?.[0])}
                  />
                </label>
                <span className="manual-divider">অথবা টিকিট নম্বর</span>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    checkin(input.trim());
                  }}
                >
                  <input
                    aria-label="টিকিট নম্বর"
                    placeholder="R96-00001"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <button
                    className="button button-dark"
                    disabled={busy || !input.trim()}
                  >
                    {busy ? (
                      <Loader2 size={17} className="spin" />
                    ) : (
                      <Check size={17} />
                    )}
                    চেক-ইন
                  </button>
                </form>
              </div>
            </section>
            {result && (
              <section
                className={`checkin-result ${result.alreadyCheckedIn ? "duplicate" : ""}`}
                role="status"
              >
                <div className="checkin-result-icon">
                  {result.alreadyCheckedIn ? (
                    <AlertTriangle size={28} />
                  ) : (
                    <Check size={30} />
                  )}
                </div>
                <span>
                  {result.alreadyCheckedIn
                    ? "আগেই চেক-ইন হয়েছে · দ্বিতীয়বার নয়"
                    : "চেক-ইন সম্পন্ন!"}
                </span>
                <h2>{result.name}</h2>
                <p>{result.school}</p>
                <div>
                  <b>{result.ticketNumber}</b>
                  <span>
                    <Users size={17} />
                    {bn(result.people)} জন
                  </span>
                </div>
                <small>
                  বন্ধু ১ · জীবনসঙ্গী {bn(result.spouse)} · শিশু{" "}
                  {bn(result.children)}
                  <br />
                  {dateTime(result.checkedInAt)}
                </small>
                <button
                  className="button button-outline full-width"
                  onClick={() => {
                    setResult(null);
                    setInput("");
                    startCamera();
                  }}
                >
                  <Camera size={17} />
                  পরের টিকিট স্ক্যান করো
                </button>
              </section>
            )}
          </>
        )}
        {error && (
          <div className="notice notice-danger" role="alert">
            <AlertTriangle size={20} />
            {error}
          </div>
        )}
        {history.length > 0 && (
          <section className="recent-checkins">
            <h3>এই সেশনের সাম্প্রতিক চেক-ইন</h3>
            {history.map((r) => (
              <div key={r.ticketNumber}>
                <span className="history-check">
                  <Check size={15} />
                </span>
                <div>
                  <b>{r.name}</b>
                  <small>{r.ticketNumber}</small>
                </div>
                <span>{bn(r.people)} জন</span>
              </div>
            ))}
          </section>
        )}
        <p className="scanner-security-note">
          <ShieldCheck size={15} />
          একটি QR-এ নিবন্ধিত পরিবার একসঙ্গে চেক-ইন করবে। চেক-ইনের জন্য ইন্টারনেট
          প্রয়োজন। এটি ফোনের হার্ডওয়্যার-লক নয়; স্টাফ ও ব্রাউজার-সেশনের অনুমোদন।
        </p>
        <button
          className="text-button scanner-home"
          onClick={() => {
            stopCamera();
            navigate("/");
          }}
        >
          <ArrowLeft size={16} />
          উৎসবের পেজে ফিরে যাই
        </button>
      </main>
    </div>
  );
}
