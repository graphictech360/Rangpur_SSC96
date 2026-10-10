/* ── পুশ নোটিফিকেশন (R26) ─────────────────────────────────────────
   নতুন নিবন্ধন এলে অ্যাডমিন/মডারেটরের ব্রাউজার ও মোবাইলে (ইনস্টল করা
   অ্যাপে) পুশ পাঠানো হয়। Web Push স্ট্যান্ডার্ড — Chrome/Edge/Firefox,
   Android, এবং iOS 16.4+ (হোম স্ক্রিনে ইনস্টল করা অ্যাপে)।

   চাবি: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT (env)।
   ডেমো মোডে চাবি না থাকলে সার্ভার চালুর সময় সাময়িক চাবি তৈরি হয়,
   যাতে লোকাল পরীক্ষাতেও পুরো ফ্লো কাজ করে। */
import webpush from "web-push";

let publicKey = process.env.VAPID_PUBLIC_KEY || "";
let privateKey = process.env.VAPID_PRIVATE_KEY || "";
const subject = process.env.VAPID_SUBJECT || "mailto:graphictech360@gmail.com";

if (!publicKey || !privateKey) {
  if (process.env.DATA_MODE === "demo") {
    const pair = webpush.generateVAPIDKeys();
    publicKey = pair.publicKey;
    privateKey = pair.privateKey;
  }
}
const enabled = Boolean(publicKey && privateKey);
if (enabled) webpush.setVapidDetails(subject, publicKey, privateKey);

export const pushConfig = () => ({ enabled, publicKey: enabled ? publicKey : "" });
export const pushInternalKey = () => process.env.PUSH_INTERNAL_KEY || "";

/* সব সাবস্ক্রিপশনে পাঠায়; মৃত (410/404) এন্ডপয়েন্টের তালিকা ফেরত দেয়
   যাতে ডেটাবেস থেকে পরিষ্কার করা যায়। ৮ সেকেন্ডের বেশি অপেক্ষা নয় —
   নিবন্ধনের জবাব এতে আটকায় না। */
export async function sendPushToAll(targets, payload) {
  if (!enabled || !Array.isArray(targets) || targets.length === 0)
    return { sent: 0, dead: [] };
  const body = JSON.stringify(payload);
  const dead = [];
  let sent = 0;
  await Promise.allSettled(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          body,
          { TTL: 86400, timeout: 8000 },
        );
        sent += 1;
      } catch (e) {
        if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(t.endpoint);
      }
    }),
  );
  return { sent, dead };
}
