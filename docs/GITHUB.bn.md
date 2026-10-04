# GitHub-এ আপলোড ও হালনাগাদ — Rangpur SSC 96

> **আপনার রেপো:** https://github.com/graphictech360/Rangpur_SSC96 (পাবলিক, ব্রাঞ্চ `main`)
> **অবস্থা (যাচাই করা):** রেপোতে এখন শুধু ১ লাইনের README — অ্যাপের কোড ওঠেনি।
> **Vercel সংযোগ:** এখনো হয়নি — জোড়া লাগাতে **Vercel GitHub App ইনস্টল** করতে হবে (নিচে ধাপ ৩)।

## ১. এই রেপোতে কোড তোলা (একবারের কাজ)

রেপো খালি, তাই সবচেয়ে সহজ পথ — **আমাদের কমিটটা সোজা push**:

```bash
cd rangpur-ssc96                      # ZIP খুলে এই ফোল্ডারে
git remote add origin https://github.com/graphictech360/Rangpur_SSC96.git
git push -u origin main --force       # ⚠️ নিচের ব্যাখ্যা পড়ুন
```

> **`--force` কেন?** রেপোতে আগে থেকেই একটা ১ লাইনের README-র কমিট আছে (অন্য কোনো ইতিহাস নেই)।
> force push করলে সেটা আমাদের সম্পূর্ণ README দিয়ে বদলে যাবে — এখানে ক্ষতির কিছু নেই।
> ইতিহাস রাখতে চাইলে বদলে:
> `git fetch origin && git merge --allow-unrelated-histories -X ours origin/main && git push -u origin main`

### আমার দিয়ে করাতে চাইলে

**GitHub PAT** (classic, শুধু `repo` scope, ৭ দিনের) চ্যাটে দিলে আমি সব কোড push করে দেব। টোকেন ফাইলে `mode 600`-এ রাখি, ছাপাই না, কাজ শেষে আপনি Revoke করে দেবেন।

---

## ২. এরপর ভবিষ্যতে আপডেট (নিয়মিত কাজ)

```bash
git add -A
git commit -m "সময়সূচি হালনাগাদ"
git push
```

Vercel জুড়ে থাকলে push হওয়ার ১–২ মিনিটের মধ্যে সাইট নিজে থেকেই হালনাগাদ হয়ে যাবে।

---

## ৩. Vercel-এর সাথে সংযোগ (একবারই) — এখনো বাকি

আপনার Vercel প্রজেক্ট **rangpur-ssc96** এখনো রেপোর সাথে জোড়া নেই। চেষ্টা করে বার্তা পেয়েছি:
_"To link a GitHub repository, you need to install the GitHub integration first."_

**ধাপ:**

1. **GitHub অ্যাপ ইনস্টল:** https://github.com/apps/vercel → **Install** → অ্যাকাউন্ট `graphictech360` বাছুন →
   _Repository access_: **Only select repositories** → `Rangpur_SSC96` বাছুন → **Install**
2. Vercel-এ যান → প্রজেক্ট **rangpur-ssc96** → **Settings → Git → Connect Git Repository** → `Rangpur_SSC96` বাছুন
   _(অথবা www.vercel.com/new থেকে রেপোটা Import করলে নতুন প্রজেক্ট হবে না — বিদ্যমানটা বাছুন)_
3. এরপর থেকে `git push` হলেই স্বয়ংক্রিয় ডিপ্লয় — Vercel CLI বা টোকেন লাগবে না।

> ইনস্টল করে আমাকে বললে আমি API দিয়ে জোড়াটা করে দেব ও যাচাই করে দেখব।

---

## ৪. Supabase GitHub সংযোগ প্রসঙ্গে

আপনার Supabase-এ GitHub ইন্টিগ্রেশন থাকলে সেটি সাধারণত **`supabase/migrations/*.sql`** ফোল্ডার খোঁজে।
আমাদের SQL ফাইলগুলো `supabase/`-এর ভিতরে ধাপে ধাপে আছে (`10_database.sql` … `23_harden.sql`), `migrations/` ফোল্ডারে নয় —
তাই push করলেও **কিছু নিজে থেকে চালানো হবে না** (ভালো কথা: ডেটাবেস ইতিমধ্যেই তৈরি, আবার চালালে ত্রুটি হতো)।

ভবিষ্যতে ডেটাবেসের পরিবর্তন শুধু `git push`-এ স্বয়ংক্রিয় করতে চাইলে বলুন — ফাইলগুলো `supabase/migrations/`-এ
সময়সহ নাম দিয়ে সাজিয়ে দেব (যেমন `20261004120000_admin_panel_update.sql`)।

---

## ৫. আগে থেকেই যা প্রস্তুত আছে

- লোকাল গিট রিপো তৈরি ও ২টি কমিট করা (১০২ ফাইল, ব্রাঞ্চ `main`)
- `.gitignore`-এ `.env`, `node_modules/`, `build/`, `data/`, `.vercel/`, `.artifacts/`, `*.zip` — সব বাদ
- রেপোতে **কোনো পাসওয়ার্ড, PAT বা service key নেই** (যাচাই করা)
- `README.md` (GitHub-এর প্রথম পাতা) · বাংলা `README.bn.md` · `vercel.json` + `api/index.mjs` প্রস্তুত

---

## ৬. নিরাপত্তা

| নয়                                | হ্যাঁ                                              |
| ---------------------------------- | -------------------------------------------------- |
| `.env` রেপোতে দেওয়া               | `.env.example`-এ শুধু নমুনা (আছে)                  |
| service_role/secret key কোথাও লেখা | শুধু publishable key, সেটাও `.env`-এ (রেপোর বাইরে) |
| টোকেন চ্যাটে ফেলে ভুলে যাওয়া      | কাজ শেষে **Revoke**                                |
| পাসওয়ার্ড কোডে লেখা               | Supabase Auth-এ রাখা                               |
