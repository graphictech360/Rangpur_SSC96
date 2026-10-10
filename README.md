# Rangpur SSC 96 Festival

1996 SSC ব্যাচের পুনর্মিলনী ও পিঠা উৎসবের নিবন্ধন অ্যাপ — পাবলিক সাইট, ম্যানুয়াল পেমেন্ট যাচাই, QR টিকিট, গেট চেক-ইন ও অ্যাডমিন রিপোর্ট।

**🌐 লাইভ:** https://ssc96-rangpur.vercel.app
**📘 বাংলা নির্দেশিকা:** [README.bn.md](README.bn.md) · **ডেটাবেস গঠন:** [docs/DATABASE.bn.md](docs/DATABASE.bn.md)

---

## কী কী আছে

| অংশ              | বিবরণ                                                                            |
| ---------------- | -------------------------------------------------------------------------------- |
| পাবলিক সাইট      | এক লিংকে নিবন্ধন — বন্ধু ৳১,৪৯৯ · সঙ্গী ৳৫০০ · প্রতি শিশু ৳২০০                   |
| পেমেন্ট          | bKash/Nagad Send Money (Tomal · Mahatab · Shohag · Arif), প্রেরকের নম্বর + TrxID |
| অ্যাডমিন প্যানেল | ম্যানুয়াল যাচাই → QR টিকিট; প্রতিটি সেকশন সম্পাদনা; অংশগ্রহণকারী যোগ/বাদ        |
| গেট              | শুধু অনুমোদিত ফোনে চেক-ইন (পarticipant নিজে নয়), এক নিবন্ধনে একবার              |
| রিপোর্ট          | স্কুলভিত্তিক হিসাব, টাকা, উপস্থিতি-অনুপস্থিত, রিফান্ড, CSV রপ্তানি               |
| ডেটাবেস          | সব টেবিল এক স্কিমায় (public) · ২৪ টেবিল + ১৪ ভিউ · ৩৬ সম্পর্ক · RLS চালু · সব কাজ RPC দিয়ে |

## দ্রুত চালু (স্থানীয়)

```bash
npm ci
npm run dev            # http://localhost:3000  (ডেমো ডেটা)
npm test               # ইউনিট + SQL পরীক্ষা
npm run build && npm start   # প্রোডাকশন বিল্ড
```

আসল ডেটাবেসে চালাতে `.env`-এ `DATA_MODE=supabase` + `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` দিন (কখনো service-role/secret key নয়)।

## ডেটাবেস বসানো

```bash
# নতুন করে: supabase/00_reset.sql → 10…23 ধাপ, তারপর 03_staff_setup.sql
# অথবা একবারে: supabase/04_SETUP_ALL_IN_ONE.sql (SQL Editor-এ পেস্ট)
SUPABASE_ACCESS_TOKEN=... node scripts/supabase-apply.mjs --ref <project-ref>
```

## হোস্টিং

- **Vercel:** `vercel.json` + `api/index.mjs` প্রস্তুত; env-এ `DATA_MODE=supabase`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SESSION_SECRET` (৩২+ অক্ষর), `COOKIE_SECURE=true`, `TRUST_PROXY=1`, `APP_ORIGIN=https://<your-domain>`
- বিস্তারিত: [docs/VERCEL.bn.md](docs/VERCEL.bn.md)

## গোপনীয়তা

এই রেপোতে কোনো পাসওয়ার্ড, টোকেন বা service key নেই — `.env` ইচ্ছাকৃতভাবে বাদ। Supabase-এর PAT ও Vercel টোকেন আলাদা ফাইলে (রেপোর বাইরে) রাখা হয়।
