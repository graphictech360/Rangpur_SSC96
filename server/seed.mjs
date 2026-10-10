import { randomUUID, randomBytes, createHash } from "node:crypto";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export const collectors = [
  ["Tomal", "+8801773539721"],
  ["Mahatab", "+8801712836444"],
  ["Shohag", "+8801721764479"],
  ["Arif", "+8801787898951"],
];
export const seedEvent = {
  id: "96",
  name: "Rangpur SSC 96 Festival",
  tagline: "পুরোনো বন্ধুত্ব, নতুন গল্প।",
  dateLabel: "৩১ ডিসেম্বর",
  isDummyDate: true,
  venue: "ভিন্নজগৎ",
  city: "রংপুর",
  venueEnglish: "Vinnojogot, Rangpur",
  registrationOpen: true,
  // R21: ভেন্যুর লোকেশন ম্যাপ — গুগল ম্যাপে এই ঠিকানা খুঁজে দেখানো হয়
  mapQuery: "ভিন্নজগৎ, রংপুর",
  mapLink: "",
  mapVisible: true,
};
export const seedSections = [
  {
    id: randomUUID(),
    key: "hero",
    title: "স্কুলের সেই দিনগুলো,\nআবার ফিরে আসুক।",
    subtitle: "রংপুর এসএসসি ব্যাচ ১৯৯৬",
    body: "শেষ বেঞ্চের আড্ডা, টিফিনের ভাগ আর প্রিয় মুখগুলো। একদিনের জন্য ফিরে যাই আমাদের সেই চিরচেনা সময়ে।",
    imageUrl: "/assets/friends-forever.webp\n/assets/friends-together.webp",
    visible: true,
    order: 0,
  },
  {
    id: randomUUID(),
    key: "story",
    title: "বয়স বাড়ে।\nবন্ধুত্ব নয়।",
    subtitle: "একটা ব্যাচ। একটা পরিবার।",
    body: "স্কুলের ঘণ্টা অনেক আগেই থেমেছে। কিন্তু আমাদের গল্পগুলো থামেনি। পিঠার ঘ্রাণ, প্রাণখোলা আড্ডা আর আপন মানুষগুলোকে নিয়ে সাজানো এই দিন—শুধু আমাদের জন্য।",
    imageUrl: "",
    visible: true,
    order: 1,
  },
  {
    // R22: আগের আয়োজনের স্মৃতি-সেকশনের লেখা — অ্যাডমিন "পেজের লেখা ও ছবি" থেকে বদলাতে পারেন
    id: randomUUID(),
    key: "past_events",
    title: "সফল আয়োজনের স্মৃতি",
    subtitle: "আগের আড্ডাগুলো",
    body: "যেখানে একবার বসেছি, সেখানেই গল্প জমেছে — ছবিগুলো নিজে নিজেই বদলাবে, চাইলে ভিডিও-ও দেখে নিতে পারো।",
    imageUrl: "",
    visible: true,
    order: 2,
  },
  {
    id: randomUUID(),
    key: "registration",
    title: "তোমাকে ছাড়া\nআড্ডা জমবে না!",
    subtitle: "চলো, আবার একসাথে",
    body: "বন্ধু, জীবনসঙ্গী আর ছোট্ট অতিথিদের নিয়ে চলে এসো। নিচের ফর্ম পূরণ করে তোমার জায়গাটি নিশ্চিত করো।",
    imageUrl: "",
    visible: true,
    order: 2,
  },
  {
    id: randomUUID(),
    key: "schedule",
    title: "একদিন। অনেক আনন্দ।",
    subtitle: "দিনভর আমাদের আয়োজন",
    body: "পিঠা দিয়ে শুরু, স্মৃতি নিয়ে বাড়ি ফেরা। সময়সূচি আপাতত খসড়া—চূড়ান্ত আয়োজনের আগে আপডেট হবে।",
    imageUrl: "",
    visible: true,
    order: 3,
  },
  {
    id: randomUUID(),
    key: "footer",
    title: "দেখা হবে, বন্ধু!",
    subtitle: "Friends forever. Since 1996.",
    body: "রংপুর এসএসসি ব্যাচ ১৯৯৬-এর বন্ধুদের আয়োজনে।",
    imageUrl: "",
    visible: true,
    order: 4,
  },
  ...[
    [
      "branding",
      "RANGPUR SSC 96",
      "বন্ধুত্বের উৎসব",
      "",
      "/assets/ssc96-logo-v2.webp",
    ],
    [
      "marquee",
      "উৎসবের চলমান লেখা",
      "",
      "পিঠা উৎসব|পুরোনো বন্ধু|নতুন স্মৃতি|FRIENDS FOREVER",
      "",
    ],
    [
      "festival",
      "বন্ধুর সাথে, পরিবারও আসুক।",
      "সবার জন্য একটু আনন্দ",
      "ফি-র হিসাব একদম সহজ।\nতোমার পরিবারের সংখ্যা অনুযায়ী মোট ফি দেখাবে।",
      "",
    ],
    [
      "faq",
      "মনে প্রশ্ন আছে?",
      "একটু জেনে রাখি",
      "উৎসবের আগে প্রয়োজনীয় কয়েকটি কথা।",
      "",
    ],
    [
      "faq_01",
      "পেমেন্ট করার পর কি সঙ্গে সঙ্গে QR পাব?",
      "",
      "না। আয়োজকেরা পেমেন্ট যাচাই করে অনুমোদন দেওয়ার পর তোমার সংরক্ষিত টিকিটের লিংকে QR ও ডিজিটাল রিসিপ্ট পাওয়া যাবে।",
      "",
    ],
    [
      "faq_02",
      "টিকিট কোথায় পাব?",
      "",
      "এখানে এসএমএস পাঠানো হয় না। নিবন্ধনের পর পাওয়া গোপন লিংক কপি করে রাখো। একই ব্রাউজারে “আমার টিকিট” থেকেও স্ট্যাটাস দেখা যাবে। লিংক হারালে আয়োজকদের সাহায্য নাও।",
      "",
    ],
    [
      "faq_03",
      "পরিবারের জন্য আলাদা QR লাগবে?",
      "",
      "একটি নিবন্ধনের QR-এ বন্ধু ও নিবন্ধিত পরিবারের সবাই একসঙ্গে চেক-ইন করবে। পরিবারের মোট সদস্যসংখ্যা টিকিটে থাকবে।",
      "",
    ],
    [
      "faq_04",
      "আমি নিজের ফোন দিয়ে চেক-ইন করতে পারব?",
      "",
      "না। QR পড়া গেলেও চেক-ইন সম্পন্ন করতে অনুমোদিত আয়োজক/স্টাফ লগইন ও অনুমোদিত ব্রাউজার-সেশন প্রয়োজন। গেটে স্টাফ তোমার টিকিট স্ক্যান করবেন।",
      "",
    ],
  ].map(([key, title, subtitle, body, imageUrl], i) => ({
    id: randomUUID(),
    key,
    title,
    subtitle,
    body,
    imageUrl,
    visible: true,
    order: 5 + i,
  })),
];
/** নিবন্ধন ফর্মের ঘর — অ্যাডমিন প্যানেল থেকে যোগ/বদল/মুছে ফেলা যায় (শুরুতে ফাঁকা) */
// নিবন্ধন ফর্মের মূল ঘরগুলো — অ্যাডমিন প্যানেল থেকেই এডিট/লুকানো যায়
export const seedFormFields = [
  ["photo", "নিজের ছবি", "photo", "", "", true, true, false, 1, 10],
  ["name", "নাম", "text", "তোমার পুরো নাম", "", true, true, true, 1, 20],
  ["school", "স্কুলের নাম", "text", "যে স্কুল থেকে এসএসসি পাস করেছ", "", true, true, false, 1, 30],
  ["ssc_roll", "এসএসসি রোল", "text", "এসএসসি ১৯৯৬ রোল", "", true, true, false, 1, 40],
  ["ssc_registration", "এসএসসি রেজিস্ট্রেশন", "text", "রেজিস্ট্রেশন নম্বর", "", false, true, false, 1, 50],
  ["mobile", "মোবাইল নম্বর", "tel", "01XXXXXXXXX", "", true, true, true, 1, 60],
  ["location", "বর্তমান অবস্থান", "text", "শহর / দেশ", "", true, true, false, 1, 70],
  ["family", "কারা আসছো একসাথে?", "family", "", "", false, true, false, 2, 80],
  ["tshirt", "তোমার টি-শার্টের সাইজ", "tshirt", "", "এই সাইজটি মূল অংশগ্রহণকারী বন্ধুর জন্য।", true, true, false, 2, 90],
].map(([key, label, kind, placeholder, help, required, visible, locked, step, order], i) => ({
  id: `00000000-0000-4000-8000-${String(100 + i).padStart(12, "0")}`,
  key,
  label,
  kind,
  placeholder,
  help,
  options: [],
  maxLength: 200,
  required,
  visible,
  step,
  isBase: true,
  isLocked: locked,
  order,
}));

export const seedNavItems = [
  ["section", "আমাদের গল্প", "memories", 10],
  ["section", "আয়োজন", "festival", 20],
  ["section", "সময়সূচি", "schedule", 30],
  ["section", "নিবন্ধন", "registration", 40],
  ["ticket", "আমার টিকিট", "", 50],
].map(([kind, label, target, order], i) => ({
  id: `00000000-0000-4000-9000-${String(100 + i).padStart(12, "0")}`,
  kind,
  label,
  target,
  order,
  visible: true,
}));

export const seedFormTexts = Object.fromEntries(
  [
    ["card.eyebrow", "YOUR SEAT IS WAITING"],
    ["card.title", "বন্ধু, নামটা লিখে ফেলো!"],
    ["step1.label", "পরিচয়"],
    ["step1.title", "০১ / তোমার পরিচয়"],
    ["step2.label", "পরিবার"],
    ["step2.title", "০২ / কারা আসছো একসাথে?"],
    ["step3.label", "পেমেন্ট"],
    ["step3.title", "০৩ / পেমেন্টের তথ্য"],
    ["fee.label", "মোট নিবন্ধন ফি"],
    ["payment.sender_mobile", "যে নম্বর থেকে টাকা পাঠিয়েছ"],
    ["payment.sender_mobile_hint", "যে নম্বর থেকে পাঠিয়েছ"],
    ["payment.transaction_id", "ট্রানজেকশন আইডি"],
    ["payment.transaction_id_hint", "যেমন: A7B8C9D0EF"],
    ["family.total", "মোট পরিবারের সদস্য"],
    ["family.spouse", "জীবনসঙ্গী আসবেন?"],
    ["family.children", "কতজন ছোট্ট অতিথি?"],
    ["privacy.note", "তথ্য শুধু আয়োজন ও পেমেন্ট যাচাইয়ের জন্য ব্যবহৃত হবে।"],
    ["consent.text", "প্রদত্ত তথ্য সঠিক এবং আমি আয়োজনের নিয়ম মেনে চলব।"],
  ],
);

export const seedNavFallback = seedNavItems;

export const seedSchedule = [
  [
    "09:00",
    "নিবন্ধন ও পিঠা উৎসব",
    "নিবন্ধন কাউন্টার দুপুর ১২টায় বন্ধ হবে।",
    "সকাল",
  ],
  ["10:00", "স্বাগত পর্ব", "", "সকাল"],
  ["10:15", "ব্যাচের পুনর্মিলনী ছবি", "", "সকাল"],
  ["10:30", "পরিচিতি পর্ব", "", "সকাল"],
  ["11:00", "সাংস্কৃতিক অনুষ্ঠান", "", "সকাল"],
  ["12:00", "স্কুলভিত্তিক বন্ধুত্বের আড্ডা", "", "দুপুর"],
  ["13:30", "নামাজের বিরতি", "", "দুপুর"],
  ["14:00", "দুপুরের খাবার", "", "দুপুর"],
  ["15:00", "সবার জন্য খেলাধুলা", "", "বিকেল"],
  ["16:00", "স্মৃতিচারণ ও প্রয়াত বন্ধুদের স্মরণ", "", "বিকেল"],
  ["16:30", "শিক্ষক সম্মাননা", "", "বিকেল"],
  ["17:00", "পুরস্কার ও উপহার", "শুধু বন্ধুদের জন্য।", "বিকেল"],
  ["17:30", "গ্রুপ ছবি", "", "বিকেল"],
  ["18:00", "সমাপনী", "", "সন্ধ্যা"],
].map(([time, title, note, period], order) => ({
  id: randomUUID(),
  time,
  title,
  note,
  period,
  order,
  visible: true,
}));

/** R20: ডেমো অ্যালবামের ছবি — রঙিন SVG প্লেসহোল্ডার (অফলাইনেও দেখা যায়) */
function memoryArt(label, emoji, c1, c2) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
  </linearGradient></defs>
  <rect width="800" height="600" fill="url(#g)"/>
  <circle cx="660" cy="110" r="150" fill="#ffffff22"/>
  <circle cx="120" cy="520" r="190" fill="#00000014"/>
  <text x="50%" y="46%" font-size="120" text-anchor="middle">${emoji}</text>
  <text x="50%" y="66%" font-size="40" font-weight="bold" fill="#ffffff" text-anchor="middle" font-family="sans-serif">${label}</text>
  <text x="50%" y="76%" font-size="24" fill="#ffffffcc" text-anchor="middle" font-family="sans-serif">ডেমো ছবি — আসল ছবি অ্যাডমিন থেকে দিন</text>
</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
const seedAlbums = [
  {
    id: randomUUID(),
    title: "শেখের টেক, বদরগঞ্জ",
    dateLabel: "১১ সেপ্টেম্বর ২০২৬",
    active: true,
    order: 0,
    media: [
      ["আড্ডার শুরু", "🍵", "#2c5f4c", "#88b04b"],
      ["দুপুরের খাওয়া", "🍛", "#b3542e", "#e9c948"],
      ["গ্রুপ ছবি", "📸", "#1f4d5f", "#58a4b0"],
      ["পুরোনো গল্প", "😄", "#5b3a70", "#c86b85"],
      ["বিদায়ের আগে", "🤝", "#3c6e47", "#a3c585"],
    ].map(([l, e, a, b], i) => ({
      id: randomUUID(),
      kind: "image",
      url: memoryArt(l, e, a, b),
      order: i,
    })),
  },
  {
    id: randomUUID(),
    title: "আরশাদের বাগানবাড়ি, উত্তম, রংপুর",
    dateLabel: "২৫ সেপ্টেম্বর ২০২৬",
    active: true,
    order: 1,
    media: [
      ...[
        ["বাগানে জমায়েত", "🌳", "#34633e", "#9bc995"],
        ["চায়ের আসর", "☕", "#7a4a2b", "#d9a05b"],
        ["স্মৃতিচারণ", "🎙️", "#28496b", "#7fa8d9"],
        ["হাসির রোল", "😂", "#8a3b4c", "#e78fa0"],
        ["খেলার ফাঁকে", "🏏", "#44622e", "#b4cf66"],
        ["সন্ধ্যার গান", "🎸", "#4b3d73", "#9a86c9"],
        ["সবাই একসাথে", "🫶", "#215c54", "#6fc1ae"],
      ].map(([l, e, a, b], i) => ({
        id: randomUUID(),
        kind: "image",
        url: memoryArt(l, e, a, b),
        order: i,
      })),
      {
        id: randomUUID(),
        kind: "video",
        url: "https://www.w3schools.com/html/mov_bbb.mp4",
        order: 7,
      },
    ],
  },
];

export function initialState() {
  const accounts = ["bkash", "nagad"].flatMap((provider) =>
    collectors.map(([name, mobile], order) => ({
      id: randomUUID(),
      provider,
      name,
      mobile,
      order,
      active: true,
    })),
  );
  const demoTicketKey = token();
  const names = [
    ["মাহমুদ হাসান", "রংপুর জিলা স্কুল", "approved", 1, 1, "XL"],
    ["তানভীর আহমেদ", "কারমাইকেল কলেজিয়েট স্কুল", "pending", 0, 2, "L"],
    ["নুসরাত জাহান", "রংপুর সরকারি বালিকা উচ্চ বিদ্যালয়", "pending", 1, 0, "M"],
    ["রাকিবুল ইসলাম", "রংপুর জিলা স্কুল", "approved", 0, 0, "L"],
    ["সুমাইয়া রহমান", "পুলিশ লাইন্স স্কুল, রংপুর", "rejected", 0, 1, "M"],
  ];
  const registrations = names.map(
    ([name, school, status, spouse, children, tshirt], i) => {
      const total = 1020 + spouse * 510 + children * 205;
      const approvedAt =
        status === "approved"
          ? new Date(Date.now() - 86400000).toISOString()
          : null;
      return {
        id: randomUUID(),
        ticketNumber: `R96-${String(i + 1).padStart(5, "0")}`,
        participant: {
          name,
          school,
          sscRoll: `1996${i + 12}`,
          sscRegistration: `96${i + 12345}`,
          mobile: `0170000000${i + 1}`,
          location: i % 2 ? "ঢাকা" : "রংপুর",
          tshirt,
        },
        spouse,
        children,
        food: "সাধারণ",
        notes: "",
        feeSnapshot: { friend: 1020, spouse: 510, child: 205 },
        total,
        status,
        payment: {
          id: randomUUID(),
          provider: i % 2 ? "nagad" : "bkash",
          accountId: accounts[i % 2 ? 4 : 0].id,
          collectorName: "Tomal",
          collectorMobile: collectors[0][1],
          senderMobile: `0170000000${i + 1}`,
          transactionId: `DEMO96${i + 1001}`,
          amount: total,
          status:
            status === "approved"
              ? "verified"
              : status === "rejected"
                ? "rejected"
                : "pending",
          reviewedAt: approvedAt,
          reason:
            status === "rejected"
              ? "ডেমো: ট্রানজেকশন আইডি আবার যাচাই করতে হবে।"
              : "",
        },
        trackingHash: hash(i === 0 ? demoTicketKey : token()),
        qrSecret: status === "approved" ? token() : null,
        createdAt: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
        approvedAt,
        checkedInAt: i === 3 ? new Date().toISOString() : null,
        archivedAt: null,
        source: "demo",
      };
    },
  );
  return {
    version: 1,
    event: seedEvent,
    fees: { friend: 1020, spouse: 510, child: 205 },
    sections: seedSections,
    albums: structuredClone(seedAlbums),
    schedule: seedSchedule,
    formFields: seedFormFields,
    navItems: seedNavItems,
    formTexts: seedFormTexts,
    accounts,
    registrations,
    devices: [],
    audit: [],
    // ── R17: টিম (সহ-অ্যাডমিন), খরচের খাতা ও ঐচ্ছিক অনুদান ──
    team: [
      {
        id: randomUUID(),
        name: "ডেমো সহ-অ্যাডমিন",
        email: "moderator@ssc96.demo",
        role: "moderator",
        password: "Moderator96!",
        permissions: ["overview", "payments", "expenses"],
        active: true,
        createdBy: "ডেমো আয়োজক",
        createdAt: new Date().toISOString(),
      },
    ],
    expenses: [
      {
        id: randomUUID(),
        date: new Date().toISOString().slice(0, 10),
        title: "ভেন্যু অগ্রিম (ভিন্নজগত)",
        amount: 5000,
        note: "ডেমো খরচ — মুছে ফেলা যায়",
        enteredBy: "ডেমো আয়োজক",
        createdAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        date: new Date().toISOString().slice(0, 10),
        title: "ব্যানার ও প্রিন্টিং",
        amount: 1200,
        note: "",
        enteredBy: "ডেমো আয়োজক",
        createdAt: new Date().toISOString(),
      },
    ],
    donations: [
      {
        id: randomUUID(),
        date: new Date().toISOString().slice(0, 10),
        donor: "মাহমুদ হাসান",
        amount: 2000,
        note: "ডেমো অনুদান",
        enteredBy: "ডেমো আয়োজক",
        createdAt: new Date().toISOString(),
      },
    ],
    nextSerial: 6,
    demoTicketKey,
  };
}
