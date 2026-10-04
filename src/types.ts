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
export interface Site {
  mode: Mode;
  event: FestivalEvent;
  fees: Fees;
  sections: Section[];
  schedule: ScheduleItem[];
  accounts: PaymentAccount[];
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
  role: "admin" | "scanner";
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
  stats: AdminStats;
}
export interface CheckinResult {
  alreadyCheckedIn: boolean;
  ticketNumber: string;
  name: string;
  school: string;
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
