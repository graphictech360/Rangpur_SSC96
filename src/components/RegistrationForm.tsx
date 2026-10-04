import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Copy,
  LockKeyhole,
  Plus,
  Minus,
  Heart,
  Baby,
  CreditCard,
  Ticket,
  Loader2,
  Sparkles,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import type { Participant, Registration, Site, Provider } from "../types";
import {
  bn,
  money,
  post,
  validMobile,
  saveTicket,
  ticketLink,
  copyText,
} from "../lib";
import { StatusBadge, useToast } from "./UI";
const emptyParticipant: Participant = {
  name: "",
  school: "",
  sscRoll: "",
  sscRegistration: "",
  mobile: "",
  location: "",
  tshirt: "L",
};
interface Props {
  site: Site;
  onTicket: (key?: string) => void;
  onRegistered?: () => void;
}
export default function RegistrationForm({
  site,
  onTicket,
  onRegistered,
}: Props) {
  const [step, setStep] = useState(0),
    [participant, setParticipant] = useState(emptyParticipant);
  const [spouse, setSpouse] = useState(0),
    [children, setChildren] = useState(0);
  const [food, setFood] = useState("সাধারণ"),
    [notes, setNotes] = useState("");
  const [provider, setProvider] = useState<Provider>("bkash");
  const [accountId, setAccountId] = useState(
    site.accounts.find((a) => a.provider === "bkash")?.id || "",
  );
  const [senderMobile, setSenderMobile] = useState(""),
    [transactionId, setTransactionId] = useState(""),
    [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    registration: Registration;
    trackingKey: string;
  } | null>(null);
  const toast = useToast();
  const total =
    site.fees.friend + spouse * site.fees.spouse + children * site.fees.child;
  const account = site.accounts.find((a) => a.id === accountId);
  const update = (key: keyof Participant, value: string) =>
    setParticipant((p) => ({ ...p, [key]: value }));
  const chooseProvider = (value: Provider) => {
    setProvider(value);
    setAccountId(site.accounts.find((a) => a.provider === value)?.id || "");
  };
  const validate = () => {
    if (step === 0) {
      const missing = (
        ["name", "school", "sscRoll", "mobile", "location"] as const
      ).find((key) => !participant[key].trim());
      if (missing) {
        document.getElementById(`reg-${missing}`)?.focus();
        return "নিজের সব প্রয়োজনীয় তথ্য পূরণ করো।";
      }
      if (!validMobile(participant.mobile)) {
        document.getElementById("reg-mobile")?.focus();
        return "সঠিক বাংলাদেশি মোবাইল নম্বর দাও।";
      }
    }
    if (step === 2) {
      if (!account) return "পেমেন্ট গ্রহণকারীর নম্বর বেছে নাও।";
      if (!validMobile(senderMobile))
        return "যে নম্বর থেকে টাকা পাঠিয়েছ, সেটি সঠিকভাবে দাও।";
      if (!/^[A-Za-z0-9-]{5,64}$/.test(transactionId.trim()))
        return "সঠিক ট্রানজেকশন আইডি দাও।";
      if (!consent) return "তথ্য ও পেমেন্ট যাচাইয়ের শর্তে সম্মতি দাও।";
    }
    return "";
  };
  const next = () => {
    const message = validate();
    setError(message);
    if (!message) {
      if (step === 0 && !senderMobile) setSenderMobile(participant.mobile);
      setStep(step + 1);
    }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (step < 2) return next();
    const message = validate();
    if (message) return setError(message);
    setBusy(true);
    setError("");
    try {
      const result = await post<{
        registration: Registration;
        trackingKey: string;
      }>("/registrations", {
        participant,
        spouse,
        children,
        food,
        notes,
        payment: {
          provider,
          accountId,
          senderMobile,
          transactionId: transactionId.trim(),
          amount: total,
        },
        consent,
      });
      saveTicket(result.trackingKey, result.registration);
      setSuccess(result);
      onRegistered?.();
      toast("নিবন্ধন জমা হয়েছে। গোপন টিকিটের লিংকটি সংরক্ষণ করো।");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const copy = async (value: string) => {
    try {
      await copyText(value);
      toast("কপি হয়েছে!");
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  const demoFill = () => {
    const mobile = `0179${String(Math.floor(Math.random() * 10000000)).padStart(7, "0")}`;
    setParticipant({
      name: "ডেমো বন্ধু",
      school: "রংপুর জিলা স্কুল",
      sscRoll: "961234",
      sscRegistration: "96001234",
      mobile,
      location: "ঢাকা",
      tshirt: "L",
    });
    setSenderMobile(mobile);
    toast("কাল্পনিক তথ্য বসানো হয়েছে।");
  };
  if (success)
    return (
      <div className="registration-card success-card">
        <div className="success-icon">
          <Check size={34} />
        </div>
        <span className="eyebrow">WELCOME BACK, FRIEND!</span>
        <h3>
          তোমার নিবন্ধন
          <br />
          জমা হয়েছে!
        </h3>
        <p>
          এখন আয়োজকেরা পেমেন্ট যাচাই করবেন। অনুমোদনের পর এই লিংকেই QR টিকিট
          পাওয়া যাবে।
        </p>
        <div className="success-receipt">
          <span>নিবন্ধন নম্বর</span>
          <b>{success.registration.ticketNumber}</b>
          <StatusBadge status="pending" />
          <hr />
          <div>
            <span>মোট সদস্য</span>
            <b>{bn(1 + spouse + children)} জন</b>
          </div>
          <div>
            <span>জমা দেওয়া পরিমাণ</span>
            <b>৳ {money(total)}</b>
          </div>
        </div>
        <button
          className="button button-primary full-width"
          onClick={() => onTicket(success.trackingKey)}
        >
          <Ticket size={19} />
          আমার স্ট্যাটাস ও টিকিট
        </button>
        <button
          className="button button-outline full-width"
          onClick={() => copy(ticketLink(success.trackingKey))}
        >
          <Copy size={17} />
          গোপন লিংক কপি করো
        </button>
        <p className="small-note">
          <LockKeyhole size={14} />
          লিংকটি ব্যক্তিগত। প্রকাশ্যে শেয়ার করো না। এসএমএস পাঠানো হবে না।
        </p>
        <button
          className="text-button"
          onClick={() => {
            setSuccess(null);
            setStep(0);
            setParticipant(emptyParticipant);
            setSenderMobile("");
            setTransactionId("");
            setConsent(false);
            setSpouse(0);
            setChildren(0);
          }}
        >
          আরেকজন বন্ধুর নিবন্ধন <ArrowRight size={16} />
        </button>
      </div>
    );
  return (
    <div className="registration-card">
      <div className="form-card-heading">
        <div>
          <span className="form-overline">YOUR SEAT IS WAITING</span>
          <h3>বন্ধু, নামটা লিখে ফেলো!</h3>
        </div>
        <span className="form-heading-icon">
          <Ticket size={24} />
        </span>
      </div>
      <div className="form-steps" aria-label="নিবন্ধনের ধাপ">
        {["পরিচয়", "পরিবার", "পেমেন্ট"].map((label, i) => (
          <div
            className={i === step ? "active" : i < step ? "complete" : ""}
            key={label}
          >
            <span>{i < step ? <Check size={13} /> : bn(i + 1)}</span>
            <b>{label}</b>
            {i < 2 && <i />}
          </div>
        ))}
      </div>
      {!site.event.registrationOpen ? (
        <div className="notice notice-warning">
          <LockKeyhole size={20} />
          <p>
            নিবন্ধন আপাতত বন্ধ আছে। আয়োজকদের পরবর্তী আপডেটের জন্য অপেক্ষা করো।
          </p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          {step === 0 && (
            <div className="form-step-content">
              <div className="form-step-title">
                <span>০১ / তোমার পরিচয়</span>
                {site.mode === "demo" && (
                  <button
                    type="button"
                    className="demo-fill"
                    onClick={demoFill}
                  >
                    <Sparkles size={13} />
                    ডেমো তথ্য
                  </button>
                )}
              </div>
              <div className="field-grid">
                <label className="field field-full">
                  নাম <em>*</em>
                  <input
                    id="reg-name"
                    name="name"
                    placeholder="তোমার পুরো নাম"
                    autoComplete="name"
                    maxLength={120}
                    value={participant.name}
                    onChange={(e) => update("name", e.target.value)}
                  />
                </label>
                <label className="field field-full">
                  স্কুলের নাম <em>*</em>
                  <input
                    id="reg-school"
                    name="school"
                    placeholder="যে স্কুল থেকে এসএসসি পাস করেছ"
                    maxLength={200}
                    value={participant.school}
                    onChange={(e) => update("school", e.target.value)}
                  />
                </label>
                <label className="field">
                  এসএসসি রোল <em>*</em>
                  <input
                    id="reg-sscRoll"
                    name="sscRoll"
                    placeholder="এসএসসি ১৯৯৬ রোল"
                    maxLength={30}
                    value={participant.sscRoll}
                    onChange={(e) => update("sscRoll", e.target.value)}
                  />
                </label>
                <label className="field">
                  এসএসসি রেজিস্ট্রেশন <span className="optional">ঐচ্ছিক</span>
                  <input
                    name="sscRegistration"
                    placeholder="রেজিস্ট্রেশন নম্বর"
                    maxLength={40}
                    value={participant.sscRegistration}
                    onChange={(e) => update("sscRegistration", e.target.value)}
                  />
                </label>
                <label className="field">
                  মোবাইল নম্বর <em>*</em>
                  <input
                    id="reg-mobile"
                    name="mobile"
                    type="tel"
                    autoComplete="tel"
                    placeholder="01XXXXXXXXX"
                    value={participant.mobile}
                    onChange={(e) => update("mobile", e.target.value)}
                  />
                </label>
                <label className="field">
                  বর্তমান অবস্থান <em>*</em>
                  <input
                    id="reg-location"
                    name="location"
                    placeholder="শহর / দেশ"
                    maxLength={200}
                    value={participant.location}
                    onChange={(e) => update("location", e.target.value)}
                  />
                </label>
              </div>
              <div className="batch-lock">
                <LockKeyhole size={13} />
                আমাদের ব্যাচ: এসএসসি ১৯৯৬
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="form-step-content">
              <div className="form-step-title">
                <span>০২ / কারা আসছো একসাথে?</span>
              </div>
              <div className="family-option">
                <span className="family-icon">
                  <Heart size={20} />
                </span>
                <div>
                  <b>জীবনসঙ্গী আসবেন?</b>
                  <small>অতিরিক্ত ৳ {money(site.fees.spouse)}</small>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-label="জীবনসঙ্গী আসবেন"
                  aria-checked={spouse === 1}
                  className={`switch ${spouse ? "on" : ""}`}
                  onClick={() => setSpouse(spouse ? 0 : 1)}
                >
                  <span />
                </button>
              </div>
              <div className="family-option">
                <span className="family-icon child-icon">
                  <Baby size={21} />
                </span>
                <div>
                  <b>কতজন ছোট্ট অতিথি?</b>
                  <small>শিশু প্রতি ৳ {money(site.fees.child)}</small>
                </div>
                <div className="stepper">
                  <button
                    type="button"
                    aria-label="শিশুর সংখ্যা কমাও"
                    disabled={!children}
                    onClick={() => setChildren(children - 1)}
                  >
                    <Minus size={15} />
                  </button>
                  <span>{bn(children)}</span>
                  <button
                    type="button"
                    aria-label="শিশুর সংখ্যা বাড়াও"
                    disabled={children >= 20}
                    onClick={() => setChildren(children + 1)}
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
              <label className="field family-total">
                মোট পরিবারের সদস্য
                <input
                  readOnly
                  value={`${bn(1 + spouse + children)} জন (তোমাকেসহ)`}
                />
              </label>
              <label className="field">
                খাবারের পছন্দ
                <select
                  name="food"
                  value={food}
                  onChange={(e) => setFood(e.target.value)}
                >
                  <option>সাধারণ</option>
                  <option>নিরামিষ</option>
                  <option>বিশেষ অনুরোধ</option>
                </select>
              </label>
              <div className="field tshirt-field">
                <span>
                  তোমার টি-শার্টের সাইজ <em>*</em>
                </span>
                <div className="size-options">
                  {["XS", "S", "M", "L", "XL", "XXL", "3XL"].map((size) => (
                    <button
                      type="button"
                      aria-pressed={participant.tshirt === size}
                      className={participant.tshirt === size ? "active" : ""}
                      key={size}
                      onClick={() => update("tshirt", size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <small>এই সাইজটি মূল অংশগ্রহণকারী বন্ধুর জন্য।</small>
              </div>
              <label className="field">
                বিশেষ অনুরোধ <span className="optional">ঐচ্ছিক</span>
                <textarea
                  rows={2}
                  maxLength={600}
                  placeholder="খাবারের অ্যালার্জি বা অন্য কোনো প্রয়োজন থাকলে জানাও"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </div>
          )}
          {step === 2 && (
            <div className="form-step-content">
              <div className="form-step-title">
                <span>০৩ / পেমেন্টের তথ্য</span>
                <LockKeyhole size={14} />
              </div>
              {site.mode === "demo" && (
                <div className="notice notice-warning demo-payment-warning">
                  <AlertTriangle size={17} />
                  <div>
                    <b>ডেমোতে বাস্তব টাকা পাঠাবে না।</b>
                    <button
                      type="button"
                      onClick={() => {
                        setTransactionId(
                          `DEMO${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
                        );
                        setSenderMobile(participant.mobile);
                      }}
                    >
                      কাল্পনিক পেমেন্ট তথ্য বসাও <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              )}
              <div
                className="payment-provider-switch"
                role="group"
                aria-label="পেমেন্ট পদ্ধতি"
              >
                <button
                  type="button"
                  className={`bkash ${provider === "bkash" ? "active" : ""}`}
                  onClick={() => chooseProvider("bkash")}
                >
                  <span className="payment-symbol">◈</span>bKash{" "}
                  <small>বিকাশ</small>
                  {provider === "bkash" && <Check size={17} />}
                </button>
                <button
                  type="button"
                  className={`nagad ${provider === "nagad" ? "active" : ""}`}
                  onClick={() => chooseProvider("nagad")}
                >
                  <span className="payment-symbol">◉</span>Nagad{" "}
                  <small>নগদ</small>
                  {provider === "nagad" && <Check size={17} />}
                </button>
              </div>
              <label className="field">
                যাঁর কাছে টাকা পাঠিয়েছ
                <select
                  aria-label="পেমেন্ট গ্রহণকারী"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  {site.accounts
                    .filter((a) => a.provider === provider && a.active)
                    .map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.name} — {a.mobile}
                      </option>
                    ))}
                </select>
              </label>
              {account && (
                <div className="payment-number">
                  <span>Send Money · {account.name}</span>
                  <div>
                    <b>{account.mobile}</b>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="পেমেন্ট নম্বর কপি করো"
                      onClick={() => copy(account.mobile)}
                    >
                      <Copy size={17} />
                    </button>
                  </div>
                  <small>এটি ব্যক্তিগত নম্বর। Payment নয়, Send Money।</small>
                </div>
              )}
              <div className="field-grid">
                <label className="field">
                  প্রেরকের মোবাইল <em>*</em>
                  <input
                    name="senderMobile"
                    type="tel"
                    placeholder="যে নম্বর থেকে পাঠিয়েছ"
                    value={senderMobile}
                    onChange={(e) => setSenderMobile(e.target.value)}
                  />
                </label>
                <label className="field">
                  ট্রানজেকশন আইডি <em>*</em>
                  <input
                    name="transactionId"
                    placeholder="যেমন: A7B8C9D0EF"
                    maxLength={64}
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                  />
                </label>
              </div>
              <div className="payment-status-display">
                <span>পেমেন্ট স্ট্যাটাস</span>
                <StatusBadge status="pending" />
              </div>
              <label className="consent">
                <input
                  name="consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  প্রদত্ত তথ্য সঠিক। পেমেন্ট যাচাইয়ের পরেই টিকিট পাব এবং গোপন
                  টিকিটের লিংক সংরক্ষণ করব।
                </span>
              </label>
            </div>
          )}
          <div className="form-fee-summary">
            <div>
              <span>মোট নিবন্ধন ফি</span>
              <small>
                বন্ধু {bn(1)}
                {spouse ? ` + জীবনসঙ্গী ${bn(spouse)}` : ""}
                {children ? ` + শিশু ${bn(children)}` : ""}
              </small>
            </div>
            <b>
              ৳ {money(total)}
              <small>/-</small>
            </b>
          </div>
          {error && (
            <p className="form-error" role="alert">
              <AlertTriangle size={16} />
              {error}
            </p>
          )}
          <div className="form-navigation">
            {step > 0 && (
              <button
                className="button button-outline back-step"
                type="button"
                onClick={() => {
                  setStep(step - 1);
                  setError("");
                }}
                disabled={busy}
              >
                <ArrowLeft size={17} />
                পেছনে
              </button>
            )}
            <button
              className="button button-primary next-step"
              type="submit"
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 size={18} className="spin" />
                  জমা হচ্ছে…
                </>
              ) : step === 2 ? (
                <>
                  <CreditCard size={18} />
                  নিবন্ধন জমা দাও
                  <ArrowRight size={18} />
                </>
              ) : (
                <>
                  পরের ধাপ
                  <ArrowRight size={19} />
                </>
              )}
            </button>
          </div>
          <div className="form-footer-note">
            <LockKeyhole size={12} />
            তথ্য শুধু আয়োজন ও পেমেন্ট যাচাইয়ের জন্য ব্যবহৃত হবে।
          </div>
        </form>
      )}
    </div>
  );
}
