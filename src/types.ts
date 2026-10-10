export type Mode = "demo" | "supabase";
export type Provider = "bkash" | "nagad";
export interface FestivalEvent {
  id: string;
  name: string;
  tagline: string;
  dateLabel: string;
  isDummyDate: boolean;
  venue: string;
  city: string;
  venueEnglish: string;
  registrationOpen: boolean;
  photoRequired?: boolean;
  /** R21: ম্যাপে খোঁজার ঠিকানা (যেমন "ভিন্নজগৎ, রংপুর" বা "25.86,89.27") */
  mapQuery?: string;
  /** R21: গুগল ম্যাপের শেয়ার/এমবেড লিংক (ঐচ্ছিক, https:// হতে হবে) */
  mapLink?: string;
  /** R21: পাবলিক পেজে ম্যাপ দেখানো হবে কি না */
  mapVisible?: boolean;
}
export interface Fees {
  friend: number;
  spouse: number;
  child: number;
}
export interface Section {
  id: string;
  key: string;
  title: string;
  subtitle: string;
  body: string;
  imageUrl: string;
  visible: boolean;
  order: number;
}
export interface ScheduleItem {
  id: string;
  time: string;
  title: string;
  note: string;
  period: string;
  order: number;
  visible: boolean;
}
export interface PaymentAccount {
  id: string;
  provider: Provider;
  name: string;
  mobile: string;
  active: boolean;
  order: number;
}
/** নিবন্ধন ফর্মের একটি ঘর — অ্যাডমিন প্যানেল থেকেই যোগ/বদল/মুছে ফেলা যায় */
export type FieldKind =
  | "text"
  | "textarea"
  | "select"
  | "number"
  | "tel"
  | "date"
  | "checkbox";
export interface FormField {
  id: string;
  key: string;
  label: string;
  /** ১ = পরিচয় ধাপ, ২ = পরিবার ধাপ */
  kind: FieldKind;
  options: string[];
  placeholder: string;
  help: string;
  maxLength: number;
  required: boolean;
  order: number;
  step?: number;
  isBase?: boolean;
  isLocked?: boolean;
  visible?: boolean;
  texts?: { label?: string | null; help?: string | null; placeholder?: string | null };
}
export interface NavItem {
  id: string;
  kind: "section" | "ticket" | "link";
  label: string;
  target: string;
  order: number;
  visible: boolean;
}
export interface FormFieldStat {
  key: string;
  label: string;
  kind: FieldKind;
  order: number;
  answered: number;
  top: { value: string; count: number }[];
}
/** R20: আগের সফল আয়োজনের অ্যালবাম */
export interface MemoryMedia {
  id?: string;
  kind: "image" | "video";
  url: string;
  order?: number;
}
export interface MemoryAlbum {
  id?: string;
  title: string;
  dateLabel: string;
  media: MemoryMedia[];
  active: boolean;
  order: number;
}
export interface Site {
  mode: Mode;
  event: FestivalEvent;
  fees: Fees;
  sections: Section[];
  schedule: ScheduleItem[];
  accounts: PaymentAccount[];
  /** ফর্মের সব ঘর (মূল + অ্যাডমিনের যোগ করা) — সবসময় উপর-নিচে সাজানো */
  formFields: FormField[];
  /** ফর্মের লেখাগুলোর বদলে দেওয়া মান */
  formTexts?: Record<string, string>;
  /** হেডার/মেনুর আইটেম */
  nav?: NavItem[];
  /** আগের আয়োজনের স্মৃতি-অ্যালবাম (সক্রিয়গুলোই আসে) */
  albums?: MemoryAlbum[];
  demoTicketKey?: string;
}
export interface Participant {
  name: string;
  school: string;
  sscRoll: string;
  sscRegistration: string;
  mobile: string;
  location: string;
  tshirt: string;
  /** টিকিটে ও গেটে দেখানো ছবি — Supabase Storage-এর ছোট করা (৫১২×৫১২) পাবলিক লিংক */
  photoUrl?: string;
}
export interface Payment {
  id: string;
  provider: Provider;
  accountId: string;
  collectorName: string;
  collectorMobile: string;
  senderMobile: string;
  transactionId: string;
  amount: number;
  status: string;
  reviewedAt: string | null;
  reason: string;
}
export interface Registration {
  id: string;
  ticketNumber: string;
  participant: Participant;
  spouse: number;
  children: number;
  food: string;
  notes: string;
  /** অ্যাডমিন-যোগ করা ঘরগুলোর উত্তর — { "blood_group": "B+" } আকারে */
  answers?: Record<string, string>;
  feeSnapshot: Fees;
  total: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  payment: Payment;
  createdAt: string;
  approvedAt: string | null;
  checkedInAt: string | null;
  archivedAt: string | null;
  qrPayload?: string | null;
  source?: string;
}
export interface Staff {
  id: string;
  name: string;
  email: string;
  /** admin = মেইন অ্যাডমিন · moderator = সহ-অ্যাডমিন (সীমিত এক্সেস) · scanner = গেট স্টাফ */
  role: "admin" | "moderator" | "scanner";
  /** সহ-অ্যাডমিনের অনুমতির তালিকা (ট্যাবের কী); মেইন অ্যাডমিনে null = সব */
  permissions?: string[] | null;
}
/** খরচের খাতার এক লাইন */
export interface Expense {
  id: string;
  date: string;
  title: string;
  amount: number;
  note: string;
  enteredBy: string;
  createdAt: string;
}
/** বন্ধুদের ঐচ্ছিক অনুদানের এক লাইন */
export interface Donation {
  id: string;
  date: string;
  donor: string;
  amount: number;
  note: string;
  enteredBy: string;
  createdAt: string;
}
/** টিম-সদস্য (সহ-অ্যাডমিন/গেট স্টাফ) — মেইন অ্যাডমিন ব্যবস্থাপনা করেন */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "moderator" | "scanner";
  permissions: string[];
  active: boolean;
  createdBy?: string;
  createdAt?: string;
}
export interface Device {
  id: string;
  userId: string;
  staffName: string;
  label: string;
  status: "pending" | "approved" | "revoked";
  createdAt: string;
  updatedAt: string;
  approvedBy: string | null;
}
export interface Audit {
  id: string;
  user: string;
  action: string;
  recordId: string;
  createdAt: string;
}
export interface AdminData {
  event: FestivalEvent;
  fees: Fees;
  sections: Section[];
  schedule: ScheduleItem[];
  accounts: PaymentAccount[];
  registrations: Registration[];
  devices: Device[];
  audit: Audit[];
  formFields: FormField[];
  formFieldStats: FormFieldStat[];
  formTexts: Record<string, string>;
  nav: NavItem[];
  stats: AdminStats;
  /** R17: খরচের খাতা (অনুমতি থাকলে), ঐচ্ছিক অনুদান ও টিম (শুধু মেইন অ্যাডমিন) */
  expenses?: Expense[];
  donations?: Donation[];
  team?: TeamMember[];
  finance?: FinanceSummary | null;
  /** R20: সব অ্যালবাম (লুকানোসহ) — কনটেন্ট ট্যাবের ম্যানেজারের জন্য */
  albums?: MemoryAlbum[];
}
/** অনুমোদিত নিবন্ধন থেকে আয়ের ভাগ-বাটোয়ারা (সার্ভার হিসাব করে) */
export interface FinanceSummary {
  friendCount: number;
  friendTotal: number;
  spouseCount: number;
  spouseTotal: number;
  childCount: number;
  childTotal: number;
  registrationTotal: number;
}
export interface CheckinResult {
  alreadyCheckedIn: boolean;
  ticketNumber: string;
  name: string;
  school: string;
  /** গেটে চেনার জন্য অংশগ্রহণকারীর ছবি (Storage-এর লিংক) */
  photoUrl?: string;
  people: number;
  spouse: number;
  children: number;
  checkedInAt: string;
}

export interface AdminStats {
  generatedAt?: string;
  archived?: number;
  totals: {
    registrations: number;
    approved: number;
    pending: number;
    rejected: number;
    families: number;
    spouses: number;
    children: number;
    people: number;
    approvedPeople: number;
    expectedAmount: number;
    verifiedAmount: number;
    pendingAmount: number;
    checkedIn: number;
    checkedInPeople: number;
    absent: number;
    absentPeople: number;
    checkInPercent: number;
  };
  schools: {
    school: string;
    registrations: number;
    approved: number;
    people: number;
    expectedAmount: number;
    verifiedAmount: number;
    checkedIn: number;
    checkedInPeople: number;
    absent: number;
  }[];
  tshirts: { size: string; count: number }[];
  foods: { preference: string; count: number }[];
  /** অ্যাডমিন-যোগ করা ঘরে কে কী উত্তর দিয়েছে */
  formFields?: FormFieldStat[];
  providers: {
    provider: string;
    count: number;
    amount: number;
    verifiedAmount: number;
  }[];
  collectors: {
    provider: string;
    name: string;
    mobile: string;
    count: number;
    amount: number;
  }[];
  daily: { date: string; count: number }[];
}
