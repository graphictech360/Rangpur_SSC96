import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
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
  Camera,
  Upload,
  Trash2,
  KeyRound,
  Link2,
} from "lucide-react";
import type { FormField, Participant, Registration, Site, Provider } from "../types";
import {
  bn,
  money,
  post,
  validMobile,
  saveTicket,
  ticketLink,
  copyText,
  shrinkPhoto,
  PHOTO_SIZE,
} from "../lib";
import { DynamicFields, StatusBadge, useToast } from "./UI";
const emptyParticipant: Participant = {
  name: "",
  school: "",
  sscRoll: "",
  sscRegistration: "",
  mobile: "",
  location: "",
  tshirt: "L",
  photoUrl: "",
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
  // খাবার ও বিশেষ অনুরোধ আর ফর্মে নেই (আয়োজকের নির্দেশ);
  // অ্যাডমিন প্যানেল থেকে যোগ করা ঘরগুলোর উত্তর এখানে রাখা হয়।
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [provider, setProvider] = useState<Provider>("bkash");
  const [accountId, setAccountId] = useState(
    site.accounts.find((a) => a.provider === "bkash")?.id || "",
  );
  const [senderMobile, setSenderMobile] = useState(""),
    [transactionId, setTransactionId] = useState(""),
    [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // ফর্মের ঘরগুলো এখন অ্যাডমিন প্যানেল থেকেই আসে (মূল ঘর + নিজের যোগ করা ঘর)
  const fields = (site.formFields || [])
    .slice()
    .sort((a, b) => a.order - b.order);
  const fld = (key: string) => fields.find((f) => f.key === key);
  const text = (key: string, fallback: string) =>
    site.formTexts?.[key]?.trim() ? site.formTexts[key] : fallback;
  const shown = (key: string) => Boolean(fld(key));           // লুকানো ঘর তালিকায় থাকে না
  const need = (key: string) => fld(key)?.required === true;
  const photoRequired = shown("photo") && need("photo");
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
  const onPickPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    setError("");
    try {
      // যেকোনো সাইজের ছবি হলেও ঠিক ৫১২×৫১২ (~৭০ KB) বানিয়ে নেওয়া হয়
      const prepared = await shrinkPhoto(file);
      update("photoUrl", prepared);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ছবিটি নেওয়া যায়নি।");
    } finally {
      setPhotoBusy(false);
    }
  };
  /** ডেমো তথ্য দিলে ছবির বদলে হালকা একটা নমুনা ছবি (ছোট, ~৫ KB) তৈরি হয় */
  const demoPhoto = () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = PHOTO_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    const grad = ctx.createLinearGradient(0, 0, PHOTO_SIZE, PHOTO_SIZE);
    grad.addColorStop(0, "#0f766e");
    grad.addColorStop(1, "#134e4a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE);
    ctx.fillStyle = "#fdf6e3";
    ctx.font = "bold 230px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("র", PHOTO_SIZE / 2, PHOTO_SIZE / 2 + 10);
    return canvas.toDataURL("image/jpeg", 0.6);
  };
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
      if (photoRequired && !participant.photoUrl?.trim())
        return "নিজের একটি ছবি দাও — টিকিটে তোমার ছবিই থাকবে, গেটে চেনা সহজ হবে।";
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
      // ছবিটি প্রথমে Storage-এ তোলা হয়, তারপর ফিরে আসা ছোট লিংকটি নিবন্ধনে যায়
      let photoUrl = participant.photoUrl?.trim() || "";
      if (photoUrl.startsWith("data:")) {
        const uploaded = await post<{ url: string }>("/photo", {
          photo: photoUrl,
        });
        photoUrl = uploaded.url;
      }
      // মূল ঘরগুলো (নাম, ছবি, টি-শার্ট…) ধাপে ধাপেই যাচাই হয়ে গেছে;
      // এখানে শুধু অ্যাডমিনের যোগ করা অতিরিক্ত ঘরগুলোর উত্তর দেখা হয়।
      const missing = (site.formFields || []).find(
        (f) => !f.isBase && f.required && !String(answers[f.key] || "").trim(),
      );
      if (missing) throw new Error(`ঘরটি পূরণ করুন: ${missing.label}`);
      const result = await post<{
        registration: Registration;
        trackingKey: string;
      }>("/registrations", {
        participant: { ...participant, photoUrl },
        spouse,
        children,
        answers: Object.fromEntries(
          Object.entries(answers).filter(([, v]) => v !== ""),
        ),
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
      photoUrl: demoPhoto(),
    });
    setSenderMobile(mobile);
    toast("কাল্পনিক তথ্য ও নমুনা ছবি বসানো হয়েছে।");
  };
  // ── প্রতিটি ঘর আঁকার নিয়ম (মূল ঘরগুলো নিজের রকম, অতিরিক্ত ঘর সাধারণ) ──
  const labelOf = (f: FormField) => (
    <>
      {f.label}{" "}
      {f.required ? <em>*</em> : <span className="optional">ঐচ্ছিক</span>}
    </>
  );
  const baseInputs: Record<
    string,
    { id: string; name: keyof Participant; type?: string; autoComplete?: string; maxLength?: number }
  > = {
    name: { id: "reg-name", name: "name", autoComplete: "name", maxLength: 120 },
    school: { id: "reg-school", name: "school", maxLength: 200 },
    ssc_roll: { id: "reg-sscRoll", name: "sscRoll", maxLength: 30 },
    ssc_registration: { id: "reg-sscRegistration", name: "sscRegistration", maxLength: 40 },
    mobile: { id: "reg-mobile", name: "mobile", type: "tel", autoComplete: "tel" },
    location: { id: "reg-location", name: "location", maxLength: 200 },
  };
  const renderField = (f: FormField) => {
    // ১) মূল টেক্সট ঘর (নাম, স্কুল, রোল, রেজিস্ট্রেশন, মোবাইল, অবস্থান)
    if (baseInputs[f.key]) {
      const cfg = baseInputs[f.key];
      return (
        <label className="field field-full" key={f.id}>
          {labelOf(f)}
          <input
            id={cfg.id}
            name={cfg.name}
            type={cfg.type || "text"}
            autoComplete={cfg.autoComplete}
            placeholder={f.placeholder || undefined}
            maxLength={cfg.maxLength}
            value={String(participant[cfg.name] ?? "")}
            onChange={(e) => update(cfg.name, e.target.value)}
          />
          {f.help && <small className="field-help">{f.help}</small>}
        </label>
      );
    }
    // ২) ছবি
    if (f.key === "photo")
      return (
        <div className="field field-full photo-field" key={f.id}>
          <span className="photo-label">{labelOf(f)}</span>
          <div className="photo-picker">
            <span className={`photo-preview${photoBusy ? " busy" : ""}`}>
              {participant.photoUrl ? (
                <img src={participant.photoUrl} alt="নির্বাচিত ছবি" />
              ) : photoBusy ? (
                <Loader2 size={22} className="spin" />
              ) : (
                <Camera size={24} />
              )}
              <input
                ref={fileInput}
                className="photo-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onPickPhoto}
                aria-label="নিজের ছবি বাছাই করুন"
              />
            </span>
            <div className="photo-actions">
              <button
                type="button"
                className="button button-outline"
                disabled={photoBusy}
                onClick={() => fileInput.current?.click()}
              >
                {photoBusy ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
                {photoBusy
                  ? "ছবি প্রস্তুত হচ্ছে…"
                  : participant.photoUrl
                    ? "অন্য ছবি বাছাই করুন"
                    : "ছবি বাছাই করুন"}
              </button>
              {participant.photoUrl && (
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => update("photoUrl", "")}
                >
                  <Trash2 size={15} />
                  মুছে ফেলুন
                </button>
              )}
            </div>
          </div>
          {f.help && <small className="field-help">{f.help}</small>}
        </div>
      );
    // ৩) পরিবার (জীবনসঙ্গী + শিশু + মোট)
    if (f.key === "family")
      return (
        <div className="field family-block" key={f.id}>
          <div className="family-option">
            <span className="family-icon">
              <Heart size={20} />
            </span>
            <div>
              <b>{text("family.spouse", "জীবনসঙ্গী আসবেন?")}</b>
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
              <b>{text("family.children", "কতজন ছোট্ট অতিথি?")}</b>
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
            {text("family.total", "মোট পরিবারের সদস্য")}
            <input readOnly value={`${bn(1 + spouse + children)} জন (তোমাকেসহ)`} />
          </label>
        </div>
      );
    // ৪) টি-শার্টের সাইজ (লুকালে ফর্মে আসে না — কিছু আয়োজনে লাগে না)
    if (f.key === "tshirt")
      return (
        <div className="field tshirt-field" key={f.id}>
          <span>{labelOf(f)}</span>
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
          {f.help && <small>{f.help}</small>}
        </div>
      );
    // ৫) অতিরিক্ত ঘর (অ্যাডমিন যোগ করেছেন)
    return (
      <DynamicFields
        key={f.id}
        fields={[f]}
        values={answers}
        onChange={(key, value) => setAnswers((a) => ({ ...a, [key]: value }))}
        idPrefix="reg"
      />
    );
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
        <div className="success-keys">
          <div className="key-row">
            <span className="key-label">
              <Link2 size={15} /> তোমার গোপন টিকিট-লিংক
            </span>
            <code className="key-value">{ticketLink(success.trackingKey)}</code>
            <button
              type="button"
              className="key-copy"
              aria-label="লিংক কপি করো"
              onClick={() => copy(ticketLink(success.trackingKey))}
            >
              <Copy size={15} /> কপি
            </button>
          </div>
          <div className="key-row">
            <span className="key-label">
              <KeyRound size={15} /> রিকভারি কোড (লিংক হারালে এটাই কাজে দেবে)
            </span>
            <code className="key-value mono">{success.trackingKey}</code>
            <button
              type="button"
              className="key-copy"
              aria-label="রিকভারি কোড কপি করো"
              onClick={() => copy(success.trackingKey)}
            >
              <Copy size={15} /> কপি
            </button>
          </div>
          <p className="small-note">
            <Camera size={14} />
            এই পর্দার একটি স্ক্রিনশট নিয়ে রাখো, বা লিংক নিজের WhatsApp-এ পাঠাও।
            অন্য কেউ এই লিংক পেলে তোমার টিকিট দেখতে পাবে — তাই প্রকাশ্যে দিও না।
          </p>
          <p className="small-note">
            <LockKeyhole size={14} />
            এই ব্রাউজারেই আবার এলে “আমার টিকিট”-এ নিজে থেকেই দেখা যাবে।
            হারিয়ে গেলে আয়োজককে মোবাইল নম্বর ও TrxID জানাও — নতুন লিংক দেবেন
            (পুরোনো লিংক তখন বাতিল হয়ে যাবে)। কোনো এসএমএস পাঠানো হয় না।
          </p>
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
          <span className="form-overline">
            {text("card.eyebrow", "YOUR SEAT IS WAITING")}
          </span>
          <h3>{text("card.title", "বন্ধু, নামটা লিখে ফেলো!")}</h3>
        </div>
        <span className="form-heading-icon">
          <Ticket size={24} />
        </span>
      </div>
      <div className="form-steps" aria-label="নিবন্ধনের ধাপ">
        {["step1.label", "step2.label", "step3.label"]
          .map((key, i) => text(key, ["পরিচয়", "পরিবার", "পেমেন্ট"][i]))
          .map((label, i) => (
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
                <span>{text("step1.title", "০১ / তোমার পরিচয়")}</span>
                {site.mode === "demo" && (
                  <button type="button" className="demo-fill" onClick={demoFill}>
                    <Sparkles size={13} />
                    ডেমো তথ্য
                  </button>
                )}
              </div>
              <div className="field-grid">
                {fields
                  .filter((f) => (f.step ?? 1) === 1)
                  .map((f) => renderField(f))}
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
                <span>{text("step2.title", "০২ / কারা আসছো একসাথে?")}</span>
              </div>
              {fields
                .filter((f) => (f.step ?? 1) === 2)
                .map((f) => renderField(f))}
            </div>
          )}
          {step === 2 && (
            <div className="form-step-content">
              <div className="form-step-title">
                <span>{text("step3.title", "০৩ / পেমেন্টের তথ্য")}</span>
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
                  {text("payment.sender_mobile", "যে নম্বর থেকে টাকা পাঠিয়েছ")}{" "}
                  <em>*</em>
                  <input
                    name="senderMobile"
                    type="tel"
                    placeholder={text("payment.sender_mobile_hint", "যে নম্বর থেকে পাঠিয়েছ")}
                    value={senderMobile}
                    onChange={(e) => setSenderMobile(e.target.value)}
                  />
                </label>
                <label className="field">
                  {text("payment.transaction_id", "ট্রানজেকশন আইডি")} <em>*</em>
                  <input
                    name="transactionId"
                    placeholder={text("payment.transaction_id_hint", "যেমন: A7B8C9D0EF")}
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
                  {text(
                    "consent.text",
                    "প্রদত্ত তথ্য সঠিক। পেমেন্ট যাচাইয়ের পরেই টিকিট পাব এবং গোপন টিকিটের লিংক সংরক্ষণ করব।",
                  )}
                </span>
              </label>
            </div>
          )}
          <div className="form-fee-summary">
            <div>
              <span>{text("fee.label", "মোট নিবন্ধন ফি")}</span>
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
            {text("privacy.note", "তথ্য শুধু আয়োজন ও পেমেন্ট যাচাইয়ের জন্য ব্যবহৃত হবে।")}
          </div>
        </form>
      )}
    </div>
  );
}
