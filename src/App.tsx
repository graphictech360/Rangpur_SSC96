import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { Site, Staff } from "./types";
import { api, extractKey, post, savedTickets } from "./lib";
import type { Registration } from "./types";
import Home from "./components/Home";
import Admin from "./components/Admin";
import Login from "./components/Login";
import Scanner from "./components/Scanner";
import TicketPanel from "./components/TicketPanel";
import ResetPassword from "./components/ResetPassword";
import { Dialog, Spinner, useToast } from "./components/UI";
export default function App() {
  const [site, setSite] = useState<Site | null>(null),
    [staff, setStaff] = useState<Staff | null>(null);
  // পাসওয়ার্ড রিসেট লিংক (#...type=recovery) এলে সরাসরি নতুন পাসওয়ার্ডের পর্দায়
  const recoveryLink = () => {
    const h = new URLSearchParams(location.hash.replace(/^#/, ""));
    return h.get("type") === "recovery" && Boolean(h.get("access_token"));
  };
  const [route, setRoute] = useState(
      recoveryLink() ? "/admin/reset" : location.pathname,
    ),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [ticketOpen, setTicketOpen] = useState(
      location.hash.startsWith("#ticket="),
    ),
    [ticketKey, setTicketKey] = useState(extractKey(location.hash));
  const toast = useToast();
  const refreshSite = async () => {
    try {
      setSite(await api<Site>("/site"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    Promise.all([
      refreshSite(),
      api<Staff | null>("/me")
        .then(setStaff)
        .catch(() => setStaff(null)),
    ]).finally(() => setReady(true));
    const history = () => {
      setRoute(recoveryLink() ? "/admin/reset" : location.pathname);
      if (location.hash.startsWith("#ticket=")) {
        setTicketKey(extractKey(location.hash));
        setTicketOpen(true);
      } else setTicketOpen(false);
    };
    window.addEventListener("popstate", history);
    window.addEventListener("hashchange", history);
    return () => {
      window.removeEventListener("popstate", history);
      window.removeEventListener("hashchange", history);
    };
  }, []);
  // R46: ভিজিটর-অ্যানালিটিক্স — পাবলিক পেজ খুললে একটি হালকা বীকন যায় (অ্যাডমিন/চেক-ইন বাদ)
  useEffect(() => {
    if ((window as unknown as { __r96v?: boolean }).__r96v) return;
    (window as unknown as { __r96v?: boolean }).__r96v = true;
    const path = location.pathname || "/";
    if (/^\/(admin|check-in)/.test(path)) return;
    fetch("/api/visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path }),
    })
      // রেসপন্স-বডি পড়ে ফেলা হয় — না পড়লে সংযোগ খোলা থেকে যায়
      .then((r) => r.text())
      .catch(() => {});
  }, []);
  /* R51: নিবন্ধনের উত্তর এলে (অনুমোদন/প্রত্যাখ্যান) টিকিট-আইকনে লাল ডট।
     এই ডিভাইসে সেভ-করা টিকিটগুলোর স্ট্যাটাস মাঝে মাঝে চুপচাপ দেখা হয়;
     ব্যবহারকারী টিকিট খুললে "দেখা হয়েছে" ধরে ডটটি মুছে যায়। */
  const [ticketAlerts, setTicketAlerts] = useState<Record<string, string>>({});
  useEffect(() => {
    if (/^\/(admin|check-in)/.test(location.pathname)) return;
    let stopped = false;
    const check = async () => {
      const tickets = savedTickets().slice(0, 5);
      if (!tickets.length) return;
      let seen: Record<string, string> = {};
      try {
        seen = JSON.parse(localStorage.getItem("r96-ticket-seen") || "{}");
      } catch {
        /* আগের তথ্য পড়া না গেলে সবগুলোই নতুন ধরা হবে */
      }
      const found: Record<string, string> = {};
      for (const t of tickets) {
        try {
          const r = await post<Registration>("/ticket", { trackingKey: t.key });
          if (
            (r.status === "approved" || r.status === "rejected") &&
            seen[t.key] !== r.status
          )
            found[t.key] = r.status;
        } catch {
          /* নেটওয়ার্ক সমস্যায় পরের বার আবার চেষ্টা */
        }
      }
      if (!stopped && Object.keys(found).length) setTicketAlerts(found);
    };
    check();
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") check();
    }, 60000);
    return () => {
      stopped = true;
      clearInterval(iv);
    };
  }, []);
  const markTicketsSeen = () => {
    if (!Object.keys(ticketAlerts).length) return;
    try {
      const seen = JSON.parse(localStorage.getItem("r96-ticket-seen") || "{}");
      localStorage.setItem(
        "r96-ticket-seen",
        JSON.stringify({ ...seen, ...ticketAlerts }),
      );
    } catch {
      /* সংরক্ষণ না হলেও প্যানেল ঠিকই খুলবে */
    }
    setTicketAlerts({});
  };
  const navigate = (path: string) => {
    history.pushState({}, "", path);
    setRoute(path);
    setTicketOpen(false);
    window.scrollTo({ top: 0 });
  };
  const openTicket = (key?: string) => {
    markTicketsSeen(); // R51: টিকিট খুললেই আইকনের লাল ডট মুছে যায়
    setTicketKey(key || "");
    setTicketOpen(true);
    if (key) {
      history.pushState({}, "", `/#ticket=${key}`);
      setRoute("/");
    }
  };
  const closeTicket = () => {
    setTicketOpen(false);
    if (location.hash.startsWith("#ticket=")) history.replaceState({}, "", "/");
  };
  const logout = async () => {
    try {
      await post("/logout", {});
      setStaff(null);
      toast("লগআউট হয়েছে।");
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  if (!ready || !site)
    return (
      <div className="app-loading">
        <img src="/assets/ssc96-logo-v2.webp" alt="SSC 96" />
        <h1>বন্ধুত্বের উৎসব</h1>
        {error ? (
          <>
            <p className="form-error">
              <AlertTriangle size={17} />
              {error}
            </p>
            <button className="button button-primary" onClick={refreshSite}>
              <RefreshCw size={17} />
              আবার চেষ্টা করি
            </button>
          </>
        ) : (
          <Spinner label="বন্ধুদের জন্য সব সাজানো হচ্ছে…" />
        )}
      </div>
    );
  return (
    <>
      {route === "/admin/reset" ? (
        <ResetPassword site={site} navigate={navigate} />
      ) : route === "/admin" ? (
        staff ? (
          <Admin
            site={site}
            staff={staff}
            navigate={navigate}
            onLogout={logout}
            onSiteChange={refreshSite}
            onTicket={openTicket}
          />
        ) : (
          <Login site={site} navigate={navigate} onLogin={setStaff} />
        )
      ) : route === "/check-in" ? (
        staff ? (
          <Scanner
            site={site}
            staff={staff}
            navigate={navigate}
            onLogout={logout}
          />
        ) : (
          <Login site={site} navigate={navigate} onLogin={setStaff} scanner />
        )
      ) : (
        <Home
          site={site}
          onTicket={openTicket}
          navigate={navigate}
          ticketAlert={Object.keys(ticketAlerts).length > 0}
        />
      )}
      {ticketOpen && (
        <Dialog title="আমার নিবন্ধন ও টিকিট" onClose={closeTicket} wide>
          <TicketPanel site={site} initialKey={ticketKey} />
        </Dialog>
      )}
    </>
  );
}
