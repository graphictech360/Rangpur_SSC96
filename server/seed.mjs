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
      "/assets/ssc96-logo.webp",
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
      const total = 1499 + spouse * 500 + children * 200;
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
        feeSnapshot: { friend: 1499, spouse: 500, child: 200 },
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
    fees: { friend: 1499, spouse: 500, child: 200 },
    sections: seedSections,
    schedule: seedSchedule,
    accounts,
    registrations,
    devices: [],
    audit: [],
    nextSerial: 6,
    demoTicketKey,
  };
}
