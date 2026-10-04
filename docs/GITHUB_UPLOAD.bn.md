# GitHub-এ আপলোড করার গাইড — Rangpur SSC 96

> **আপলোড করার ফাইল:** `Rangpur-SSC96-GitHub.zip` (ওয়ার্কস্পেসে আছে, ~১.২ MB)
> **গন্তব্য রেপো:** https://github.com/graphictech360/Rangpur_SSC96
> এই ZIP-এ **১০২টি ফাইল** — পুরো অ্যাপ, ডেটাবেসের SQL, নির্দেশিকা সব আছে। **কোনো পাসওয়ার্ড/টোকেন/গোপন কী নেই।**

---

## ধাপ ০ — প্রস্তুতি (২ মিনিট)

1. **`Rangpur-SSC96-GitHub.zip`** ফাইলটা ডাউনলোড করুন (ওয়ার্কস্পেসের ফাইল-তালিকা থেকে)।
2. কম্পিউটারে ডান-ক্লিক → **Extract All / Unzip**। ভিতরে **`Rangpur_SSC96`** নামের একটা ফোল্ডার পাবেন।
3. ফোল্ডারটা খুললে ভিতরে দেখবেন: `src/`, `server/`, `supabase/`, `docs/`, `public/`, `README.md`, `.gitignore` ইত্যাদি।

> 💡 GitHub-এ যাবে ফোল্ডারটার **ভিতরের সব** — ফোল্ডারটা নিজে নয় (নিচে দেখানো আছে)।

---

## ধাপ ১ — GitHub-এর আপলোড পাতা খুলুন

ব্রাউজারে যান: **https://github.com/graphictech360/Rangpur_SSC96/upload/main**

(রেপোর প্রথম পাতা → **Add file** বাটন → **Upload files**-এ ক্লিক করলেও একই জায়গায় আসবেন।)

---

## ধাপ ২ — ফাইলগুলো টেনে ছাড়ুন (drag & drop)

1. আনজিপ করা **`Rangpur_SSC96` ফোল্ডারটা খুলুন**।
2. ভিতরের **সব ফাইল ও ফোল্ডার সিলেক্ট করুন** — **Ctrl + A** (Windows) / **Cmd + A** (Mac)।
3. সিলেকশনটা মাউসে ধরে **GitHub-এর পাতার "Drag files here…" বাক্সে টেনে ছাড়ুন**।
4. উপরে "Uploading…" দেখাবে — শেষ হলে নিচে সব ফাইলের তালিকা দেখবেন।

> ⚠️ একবারে না গেলে ভাগ করে ছাড়ুন — আগের ফাইল মুছে যায় না। যেমন প্রথমে `src`, `server`, `supabase`, `public`, `docs`, `api`, `scripts`, `tests`, `preview` ফোল্ডার + `README.md`, `index.html`; তারপর বাকি ফাইলগুলো।

---

## ধাপ ৩ — কমিট করুন

1. নিচে **Commit changes** অংশে লিখুন: `Rangpur SSC 96 Festival — সম্পূর্ণ অ্যাপ`
2. সবুজ **Commit changes** বাটনে ক্লিক করুন।
3. ফাইল বেশি হলে কয়েক সেকেন্ড লাগবে — অপেক্ষা করুন।

---

## ধাপ ৪ — যাচাই করুন

রেপোর প্রথম পাতায় ফিরে দেখুন: **https://github.com/graphictech360/Rangpur_SSC96**

| কী দেখবেন                                                   | ঠিক আছে?              |
| ----------------------------------------------------------- | --------------------- |
| উপরে **১০২ files** (বা কাছাকাছি)                            | ✅                    |
| `src/`, `server/`, `supabase/`, `docs/` ফোল্ডার দেখা যাচ্ছে | ✅                    |
| **README.md** খুললে নতুন লেখা (আগের "96 Festival" নয়)      | ✅                    |
| `.gitignore` ফাইল আছে (তালিকার শেষে)                        | ✅ না থাকলে নিচের টিপ |

### `.gitignore` না উঠলে (dot দিয়ে শুরু হওয়া ফাইল কখনো এড়িয়ে যায়)

GitHub → **Add file → Create new file** → নাম দিন `.gitignore` → এই লেখা পেস্ট করুন → Commit:

```
node_modules/
build/
.env
.env.*
!.env.example
data/
.artifacts/
*.log
.vercel/
preview-dist/
ticketshot.mjs
*.zip
```

দরকার হলে একইভাবে `.vercelignore` ও `.env.example` ফাইল বানান — ZIP-এর ভিতরে হুবহু লেখা পাবেন, কপি করে পেস্ট করবেন।

---

## ধাপ ৫ — Vercel-এর সাথে রেপো জুড়ুন (তাহলে push করলেই সাইট আপডেট)

এখনো জোড়া লাগানো নেই — API দিয়ে চেষ্টা করে এই বার্তা এসেছে:
_"To link a GitHub repository, you need to install the GitHub integration first."_

1. **GitHub অ্যাপ ইনস্টল:** https://github.com/apps/vercel → **Install** → অ্যাকাউন্ট **graphictech360** বাছুন →
   _Repository access_ → **Only select repositories** → **Rangpur_SSC96** টিক দিন → **Install**
2. **Vercel-এ জোড়া লাগান:** https://vercel.com/nirob14/rangpur-ssc96/settings/git →
   **Connect Git Repository** → **Rangpur_SSC96** বাছুন → Save (Production Branch: `main`)
   3.এরপর থেকে যে-কোনো আপডেটে **শুধু upload/push করলেই ১–২ মিনিটে সাইট হালনাগাদ** — CLI বা টোকেন লাগবে না।

> Environment Variables আগেই বসানো আছে — GitHub থেকে ডিপ্লয় হলেও সেগুলোই ব্যবহার হবে।

---

## ধাপ ৬ — ভবিষ্যতে আপডেটের সহজ নিয়ম

**পথ ক (ব্রাউজার, কিছু ইনস্টল ছাড়া):** যে ফাইল বদলাবেন সেটায় যান → ✏️ **Edit** → বদলান → **Commit changes**।
নতুন ফাইল যোগ করতে: **Add file → Upload files**।

**পথ খ (git থাকলে, দ্রুত):**

```bash
cd Rangpur_SSC96
git add -A
git commit -m "সময়সূচি হালনাগাদ"
git push
```

> 💡 **মনে রাখুন:** সময়সূচি, লেখা, ফি, ছবি, পেমেন্ট নম্বর — এসব **GitHub ছাড়াই** বদলানো যায়: অ্যাডমিন প্যানেল → সম্পাদনা → সঙ্গে সঙ্গে সাইটে দেখা যায়। GitHub লাগে শুধু অ্যাপের কোড/ডিজাইন বদলালে।

---

## যা কখনো আপলোড করবেন না

| ❌ নয়                           | কেন                                                |
| -------------------------------- | -------------------------------------------------- |
| `.env` ফাইল                      | এতে আসল কী থাকে — আমার দেওয়া ZIP-এ ইচ্ছা করেই নেই |
| `node_modules/`                  | সবাই `npm ci` দিয়ে নামায়                         |
| `build/`                         | Vercel নিজেই বানায়                                |
| `data/`                          | ডেমো ডেটা, দরকার নেই                               |
| `sb_secret_…` / service_role key | পুরো ডেটাবেস খুলে যাবে                             |
| যেকোনো টোকেন (PAT, Vercel)       | অ্যাকাউন্ট নিরাপদ থাকুক                            |

আমার ZIP-এ এগুলোর কোনোটিই নেই — যাচাই করা হয়েছে ✅
