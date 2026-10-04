import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X, Check, AlertCircle, Loader2, Sparkles } from "lucide-react";
const ToastContext = createContext<(message: string, error?: boolean) => void>(
  () => {},
);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider
      value={(message, error = false) => {
        clearTimeout(timer.current);
        setToast({ message, error });
        timer.current = setTimeout(() => setToast(null), 4800);
      }}
    >
      {children}
      <div className="toast-region" aria-live="polite">
        {toast && (
          <div className={`toast ${toast.error ? "toast-error" : ""}`}>
            {toast.error ? <AlertCircle size={19} /> : <Check size={19} />}
            <span>{toast.message}</span>
            <button
              className="icon-button"
              aria-label="বার্তা বন্ধ করুন"
              onClick={() => setToast(null)}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const cancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog?.addEventListener("cancel", cancel);
    return () => {
      dialog?.removeEventListener("cancel", cancel);
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      className={`dialog ${wide ? "dialog-wide" : ""}`}
      ref={ref}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="বন্ধ করুন"
        >
          <X />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
/** নামের প্রথম অক্ষরের বদলে অংশগ্রহণকারীর আসল ছবি (থাকলে) দেখায় */
export function Avatar({
  name,
  photo,
  className = "",
}: {
  name: string;
  photo?: string;
  className?: string;
}) {
  // ছবি না থাকলে বা কোনো কারণে লোড না হলে নামের প্রথম অক্ষর দেখানো হয়
  const [broken, setBroken] = useState(false);
  return (
    <span className={`participant-avatar ${className}`.trim()}>
      {photo && !broken ? (
        <img
          src={photo}
          alt={name}
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        name.charAt(0)
      )}
    </span>
  );
}

export function Spinner({ label = "একটু অপেক্ষা…" }: { label?: string }) {
  return (
    <div className="loading-state">
      <Loader2 className="spin" size={28} />
      <span>{label}</span>
    </div>
  );
}
export function StatusBadge({
  status,
  checkedIn = false,
}: {
  status: string;
  checkedIn?: boolean;
}) {
  const current = checkedIn ? "checkedin" : status;
  const label: Record<string, string> = {
    pending: "যাচাইয়ের অপেক্ষায়",
    approved: "অনুমোদিত",
    rejected: "প্রত্যাখ্যাত",
    cancelled: "বাতিল",
    checkedin: "চেক-ইন সম্পন্ন",
    verified: "পেমেন্ট যাচাইকৃত",
  };
  return (
    <span className={`status-badge status-${current}`}>
      <i />
      {label[current] || current}
    </span>
  );
}
export function Eyebrow({
  children,
  light = false,
}: {
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <span className={`eyebrow ${light ? "eyebrow-light" : ""}`}>
      <Sparkles size={15} />
      {children}
    </span>
  );
}
export function Star({
  className = "",
  color = "currentColor",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 100 100"
      fill={color}
    >
      <path d="M50 0 61 31 85 15 69 39 100 50 69 61 85 85 61 69 50 100 39 69 15 85 31 61 0 50 31 39 15 15 39 31Z" />
    </svg>
  );
}
export function useReveal(deps: unknown[] = []) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.09 },
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, deps);
}

/* ── নিবন্ধন ফর্মের অতিরিক্ত ঘর (অ্যাডমিন যোগ করেন) — সবসময় উপর-নিচে ── */
import type { FormField } from "../types";
export function DynamicFields({
  fields,
  values,
  onChange,
  idPrefix = "extra",
}: {
  fields: FormField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  idPrefix?: string;
}) {
  if (!fields.length) return null;
  return (
    <div className="dynamic-fields">
      {fields.map((f) => {
        const id = `${idPrefix}-${f.key}`;
        const value = values[f.key] ?? "";
        const common = {
          id,
          name: f.key,
          value,
          required: f.required,
          maxLength: f.maxLength,
          placeholder: f.placeholder || undefined,
        };
        return (
          <label className="field dynamic-field" key={f.id || f.key} htmlFor={id}>
            <span className="dynamic-field-label">
              {f.label}
              {f.required ? <em> *</em> : <span className="optional">ঐচ্ছিক</span>}
            </span>
            {f.kind === "textarea" ? (
              <textarea
                {...common}
                rows={3}
                onChange={(e) => onChange(f.key, e.target.value)}
              />
            ) : f.kind === "select" ? (
              <select
                id={id}
                name={f.key}
                value={value}
                required={f.required}
                onChange={(e) => onChange(f.key, e.target.value)}
              >
                <option value="">— বেছে নাও —</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : f.kind === "checkbox" ? (
              <span className="checkbox-row">
                <input
                  id={id}
                  type="checkbox"
                  checked={["হ্যাঁ", "yes", "true", "1"].includes(value)}
                  onChange={(e) => onChange(f.key, e.target.checked ? "হ্যাঁ" : "")}
                />
                <span>{f.placeholder || "হ্যাঁ, প্রযোজ্য"}</span>
              </span>
            ) : (
              <input
                {...common}
                type={
                  f.kind === "number" ? "number" : f.kind === "date" ? "date" : f.kind === "tel" ? "tel" : "text"
                }
                inputMode={
                  f.kind === "number" ? "numeric" : f.kind === "tel" ? "tel" : undefined
                }
                onChange={(e) => onChange(f.key, e.target.value)}
              />
            )}
            {f.help && <small className="field-help">{f.help}</small>}
          </label>
        );
      })}
    </div>
  );
}
